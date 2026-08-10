"""RFA-4 · A failure must surface, never be substituted with a plausible answer.

Nothing in this estate asserted this. Every existing test drives a working
dependency, so the paths that matter when Memory is down, a provider fails, or
a write is refused were exercised by nothing — and "shows an empty result"
versus "says it could not read" is precisely the distinction the whole audit is
about, pointed at the failure case instead of the success one.

The rule under test, in one line: **an unavailable dependency must never render
as an empty project.** "No requirements" and "we could not read your
requirements" call for opposite actions from the person reading them.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from fastapi.testclient import TestClient  # noqa: E402

from kae_studio.api import create_app  # noqa: E402
from kae_studio.config import Settings  # noqa: E402
from kae_studio.memory_client import MemoryRefused, MemoryUnavailable  # noqa: E402


class _DownMemory:
    """A Memory that is not there. Every read raises, as the real client does."""

    def __init__(self, error: Exception) -> None:
        self._error = error

    def __getattr__(self, name: str) -> Any:
        async def raise_it(*_args: Any, **_kwargs: Any) -> Any:
            raise self._error

        async def shut_down(*_args: Any, **_kwargs: Any) -> None:
            """Closing an unreachable client is not itself a failure.

            Without this the stub raises during lifespan shutdown and every
            test fails at teardown rather than on its assertion — which reads
            as the product being broken when it is the double that is.
            """

        return shut_down if name == "aclose" else raise_it


#: The same shape the rest of the suite builds a test app from.
BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
}


@contextmanager
def _client(error: Exception) -> Iterator[TestClient]:
    """A client whose Memory is unreachable, with the app fully started.

    The lifespan has to run — it is what builds the interviewer the status
    endpoint reports on — and it also installs the real Memory client, so the
    substitution happens *after* entering rather than before. A helper that
    returned an unentered `TestClient` looked correct and skipped both.
    """

    app = create_app(Settings.from_environment(BASE))
    # `raise_server_exceptions=False`, because the behaviour under test *is* the
    # registered exception handler. The default re-raises inside the test and
    # the handler's response — the thing a real client would receive — is never
    # seen.
    with TestClient(app, raise_server_exceptions=False) as client:
        app.state.memory = _DownMemory(error)
        yield client


class TestAnUnreachableMemoryIsNotAnEmptyProject:
    def test_the_projection_says_it_could_not_read_rather_than_returning_nothing(self) -> None:
        """The failure the whole audit is about, in its failure-path form.

        `projection.py` catches per section and reports each one it could not
        compute in `unavailable`, with a reason. That mechanism exists so this
        case is distinguishable from a project that genuinely holds nothing —
        and until `AUD-002` the frontend discarded it.
        """

        with _client(MemoryUnavailable("connection refused")) as client:
            response = client.get("/api/projects/p1/projection")

        # Either a 503, or a projection that names what it could not read.
        # What it must never be is 200 with silently empty sections.
        if response.status_code == 200:
            body = response.json()
            assert body["unavailable"], (
                "a projection built while Memory was unreachable reported no "
                "unavailable sections — every empty field reads as a fact about "
                "the project"
            )
            sections = {entry["section"] for entry in body["unavailable"]}
            assert sections, "unavailable entries must name their section"
            assert all(entry["reason"] for entry in body["unavailable"]), (
                "a section reported unavailable without a reason is an empty "
                "panel with extra steps"
            )
        else:
            assert response.status_code == 503

    def test_a_503_says_nothing_was_written(self) -> None:
        """Because the first question after a failed write is what it left behind.

        Studio holds no durable state of its own, so the answer is always
        "nothing" — and saying it is what stops somebody retrying into a
        duplicate, or not retrying when they should.
        """

        with _client(MemoryUnavailable("connection refused")) as client:
            response = client.get("/api/projects")

        assert response.status_code == 503
        body = response.json()
        assert body["error"] == "memory_unavailable"
        assert "Nothing was written" in body["note"]

    def test_a_refusal_keeps_its_status_rather_than_becoming_a_generic_error(self) -> None:
        """A 409 is actionable; a 500 is not.

        Memory refusing a write for a stated reason — a stale version, a
        conflict — must reach the caller as that refusal. Flattening it to a
        server error tells a user their request was broken when it was their
        assumption that was.
        """

        with _client(MemoryRefused(409, "expected_version does not match")) as client:
            response = client.get("/api/projects")

        assert response.status_code == 409


class TestTheStatusEndpointStaysHonestWhileEverythingElseIsDown:
    def test_it_reports_memory_unreachable_rather_than_failing_with_it(self) -> None:
        """A status endpoint that dies with its dependency reports nothing.

        This is what an operator loads first, and it is unauthenticated for the
        same reason: a page that cannot say the backend is up looks broken when
        it is merely locked.
        """

        with _client(MemoryUnavailable("connection refused")) as client:
            response = client.get("/api/status")

        assert response.status_code == 200
        body = response.json()
        assert body["studio"] == "ok"
        assert body["memory_reachable"] is False
        # And it still says what this deployment is, because that is exactly
        # what somebody debugging an outage needs.
        assert "authentication" in body
