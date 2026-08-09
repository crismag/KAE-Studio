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
