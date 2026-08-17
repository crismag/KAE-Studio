"""Which claim a statement establishes survives the hop this repository owns.

`D-224`, and the same shape as `D-195` one field over. KAE-Memory has served
`claims` on every knowledge item since `RUN-D14` — the area link's `claim_key`,
keyed by area, which is the only thing that says whether a `problem_and_value`
statement is the problem or the value. `_statements` copied eight keys and this
was not one of them, so `build_definition` read `{}` for every statement in
existence and `value` was empty by construction on every project.

The consequence was not a blank field. `DefinitionRoom` draws an empty `value`
with `NotEstablished` — *nobody has established this yet* — which is a claim
about the project made from a field Studio dropped in its own middle layer.

Two guards, because the defect had two halves: the field must survive the hop,
and the section must say *we cannot tell you* rather than *there is none* while
nothing has classified anything. The second is what a person actually reads, and
it is true of every deployment today: nothing in KAE-Memory writes `claim_key`.
"""

from typing import Any

from kae_studio.definition import UNCLASSIFIED_VALUE, build_definition
from kae_studio.projection import _statements


def item(**fields: Any) -> dict[str, Any]:
    """A knowledge item as KAE-Memory's listing returns it."""

    return {
        "id": "k-1",
        "current_content": "Deciding once is worth the week it saves.",
        "kind": "goal",
        "lifecycle": "validated",
        "areas": ["problem_and_value"],
        "versions": [],
        **fields,
    }


def only(payload: list[dict[str, Any]]) -> dict[str, Any]:
    return _statements(payload)[0]


class TestTheFieldSurvivesTheHop:
    def test_a_claim_reaches_the_projection(self) -> None:
        claims = {"problem_and_value": "value_proposition"}
        assert only([item(claims=claims)])["claims"] == claims

    def test_a_statement_memory_named_no_claim_for_carries_an_empty_mapping(self) -> None:
        # Absent is a fact about the assignment, not a missing field — the same
        # sentence `KnowledgeResponse.claims` uses. It must not become `None`,
        # because the reader below distinguishes "no claim" from "no field" by
        # asking what is in the mapping.
        assert only([item()])["claims"] == {}

    def test_a_malformed_claims_value_is_an_empty_mapping(self) -> None:
        for value in (None, [], "value_proposition", 0):
            assert only([item(claims=value)])["claims"] == {}, value

    def test_the_field_was_added_beside_the_others_not_in_place_of_one(self) -> None:
        # The shape of the defect it fixes, so it is asserted rather than assumed.
        flattened = only([item(claims={"problem_and_value": "value_proposition"})])
        assert set(flattened) == {
            "id",
            "text",
            "kind",
            "lifecycle",
            "areas",
            "claims",
            "related_group",
            "version",
            "updatedAt",
        }


def statement(claims: dict[str, str] | None = None, **fields: Any) -> dict[str, Any]:
    return {
        "id": "k-1",
        "text": "Deciding once is worth the week it saves.",
        "kind": "goal",
        "lifecycle": "validated",
        "areas": ["problem_and_value"],
        "claims": claims or {},
        **fields,
    }


def unavailable_sections(statements: list[dict[str, Any]]) -> set[str]:
    _definition, unavailable = build_definition(statements)
    return {entry["section"] for entry in unavailable}


class TestAnEmptyValueSaysWhichAbsenceItIs:
    def test_nothing_classified_is_reported_as_unavailable(self) -> None:
        """The state of every project today, and the one that was misdrawn."""

        assert "definition.value" in unavailable_sections([statement()])

    def test_the_reason_names_the_classification_rather_than_the_project(self) -> None:
        _definition, unavailable = build_definition([statement()])
        reason = next(
            entry["reason"] for entry in unavailable if entry["section"] == "definition.value"
        )
        assert reason == UNCLASSIFIED_VALUE
        # A capability note that reads as a statement about the project would be
        # the defect wearing different words.
        assert "classified" in reason

    def test_a_classified_project_with_no_value_statement_is_not_a_capability_gap(self) -> None:
        """Somebody said which is which, and none of them is the value.

        That is a fact about the project, and `NotEstablished` is the true note.
        """

        classified = statement(claims={"problem_and_value": "problem_statement"})
        assert "definition.value" not in unavailable_sections([classified])

    def test_one_classified_statement_is_enough_to_stop_the_note(self) -> None:
        # The condition is "nothing has been classified", not "everything has".
        # A part-classified area is a project mid-review, and reporting a gap
        # there would call a half-finished pass a missing capability.
        assert "definition.value" not in unavailable_sections(
            [statement(claims={"problem_and_value": "problem_statement"}), statement()]
        )

    def test_a_project_with_nothing_in_the_area_is_not_told_we_cannot_tell(self) -> None:
        """With nothing to classify there is nothing we failed to read.

        `NotEstablished` is true here, and a capability note would invent a
        limitation to explain an absence the project itself accounts for.
        """

        assert "definition.value" not in unavailable_sections([statement(areas=[])])
        assert "definition.value" not in unavailable_sections([])

    def test_only_validated_statements_count_as_classified(self) -> None:
        # A proposed statement is KAE's reading and composes no part of the
        # Definition, so it can neither supply a claim nor withhold one.
        proposed = statement(
            lifecycle="proposed", claims={"problem_and_value": "value_proposition"}
        )
        assert "definition.value" in unavailable_sections([proposed, statement()])

    def test_the_value_the_claim_carries_still_reaches_the_field(self) -> None:
        # The note must not have replaced the computation it stands in for.
        definition, unavailable = build_definition(
            [statement(claims={"problem_and_value": "value_proposition"})]
        )
        assert definition["value"] == "Deciding once is worth the week it saves."
        assert "definition.value" not in {entry["section"] for entry in unavailable}
