"""`D-282` — the candidates listing is a prefix and the projection said nothing.

`GET /v1/projects/{id}/clarifications/candidates` truncates to `limit` — 20,
from `memory_client.clarification_candidates`'s own default, since the
projection passes none — orders most severe first, and says how many it left
out. `_items` returned the list and dropped `total` and `omitted`, so the only
surface a person reads drew a page and labelled it with a count of the project.

Written against `_completeness` rather than through the app, for the reason
`test_the_reason_survives_the_projection` gives: the app-level modules need
dependencies a local run may not have, and a test that cannot be run is not a
guard.
"""

import asyncio
from typing import Any, cast

from kae_studio.projection import _completeness, _items, build_projection


def _envelope(**overrides: object) -> dict[str, object]:
    payload = {
        "candidates": [{"candidate_key": "question:missing_area:scope:-"}],
        "total": 47,
        "omitted": 27,
        "note": "Nothing here has been asked unless it carries an asked_id.",
    }
    payload.update(overrides)
    return payload


def test_the_counts_reach_the_projection() -> None:
    assert _completeness(_envelope()) == {"total": 47, "omitted": 27}


def test_the_list_still_arrives_beside_them() -> None:
    # The control. The list was never dropped, so a failure here means the
    # fixture stopped matching what `_items` reads rather than that the counts
    # regressed.
    assert len(_items(_envelope())) == 1


def test_a_whole_list_says_so_rather_than_saying_nothing() -> None:
    # Zero omitted is a claim — the producer counted and nothing was cut. It
    # must survive as 0 and not collapse into the unclaimed case, or a page
    # cannot tell "complete" from "we were not told".
    assert _completeness(_envelope(total=3, omitted=0)) == {"total": 3, "omitted": 0}


def test_a_bare_array_claims_nothing_about_completeness() -> None:
    # `/knowledge` and `/blockers` answer with a bare array. Neither takes a
    # limit and neither query has one, so neither makes a claim — and reading
    # the absence as "whole" would have the page assert something nobody said.
    assert _completeness([{"id": "k-1"}, {"id": "k-2"}]) == {"total": None, "omitted": None}


def test_a_kae_memory_without_the_fields_yields_no_invented_count() -> None:
    payload = _envelope()
    del payload["total"]
    del payload["omitted"]

    assert _completeness(payload) == {"total": None, "omitted": None}


def test_a_non_numeric_count_is_refused_rather_than_carried() -> None:
    # Never coerced. A string reaching the arithmetic on the page is a crash
    # where an unclaimed count is a quiet, correct silence.
    assert _completeness(_envelope(omitted="many")) == {"total": 47, "omitted": None}


class _Memory:
    """Answers every call `build_projection` makes, and nothing else."""

    async def get_project(self, project_id: str) -> Any:
        return {"id": project_id, "name": "Astra"}

    async def readiness(self, project_id: str) -> Any:
        return {}

    async def knowledge(self, project_id: str) -> Any:
        return []

    async def clarification_candidates(self, project_id: str) -> Any:
        return _envelope()

    async def blockers(self, project_id: str) -> Any:
        return []

    async def preliminary_context(self, project_id: str) -> Any:
        return {}

    async def extraction_coverage(self, project_id: str) -> Any:
        return {}

    async def module_graph(self, project_id: str) -> Any:
        return {}

    async def review(self, project_id: str) -> Any:
        return {}


def test_the_projection_carries_the_counts_to_the_room() -> None:
    # The wiring, not the mapping. A `_completeness` nothing calls is exactly
    # the computed-and-unread shape `G3` exists to find, so the assertion is
    # that the key is on the projection the room actually fetches.
    projection = asyncio.run(build_projection(cast(Any, _Memory()), "p1"))

    assert projection["openQuestionsCompleteness"] == {"total": 47, "omitted": 27}
    # The control: the questions themselves still arrive, so a failure above is
    # the counts being dropped rather than the fixture missing the route.
    assert len(projection["openQuestions"]) == 1
