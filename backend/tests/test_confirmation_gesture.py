"""One click confirms the reading a turn was built from.

The defect this closes is semantic, not cosmetic. CIE wrote "Confirmed — the
core problem is..." while the panel two across reported "Problem and value
proposition — missing · 0 of 1 confirmed". Both were correct. Confirmation
worked on one knowledge item at a time and a turn carried no ids, so a person's
"yes, that holds" had nothing to act on and the interviewer's word was prose.

A turn now carries the statements it reflected, and this is the route that turns
agreement into a recorded fact. **The click is the confirmation** — nothing asks
afterwards whether the person meant it.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from fastapi.testclient import TestClient

import pytest

# Studio's backend imports CIE at module level, and `cris-cie-slim` is a private
# repository while this one is public — so CI cannot check it out without a
# secret. Skipping keeps collection honest about *why* these do not run, rather
# than erroring as though the product were broken. Recorded as AUD-033; the fix
# is a deploy key, which is the repository owner's to grant.
#
# Before the imports below, because those are what pull CIE in.
pytest.importorskip("cie_slim", reason="cris-cie-slim is a private sibling repository")


from kae_studio.api import create_app
from kae_studio.config import Settings


class RecordingMemory:
    """Records what the route asked Memory to do."""

    def __init__(self) -> None:
        self.confirmed_sets: list[tuple[str, list[str]]] = []

    async def confirm_knowledge_set(self, project_id: str, knowledge_ids: list[str]) -> Any:
        self.confirmed_sets.append((project_id, list(knowledge_ids)))
        return [{"id": i, "lifecycle": "validated"} for i in knowledge_ids]

    async def aclose(self) -> None:
        return None


@contextmanager
def studio() -> Iterator[tuple[TestClient, RecordingMemory]]:
    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        memory = RecordingMemory()
        app.state.memory = memory
        yield browser, memory


def test_one_request_confirms_every_statement_the_reading_used() -> None:
    with studio() as (browser, memory):
        response = browser.post(
            "/api/projects/p1/knowledge/confirm",
            json={"knowledge_ids": ["know-1", "know-2", "know-3"]},
        )

    assert response.status_code == 200
    assert memory.confirmed_sets == [("p1", ["know-1", "know-2", "know-3"])]


def test_an_empty_set_is_refused_and_says_why() -> None:
    """An empty set is not a smaller agreement.

    It means the reading was lost between being shown and being agreed to, and
    a 200 would let the interface report a confirmation that never happened.
    """

    with studio() as (browser, memory):
        response = browser.post("/api/projects/p1/knowledge/confirm", json={"knowledge_ids": []})

    assert response.status_code == 422
    assert "lost between showing it" in response.json()["detail"]
    assert memory.confirmed_sets == [], "nothing reached Memory"


def test_a_set_large_enough_to_be_an_accident_is_refused() -> None:
    """Confirming a whole project by accident is the failure the directive names.

    A reading is a handful of statements. Two hundred is a caller that lost
    track of what it was asking about, and letting it through would turn a page
    of inference into user-confirmed knowledge in one call.
    """

    with studio() as (browser, memory):
        response = browser.post(
            "/api/projects/p1/knowledge/confirm",
            json={"knowledge_ids": [f"k{i}" for i in range(500)]},
        )

    assert response.status_code == 422
    assert memory.confirmed_sets == []


class StubInterviewer:
    """A turn that reflected two statements back."""

    def turn(self, project_id: str, message: str, *, actor: str) -> Any:
        from cie_slim.kae.conversation import Move

        return Move(
            text="So the problem is that notes scatter and tasks get lost.",
            skill="reflect_for_confirmation",
            subject="problem_and_value",
            provenance=("know-1", "know-2"),
        )


class TurnMemory(RecordingMemory):
    async def sessions(self, project_id: str) -> Any:
        return [{"id": "s1", "status": "open"}]

    async def post_message(self, *args: Any, **kwargs: Any) -> Any:
        return {"id": "m1"}


def test_the_turn_hands_the_browser_what_a_yes_would_apply_to() -> None:
    """Without this the gesture would have to guess which statements were meant.

    Guessing is how "Confirmed" came to sit beside "0 of 1 confirmed": the
    sentence covered several statements and nothing said which.
    """

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        app.state.memory = TurnMemory()
        app.state.interviewer = StubInterviewer()

        body = browser.post("/api/projects/p1/turn", json={"body": "Notes scatter."}).json()

    assert body["provenance"] == ["know-1", "know-2"]
    assert body["skill"] == "reflect_for_confirmation"


def test_a_turn_records_what_it_reflected_and_recommended() -> None:
    """Durable with the turn, not only in the reply.

    Both were reasoned once, from that turn's projection. Before this they
    lived only in the response body, so a refresh either lost the
    recommendation or would have had to pay a model call to decide it again —
    and ADR-0002 requires that rendering it cost nothing.
    """

    class Recording(TurnMemory):
        def __init__(self) -> None:
            super().__init__()
            self.posted: list[dict[str, Any]] = []

        async def post_message(self, *args: Any, **kwargs: Any) -> Any:
            self.posted.append(kwargs)
            return {"id": "m1"}

    class Ranking(StubInterviewer):
        def turn(self, project_id: str, message: str, *, actor: str) -> Any:
            from cie_slim.kae.conversation import Move, NextAction

            return Move(
                text="So the problem is that notes scatter.",
                skill="reflect_for_confirmation",
                subject="problem_and_value",
                provenance=("know-1",),
                next_action=(
                    NextAction("review", "Review 3 requirements", "oldest unreviewed work"),
                ),
            )

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        memory = Recording()
        app.state.memory = memory
        app.state.interviewer = Ranking()

        body = browser.post("/api/projects/p1/turn", json={"body": "Notes scatter."}).json()

    stored = memory.posted[0]["metadata"]
    assert stored["provenance"] == ["know-1"]
    assert stored["next_action"][0]["label"] == "Review 3 requirements"
    # The reply still carries them, so the turn that produced them shows them
    # without waiting for a refetch.
    assert body["next_action"][0]["reason"] == "oldest unreviewed work"


def test_what_a_turn_settled_is_recorded_as_an_assumption() -> None:
    """The half that makes a confirmation threshold durable.

    Grading a conclusion stops the interviewer asking about it. Recording it is
    what stops the conclusion evaporating, and what lets it be revisited when
    its trigger fires rather than never — a conclusion nobody looks at again is
    a guess with tenure.

    An assumption, never knowledge: KAE's interpretation has to stay
    distinguishable from what a person said.
    """

    class Recording(TurnMemory):
        def __init__(self) -> None:
            super().__init__()
            self.assumptions: list[dict[str, Any]] = []

        async def record_assumption(self, project_id: str, **kwargs: Any) -> Any:
            self.assumptions.append({"project_id": project_id, **kwargs})
            return {"id": "a1"}

    class Concluding(StubInterviewer):
        def turn(self, project_id: str, message: str, *, actor: str) -> Any:
            from cie_slim.kae.conversation import Conclusion, Move

            return Move(
                text="I'll take weekly as the working cadence.",
                skill="adopt_working_assumption",
                subject="scope_and_boundaries",
                concluded=(Conclusion("Reports are weekly", "rework", "before_build"),),
            )

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        memory = Recording()
        app.state.memory = memory
        app.state.interviewer = Concluding()

        body = browser.post("/api/projects/p1/turn", json={"body": "Whatever works."}).json()

    assert len(memory.assumptions) == 1
    recorded = memory.assumptions[0]
    assert recorded["assumed_value"] == "Reports are weekly"
    assert recorded["consequence"] == "rework"
    assert recorded["revisit"] == "before_build"
    assert body["concluded"][0]["material"] is False


def test_a_failed_assumption_write_does_not_cost_the_reply() -> None:
    """The person is waiting for the turn, not for the bookkeeping.

    Losing a recorded assumption is a smaller harm than losing the
    conversation — and the turn still carries it in its own metadata, so the
    fact is not gone, only its durable copy.
    """

    class Failing(TurnMemory):
        async def record_assumption(self, *args: Any, **kwargs: Any) -> Any:
            from kae_studio.memory_client import MemoryUnavailable

            raise MemoryUnavailable("memory is down")

    class Concluding(StubInterviewer):
        def turn(self, project_id: str, message: str, *, actor: str) -> Any:
            from cie_slim.kae.conversation import Conclusion, Move

            return Move(
                text="Weekly, then.",
                skill="adopt_working_assumption",
                subject="scope",
                concluded=(Conclusion("Reports are weekly", "cosmetic", "on_request"),),
            )

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        app.state.memory = Failing()
        app.state.interviewer = Concluding()

        response = browser.post("/api/projects/p1/turn", json={"body": "Whatever works."})

    assert response.status_code == 200
    assert response.json()["move"] == "Weekly, then."


def test_the_disclosure_a_user_sees_matches_the_runs_behind_it() -> None:
    """The seam, which is where every defect today actually lived.

    Memory counts abandoned extraction runs and Studio renders a sentence about
    them. Both halves are covered; nothing asserted that the number in the
    sentence is the number Memory reported. That is exactly the gap that let
    `enqueue_review` sit on a route with no caller, `origin` sit on a service
    and not its schema, and `metadata` be persisted and never returned.
    """

    class Lossy(RecordingMemory):
        async def get_project(self, project_id: str) -> Any:
            return {"id": project_id, "name": "Lossy", "knowledge_revision": 5}

        async def readiness(self, project_id: str) -> Any:
            return {"percentage": 8, "status": "discovering", "areas": []}

        async def knowledge(self, project_id: str, lifecycle: Any = None) -> Any:
            return []

        async def clarification_candidates(self, project_id: str, limit: int = 20) -> Any:
            # The projection reads candidates now, not clarifications: showing
            # what could be asked must not ask it (issue #3).
            return {"candidates": []}

        async def clarifications(self, project_id: str, limit: int = 20) -> Any:
            return []

        async def blockers(self, project_id: str) -> Any:
            return []

        async def preliminary_context(self, project_id: str) -> Any:
            return {}

        async def extraction_coverage(self, project_id: str) -> Any:
            return {"succeeded": 45, "abandoned": 12, "total": 57, "complete": False}

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        app.state.memory = Lossy()
        projection = browser.get("/api/projects/p1/projection").json()

    assert projection["extractionCoverage"] == {
        "succeeded": 45,
        "abandoned": 12,
        "complete": False,
    }
    # And it stays out of the health figure, which is the whole rule:
    # content loss is reported separately and never folded in.
    assert projection["health"]["percentage"] == 8


def test_a_memory_that_cannot_report_loss_does_not_produce_a_warning() -> None:
    """Silence on ignorance.

    A Memory too old to answer has told us nothing about loss. Defaulting to
    "incomplete" would put the notice on every project running an older version,
    which is the definition of a banner nobody reads.
    """

    class Older(RecordingMemory):
        async def get_project(self, project_id: str) -> Any:
            return {"id": project_id, "name": "Older"}

        async def readiness(self, project_id: str) -> Any:
            return {}

        async def knowledge(self, project_id: str, lifecycle: Any = None) -> Any:
            return []

        async def clarification_candidates(self, project_id: str, limit: int = 20) -> Any:
            # The projection reads candidates now, not clarifications: showing
            # what could be asked must not ask it (issue #3).
            return {"candidates": []}

        async def clarifications(self, project_id: str, limit: int = 20) -> Any:
            return []

        async def blockers(self, project_id: str) -> Any:
            return []

        async def preliminary_context(self, project_id: str) -> Any:
            return {}

        async def extraction_coverage(self, project_id: str) -> Any:
            raise RuntimeError("this Memory has no such route")

    app = create_app(
        Settings.from_environment(
            {
                "KAE_MEMORY_TOKEN": "token",
                "STUDIO_SESSION_SECRET": "x" * 40,
                "STUDIO_NO_AUTH": "1",
            }
        )
    )
    with TestClient(app) as browser:
        app.state.memory = Older()
        projection = browser.get("/api/projects/p1/projection").json()

    assert projection["extractionCoverage"]["complete"] is True
