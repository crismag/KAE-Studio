"""RFA-1 · A turn changes the project, and the change survives — the middle beat.

Readiness counts statements per discovery area. A statement reaches an area only
when a review run classifies it. Studio drove extraction and read readiness and
**never asked for the classification in between**, so a project could accumulate
confirmed statements and report `0% · not_started` forever.

`EM-5` found the capability had no caller outside a unit test and exposed it over
HTTP and MCP. The only interface a person uses still did not call it, and
`test_confirmation_gesture.py` already names the shape in passing: *"`enqueue_review`
sit on a route with no caller"*.

Measured on the deployed system rather than argued — the acceptance project
`Cris Test 2` holds **five successful extraction runs, zero review runs**, and
`0%` (`AUD-041`).

## What this file asserts

That Studio asks, and that asking twice about unchanged knowledge does not buy a
second model pass over every statement the project holds. The percentage
actually moving is a claim about a worker and a model, and belongs in
`e2e/acceptance/journey.py` against the live stack.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import pytest

pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")

from fastapi.testclient import TestClient  # noqa: E402

from kae_studio.api import create_app  # noqa: E402
from kae_studio.config import Settings  # noqa: E402

BASE = {
    "KAE_MEMORY_TOKEN": "token",
    "STUDIO_SESSION_SECRET": "x" * 40,
    "STUDIO_NO_AUTH": "1",
}


class _RecordingMemory:
    """A Memory that records what Studio asked it for.

    Only the two calls this route makes are implemented. Anything else raising
    is the point: a route that quietly needed a third call would fail here
    rather than pass on a double that answers everything.
    """

    def __init__(self, readiness: dict[str, Any] | None = None) -> None:
        self.reviews: list[tuple[str, str]] = []
        self._readiness = (
            readiness
            if readiness is not None
            else {
                "percentage": 0,
                "current_knowledge_revision": 25,
                "knowledge_revision": 12,
                "is_stale": True,
                "classification": {
                    "engine": None,
                    "degraded": False,
                    "note": "",
                    "reviewed_at": None,
                },
            }
        )

    async def readiness(self, project_id: str) -> Any:
        return dict(self._readiness)

    async def enqueue_review(self, project_id: str, idempotency_key: str) -> Any:
        self.reviews.append((project_id, idempotency_key))
        return {"run_id": f"run-{len(self.reviews)}", "status": "pending"}

    async def aclose(self) -> None:
        """Shutting down a double is not a failure to shut down."""


@contextmanager
def _client(memory: _RecordingMemory) -> Iterator[TestClient]:
    app = create_app(Settings.from_environment(BASE))
    # After entering, not before: the lifespan installs the real client and
    # would overwrite a substitution made on the unentered app.
    with TestClient(app, raise_server_exceptions=False) as client:
        app.state.memory = memory
        yield client


class TestStudioAsksForTheClassification:
    def test_the_route_exists_at_all(self) -> None:
        """The whole finding, in one assertion.

        Before this there was no path here — not this one, not any other. The
        same sentence `EM-5` needed, one layer up.
        """

        memory = _RecordingMemory()
        with _client(memory) as client:
            response = client.post("/api/projects/p1/classify", json={})

        assert response.status_code == 200, response.text
        assert memory.reviews, "the route returned success without asking Memory for anything"

    def test_it_asks_about_the_project_it_was_called_for(self) -> None:
        memory = _RecordingMemory()
        with _client(memory) as client:
            client.post("/api/projects/p1/classify", json={})

        assert memory.reviews[0][0] == "p1"

    def test_asking_twice_on_unchanged_knowledge_reuses_the_key(self) -> None:
        """The reason Memory requires the key rather than offering it.

        Review is a model call over every statement the project holds, so a
        second request without an idempotency key is a second bill and a second
        set of classifications for one intent. Studio derives it from the
        knowledge revision — one review per state of the project.
        """

        memory = _RecordingMemory()
        with _client(memory) as client:
            client.post("/api/projects/p1/classify", json={})
            client.post("/api/projects/p1/classify", json={})

        assert memory.reviews[0][1] == memory.reviews[1][1]
        assert "25" in memory.reviews[0][1], "the key must carry the revision it was taken at"

    def test_knowledge_moving_earns_a_new_pass(self) -> None:
        """And the other direction, which is what makes the key a key.

        A project that has grown since its last review must be reviewable
        again, or the idempotency that protects the bill would freeze the
        number instead.
        """

        memory = _RecordingMemory()
        with _client(memory) as client:
            client.post("/api/projects/p1/classify", json={})
            memory._readiness = {**memory._readiness, "current_knowledge_revision": 26}
            client.post("/api/projects/p1/classify", json={})

        assert memory.reviews[0][1] != memory.reviews[1][1]

    def test_two_projects_never_share_a_key(self) -> None:
        """Including when neither reports a revision.

        A fallback that collapsed to a constant would make every project's
        first review the same run — one project classified, the rest silently
        returned the first one's result.
        """

        memory = _RecordingMemory(readiness={"percentage": 0})
        with _client(memory) as client:
            client.post("/api/projects/p1/classify", json={})
            client.post("/api/projects/p2/classify", json={})

        assert memory.reviews[0][1] != memory.reviews[1][1]


class TestItRefusesToBuyAPassItDoesNotNeed:
    """The key alone does not hold, and the deployed system proved it.

    A review assigns area links, which bumps the knowledge revision — so the
    revision *after* a review is never the revision the key was taken at.
    Pressing twice in a row therefore bought two model passes over every
    statement in the project. The second request returned a different run id on
    the live stack, which is how this was found rather than reasoned about.

    `is_stale` is the question actually being asked: false means readiness was
    calculated at the project's current revision, which is exactly "the
    classification covers what the project holds now".
    """

    def test_a_current_classification_is_not_recomputed(self) -> None:
        memory = _RecordingMemory(
            readiness={
                "percentage": 16,
                "current_knowledge_revision": 9,
                "knowledge_revision": 9,
                "is_stale": False,
                "classification": {"engine": "reviewed_by_model", "degraded": False},
            }
        )
        with _client(memory) as client:
            response = client.post("/api/projects/p1/classify", json={})

        assert response.status_code == 200, response.text
        assert response.json()["status"] == "already_current"
        assert memory.reviews == [], "a second model pass was bought for no new knowledge"

    def test_new_knowledge_since_the_last_review_is_classified(self) -> None:
        """The other direction, which is what makes the refusal a guard and not
        a wall. A project that has grown must be reviewable again."""

        memory = _RecordingMemory(
            readiness={
                "percentage": 16,
                "current_knowledge_revision": 14,
                "knowledge_revision": 9,
                "is_stale": True,
                "classification": {"engine": "reviewed_by_model", "degraded": False},
            }
        )
        with _client(memory) as client:
            client.post("/api/projects/p1/classify", json={})

        assert memory.reviews, "knowledge moved and nothing reclassified it"
        assert "14" in memory.reviews[0][1]

    def test_a_project_nothing_has_reviewed_is_never_refused(self) -> None:
        """`is_stale` is false on a project whose readiness has never been
        calculated over anything. Reading it alone would refuse the one case
        this whole route exists for."""

        memory = _RecordingMemory(
            readiness={
                "percentage": 0,
                "current_knowledge_revision": 5,
                "knowledge_revision": 5,
                "is_stale": False,
                "classification": {"engine": None, "degraded": False},
            }
        )
        with _client(memory) as client:
            client.post("/api/projects/p1/classify", json={})

        assert memory.reviews, "a project no review has run over was refused a review"


class TestTheProjectionSaysWhetherAnythingClassified:
    def test_it_carries_memorys_classification_rather_than_only_the_number(self) -> None:
        """The conservation check for this finding.

        Memory computes `classification` carefully — `AUD-025`, `AUD-026`,
        `AUD-039` — and Studio dropped it, so a percentage produced by no
        review at all read exactly like one a model produced.
        """

        from kae_studio.projection import _classification

        report = _classification(
            {
                "percentage": 0,
                "classification": {
                    "engine": None,
                    "degraded": False,
                    "note": "No review has run.",
                    "reviewed_at": None,
                },
            }
        )

        assert report["engine"] is None
        assert report["note"] == "No review has run."

    def test_a_memory_that_does_not_report_it_is_unknown_not_never(self) -> None:
        """Three states, and the weakest claim for the weakest evidence.

        `null` means *no review has run*, which is a strong claim about the
        project. An older Memory has told us nothing, and saying `null` there
        would put a button in front of somebody on the strength of a missing
        field.
        """

        from kae_studio.projection import _classification

        assert _classification({"percentage": 40})["engine"] == "unknown"
        assert _classification(None)["engine"] == "unknown"
