"""The second way of losing content survives the hop this repository owns.

`LOSS-COUNT` / `D-232`. KAE-Memory reports loss two ways and keeps them apart on
purpose (`AUD-024`): `abandoned` is content extraction failed on, `not_ingested`
is content it never saw, because a document was truncated at the ingest ceiling
before any run existed. `is_complete` is false if either is positive.

Studio's projection carried three of the five fields and dropped `not_ingested`
and `total`, so the one disclosure in the product that says how much of a project
was never read rendered *"0 of 3 submissions could not be fully read"* in the
exact case it was built for — truncation leaves `abandoned` at zero.

The other half of the fix is that Studio reaches this number **two** ways: this
projection, and `GET /api/projects/{id}/extraction-coverage`. They emitted
different shapes for one TypeScript interface, which is how a field can be
present on one path and missing on the other with no type error anywhere.
"""

from typing import Any

from fastapi.testclient import TestClient

from kae_studio.api import create_app
from kae_studio.config import Settings
from kae_studio.projection import extraction_coverage_view

MEMORY_PAYLOAD = {
    "succeeded": 3,
    "abandoned": 0,
    "not_ingested": 4,
    "total": 7,
    "complete": False,
}


def test_truncated_sections_reach_the_projection() -> None:
    view = extraction_coverage_view(MEMORY_PAYLOAD)

    assert view["notIngested"] == 4
    # Not 3. A denominator excluding the sections nobody read understates the
    # loss it is the denominator for.
    assert view["total"] == 7


def test_the_two_failures_stay_apart() -> None:
    # Summing them would be the conflation `AUD-024` split them to prevent: one
    # is retried, the other needs a bigger ceiling or a smaller document.
    view = extraction_coverage_view({**MEMORY_PAYLOAD, "abandoned": 2, "total": 9})

    assert view["abandoned"] == 2
    assert view["notIngested"] == 4


def test_unreported_figures_are_unknown_and_not_zero() -> None:
    # A Memory older than `AUD-024` sends neither. Reading a missing
    # `not_ingested` as *nothing was truncated* would rebuild the defect with a
    # new field (`D-38`).
    view = extraction_coverage_view({"succeeded": 3, "abandoned": 0, "complete": False})

    assert view["notIngested"] is None
    assert view["total"] is None


def test_a_refusal_reports_no_loss_rather_than_zero_of_everything() -> None:
    # `build_projection` passes `{"complete": True}` when Memory did not answer.
    view = extraction_coverage_view({"complete": True})

    assert view == {
        "succeeded": 0,
        "abandoned": 0,
        "notIngested": None,
        "total": None,
        "complete": True,
    }


def _app() -> TestClient:
    return TestClient(
        create_app(
            Settings.from_environment(
                {
                    "KAE_MEMORY_TOKEN": "token",
                    "STUDIO_SESSION_SECRET": "x" * 40,
                    "STUDIO_NO_AUTH": "1",
                }
            )
        )
    )


def test_both_doors_to_this_number_answer_in_one_shape() -> None:
    """The route and the projection are one mapping, not two agreeing ones.

    One TypeScript interface describes both payloads. While the route passed
    Memory's response through unchanged it emitted `not_ingested`, and the
    projection emitted `notIngested` — so a surface reading the field got it on
    one path and `undefined` on the other, with `tsc` reporting the type
    satisfied on both.
    """

    class Memory:
        async def extraction_coverage(self, project_id: str) -> Any:
            return MEMORY_PAYLOAD

        async def aclose(self) -> None:
            return None

    with _app() as browser:
        browser.app.state.memory = Memory()  # type: ignore[attr-defined]
        served = browser.get("/api/projects/p1/extraction-coverage").json()

    assert served == extraction_coverage_view(MEMORY_PAYLOAD)
    assert "not_ingested" not in served
