"""A refused read says one thing to do, and it is true (`UX-16`, `D-269`).

`SourceReadError.kind` maps four statuses — 401, 403, 404, 429 — and the
exception handler's remedy table is keyed on it, so every other status fell
through to *"Try again once the provider recovers"*. That sentence is right for
502 and for nothing else. It was being told to somebody whose source was not
pinned, whose deployment had no GitHub credential, and who had picked a PNG.

The row that found this reported the first of those. Counting the raise sites
found six statuses sharing the sentence, which is why the fix is a parameter
rather than one more branch.

**That count is a scan and it lives in `test_every_refusal_names_a_remedy.py`**,
because it needs neither the app nor the private sibling, and while it sat in
this file it skipped in CI along with the route case (`D-292`). What is left
here is that route case, which does need both.
"""

from __future__ import annotations

from typing import Any

import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from fastapi.testclient import TestClient  # noqa: E402

from kae_studio.acquisition import SourceKind  # noqa: E402
from kae_studio.acquisition.service import AcquisitionService  # noqa: E402
from kae_studio.api import create_app  # noqa: E402
from kae_studio.config import Settings  # noqa: E402


def test_an_unpinned_source_is_told_to_pin_it() -> None:
    """The contradiction the row reported: a correct cause, a remedy about an outage."""

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as client:
        service = AcquisitionService(github=object())  # type: ignore[arg-type]
        app.state.acquisition = service
        connection = service.add_connection("github", "test", "env:TOKEN")
        source = service.add_source(
            "p1", SourceKind.GITHUB, connection.connection_id, "owner/repo", "main"
        )

        body: Any = client.get(f"/api/sources/{source.source_id}/files").json()

    error = body["error"]
    assert "not been pinned" in error["message"]
    assert "pin" in error["remedy"].lower()
    assert "provider" not in error["remedy"].lower(), (
        "the cause is stated correctly and the remedy named an outage that is not "
        "happening; a degraded state carries one exact next action"
    )

