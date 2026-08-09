"""What KAE understands, in the shape a person reads it in.

`liveServices` hard-coded this block empty, so Definition rendered as a blank
page for every project regardless of what Memory held (DEF-1.3). The fix is not
"fill it with something" — several sections genuinely cannot be computed from
what Memory exposes per item, and the difference between "your project has none"
and "we cannot tell" is the difference this product sells.

So these tests are mostly about honesty: what gets filled, what is declared
uncomputable and why, and what is deliberately excluded.
"""

from __future__ import annotations

import pytest

from kae_studio.definition import (
    EXCLUDED_KINDS,
    KIND_TO_SECTION,
    MAPPING_VERSION,
    build_definition,
)

#: Memory's authoritative vocabulary, `KnowledgeKind` in kae_memory.domain.models.
#:
#: Copied rather than imported: Studio must not depend on Memory's Python
#: package, and the copy is what the drift test below exists to catch.
MEMORY_KINDS = {
    "actor",
    "goal",
    "rule",
    "constraint",
    "requirement",
    "decision",
    "unknown",
    "assumption",
}


def statement(kind: str, text: str, lifecycle: str = "validated") -> dict[str, object]:
    return {"id": f"k-{kind}-{abs(hash(text)) % 1000}", "text": text, "kind": kind,
            "lifecycle": lifecycle, "version": 1}


class TestTheMappingIsDeclared:
    """D-A: Studio never infers the mapping from field names."""

    def test_every_kind_memory_can_emit_is_accounted_for(self) -> None:
        """Mapped or excluded — never merely absent.

        A kind in neither table is a statement silently dropped from the page,
        which is indistinguishable from a project that does not hold one.
        """

        accounted = set(KIND_TO_SECTION) | set(EXCLUDED_KINDS)
        assert MEMORY_KINDS - accounted == set(), "a kind reaches the page or says why not"
        assert accounted - MEMORY_KINDS == set(), "the table names a kind Memory cannot emit"

    def test_an_exclusion_carries_its_reason(self) -> None:
        for kind, reason in EXCLUDED_KINDS.items():
            assert len(reason) > 40, f"{kind} is excluded without saying why"

    def test_the_mapping_is_versioned(self) -> None:
        """It is expected to move to Memory's projection (P.2).

        A consumer needs to know which side answered, and when the answer
        changed shape.
        """

        assert MAPPING_VERSION >= 1
        definition, _ = build_definition([])
        assert definition["mappingVersion"] == MAPPING_VERSION


class TestWhatItFills:
    def test_confirmed_statements_reach_their_section(self) -> None:
        definition, _ = build_definition(
            [
                statement("actor", "Ministry leaders submit monthly reports."),
                statement("goal", "Reports are published within a week."),
                statement("constraint", "The team is three people."),
                statement("assumption", "Approval happens before publication."),
            ]
        )

        assert [s["name"] for s in definition["stakeholders"]] == [
            "Ministry leaders submit monthly reports."
        ]
        assert [s["text"] for s in definition["objectives"]] == [
            "Reports are published within a week."
        ]
        assert [s["text"] for s in definition["constraints"]] == ["The team is three people."]
        assert [s["text"] for s in definition["assumptions"]] == [
            "Approval happens before publication."
        ]

    def test_a_stakeholder_keeps_the_whole_statement(self) -> None:
        """"Ministry leaders" alone discards the part that says why they matter."""

        definition, _ = build_definition(
            [statement("actor", "Ministry leaders submit monthly reports.")]
        )

        assert definition["stakeholders"][0]["name"] == "Ministry leaders submit monthly reports."

    @pytest.mark.parametrize("lifecycle", ["proposed", "rejected", "superseded"])
    def test_only_confirmed_knowledge_composes_the_definition(self, lifecycle: str) -> None:
        """This block answers "what does my project hold".

        A proposed statement is KAE's reading of what someone said. Putting
        inference here is the founding failure — and it is why the same
        statement is still visible elsewhere, *as* proposed.
        """

        definition, _ = build_definition(
            [statement("goal", "Something KAE inferred.", lifecycle=lifecycle)]
        )

        assert definition["objectives"] == []

    @pytest.mark.parametrize("kind", sorted(EXCLUDED_KINDS))
    def test_an_excluded_kind_reaches_no_section(self, kind: str) -> None:
        definition, _ = build_definition([statement(kind, "Text of an excluded kind.")])

        filled = [
            name
            for name in ("objectives", "stakeholders", "assumptions", "constraints")
            if definition[name]
        ]
        assert filled == []


class TestWhatItRefusesToInvent:
    """An empty list and "we cannot compute this" mean opposite things."""

    def test_the_sections_nothing_can_fill_report_themselves(self) -> None:
        _definition, unavailable = build_definition(
            [statement("goal", "Reports are published within a week.")]
        )

        sections = {entry["section"] for entry in unavailable}
        assert sections == {
            "definition.problem",
            "definition.value",
            "definition.inScope",
            "definition.outOfScope",
            "definition.workflows",
        }

    def test_each_says_why_in_a_sentence_a_person_could_read(self) -> None:
        _definition, unavailable = build_definition([])

        for entry in unavailable:
            assert len(entry["reason"]) > 60, entry["section"]

    def test_the_problem_statement_is_never_guessed_from_a_goal(self) -> None:
        """The most tempting guess, and the one that would read as a fact.

        Picking the first goal and calling it the problem statement would put a
        sentence nobody wrote at the top of the page a user checks KAE's
        understanding against.
        """

        definition, _ = build_definition(
            [
                statement("goal", "Reports are published within a week."),
                statement("goal", "Nothing is lost between submission and approval."),
            ]
        )

        assert definition["problem"] == ""
        assert definition["value"] == ""
