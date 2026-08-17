"""An area's weight survives the hop this repository owns.

`COV-UNWEIGHTED` / `D-195`. KAE-Memory serialises `weight` on every readiness
area and `score_areas` is a weighted mean over them, so it is the number
readiness is actually denominated in. Studio's own projection mapped seven of
the eight area fields and dropped this one, which meant no adapter and no
component could read it even in principle — a field lost at an intermediate hop
the estate owns rather than at a boundary it does not.
"""

from typing import Any

from kae_studio.projection import _health


def readiness(**area: Any) -> dict[str, Any]:
    return {
        "percentage": 40,
        "status": "discovering",
        "areas": [
            {
                "key": "functional_requirements",
                "name": "Functional requirements",
                "state": "partial",
                "confirmed_count": 1,
                "proposed_count": 0,
                "minimum_confirmed": 3,
                "mandatory": True,
                "contradicted": False,
                **area,
            }
        ],
    }


def only_area(payload: dict[str, Any]) -> dict[str, Any]:
    return _health(payload)["areas"][0]


def test_weight_reaches_the_projection() -> None:
    assert only_area(readiness(weight=2.0))["weight"] == 2.0


def test_a_weight_memory_did_not_send_is_unknown_and_not_zero() -> None:
    # A Memory too old to say has told us nothing. `0` would read as an area
    # that counts for nothing, which is a weight `AreaResult`'s own invariant
    # forbids — so it can only be a claim Studio invented (`D-38`).
    assert only_area(readiness())["weight"] is None


def test_a_weight_that_is_not_a_positive_number_is_unknown() -> None:
    # Every one of these is a malformed payload rather than a real weight, and
    # each would otherwise become a share of a total on somebody's screen.
    for value in (0, -1.0, "2.0", None, True):
        assert only_area(readiness(weight=value))["weight"] is None, value


def test_the_other_area_fields_are_unchanged() -> None:
    # The field was added beside them, not in place of one. This is the shape
    # of the defect it fixes, so it is worth asserting rather than assuming.
    area = only_area(readiness(weight=1.5))
    assert area == {
        "key": "functional_requirements",
        "name": "Functional requirements",
        "confirmed": 1,
        "proposed": 0,
        "required": 3,
        "state": "partial",
        "mandatory": True,
        "contradicted": False,
        "weight": 1.5,
    }
