"""What a person did with KAE's advice, in one click.

C-3 gave CIE permission to advise and C-4 gave it a way to conclude. Both
arrived as prose, so taking the advice meant retyping it into the conversation —
the cost this product already measured when "Discuss this" prefilled a box
nobody sent.

The three dispositions cost the same, deliberately. If accepting were a click
and disagreeing a paragraph, the product would have a thumb on the scale.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from fastapi.testclient import TestClient

from kae_studio.api import create_app
from kae_studio.config import Settings


class RecordingMemory:
    def __init__(self) -> None:
        self.recorded: list[dict[str, Any]] = []

    async def record_assumption(self, project_id: str, **kwargs: Any) -> Any:
        self.recorded.append({"project_id": project_id, **kwargs})
        return {"id": "a1", "origin": kwargs.get("origin")}

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


def _decide(browser: TestClient, disposition: str, **extra: Any) -> Any:
    return browser.post(
        "/api/projects/p1/recommendations",
        json={
            "disposition": disposition,
            "advice": "Defer mobile to a second release",
            "reason": "the web build proves the idea faster",
            "consequence": "architectural",
            "subject": "scope_and_boundaries",
            **extra,
        },
    )


def test_accepting_records_that_kae_advised_and_a_person_agreed() -> None:
    """Not that the person said it.

    `kae_recommended_accepted` is the difference between "KAE suggested this
    and I agreed" and "I said this". Erasing it would let KAE's view be
    presented back to the customer as their own.
    """

    with studio() as (browser, memory):
        response = _decide(browser, "accept")

    assert response.status_code == 200
    assert memory.recorded[0]["origin"] == "kae_recommended_accepted"
    assert memory.recorded[0]["assumed_value"] == "Defer mobile to a second release"


def test_an_edited_recommendation_keeps_the_edit() -> None:
    """Still KAE's idea, still their decision, and their wording.

    Recording the original would be recording agreement with something they
    explicitly did not agree with.
    """

    with studio() as (browser, memory):
        _decide(browser, "modify", modified_to="Defer mobile until after the first pilot")

    assert memory.recorded[0]["assumed_value"] == "Defer mobile until after the first pilot"
    assert memory.recorded[0]["origin"] == "kae_recommended_accepted"


def test_keeping_it_open_is_an_outcome_not_a_refusal() -> None:
    with studio() as (browser, memory):
        _decide(browser, "keep_open")

    assert memory.recorded[0]["origin"] == "unresolved_alternative"


def test_an_open_option_comes_back() -> None:
    """Otherwise "keep open" is a way of losing the question politely."""

    with studio() as (browser, memory):
        _decide(browser, "keep_open", revisit="never")

    assert memory.recorded[0]["revisit"] == "before_build"


def test_the_reason_says_which_disposition_produced_it() -> None:
    """Whoever reads the assumption later did not watch the click."""

    with studio() as (browser, memory):
        _decide(browser, "accept")
    assert "accepted it" in memory.recorded[0]["reason"]

    with studio() as (browser, memory):
        _decide(browser, "keep_open")
    assert "kept it open" in memory.recorded[0]["reason"]


def test_an_unknown_disposition_is_refused() -> None:
    with studio() as (browser, memory):
        response = _decide(browser, "reject_forever")

    assert response.status_code == 422
    assert memory.recorded == []
