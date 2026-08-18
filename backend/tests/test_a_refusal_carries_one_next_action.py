"""A refused read says one thing to do, and it is true (`UX-16`, `D-269`).

`SourceReadError.kind` maps four statuses — 401, 403, 404, 429 — and the
exception handler's remedy table is keyed on it, so every other status fell
through to *"Try again once the provider recovers"*. That sentence is right for
502 and for nothing else. It was being told to somebody whose source was not
pinned, whose deployment had no GitHub credential, and who had picked a PNG.

The row that found this reported the first of those. Counting the raise sites
found six statuses sharing the sentence, which is why the fix is a parameter
rather than one more branch, and why the second test here is a scan rather than
a case.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from fastapi.testclient import TestClient  # noqa: E402

from kae_studio.acquisition import SourceKind  # noqa: E402
from kae_studio.acquisition.service import AcquisitionService  # noqa: E402
from kae_studio.api import create_app  # noqa: E402
from kae_studio.config import Settings  # noqa: E402

SRC = Path(__file__).resolve().parents[1] / "src" / "kae_studio"

#: The statuses `SourceReadError.kind` maps to a remedy of its own, plus 502 —
#: the one status where waiting for the provider is the true next action,
#: because it is raised where GitHub could not be reached or answered with
#: nothing.
CARRIED_BY_THE_STATUS = frozenset({401, 403, 404, 429, 502})


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


def _constructions() -> list[tuple[str, ast.Call]]:
    """Every `SourceReadError(...)` in ``src``, keyed by module and line."""

    found = []
    for path in sorted(SRC.rglob("*.py")):
        module = path.relative_to(SRC).as_posix()
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Name)
                and node.func.id == "SourceReadError"
            ):
                found.append((f"{module}:{node.lineno}", node))
    return found


def test_a_status_the_table_cannot_answer_carries_its_own_remedy() -> None:
    """Adding a raise site is exactly when the outage sentence gets inherited.

    The handler falls back to *"Try again once the provider recovers"*, so a new
    status with no `remedy=` is not a missing string — it is a confident wrong
    instruction. Checked here rather than trusted to review, in the shape the
    egress and local-model door registries use.
    """

    silent = []
    for where, call in _constructions():
        if not call.args:
            continue
        status = call.args[0]
        if not isinstance(status, ast.Constant) or not isinstance(status.value, int):
            # A status that is not written here is the provider's own answer
            # being passed through (`github_source.py`'s `_get`), and that is
            # the one case where waiting for the provider to recover is the
            # true next action. The risk this guard exists for is a status
            # somebody typed.
            continue
        if status.value in CARRIED_BY_THE_STATUS:
            continue
        if not any(keyword.arg == "remedy" for keyword in call.keywords):
            silent.append(f"{where} raises {status.value}")

    assert not silent, (
        "these refusals fall through to the provider-outage remedy and say to wait "
        "for something that is not happening:\n  "
        + "\n  ".join(silent)
        + "\nPass remedy= with the one action that would resolve it."
    )
