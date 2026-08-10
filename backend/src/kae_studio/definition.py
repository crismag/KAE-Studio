"""What KAE understands about a project, in the shape a person reads it in.

Memory holds knowledge as eight *kinds* — actor, goal, rule, constraint,
requirement, decision, unknown, assumption. A person reads a project as
*sections*: who it is for, what bounds it, what is being assumed. This is the
translation between the two, and it is a declared table rather than a guess.

## Why a table and not a heuristic

D-A ruled that the ten discovery areas and the seven Definition areas both stay,
mapped explicitly, and that **Studio never infers the mapping from field names.**
A heuristic that put `actor` into "stakeholders" because both words suggest
people would work until a kind was renamed, and then fail silently.

So the mapping is data, it carries a version, and every kind Memory can emit
appears in it — mapped to a section or excluded with a reason. A kind that
appears in neither is a test failure, not a statement quietly dropped from the
page.

## The problem statement comes from an area, not from a kind

`goal` fits both `problem_and_value` and `scope_and_boundaries`, so kind alone
cannot say which goal is the problem — and picking the first one would be a
guess rendered as a fact. Which is why `problem` was reported uncomputable until
the knowledge listing began returning each statement's areas.

It joins **every** confirmed statement in that area rather than choosing one.
Choosing is ranking, and ranking is CIE's (ADR-0002); it would also discard the
rest of what a person confirmed.

## Why three sections stay empty

- **value** shares its area with the problem and nothing inside distinguishes
  them, so splitting the statements between the two fields would be a guess
  rendered as a distinction.
- **inScope and outOfScope** need a scope *polarity* nothing records. A
  `decision` may put something in or out and the text does not say which in any
  machine-readable way.
- **workflows** need ordered steps. Memory holds statements, not sequences.

They are reported as unavailable with those reasons rather than returned empty.
An empty list and "we cannot compute this" render identically and mean opposite
things — the first says the project has none, the second says the product
cannot tell. That distinction is the whole reason this module reports instead of
defaulting.
"""

from __future__ import annotations

from typing import Any

#: Bumped when the table below changes, so a stale client can tell.
#:
#: A version on a mapping is not ceremony: this one is expected to move to
#: KAE-Memory's projection when the versioned many-to-many mapping (P.2) lands,
#: and a consumer needs to know which side answered.
MAPPING_VERSION = 1

#: Knowledge kind → the Definition section it belongs in.
#:
#: One section per kind today. The eventual mapping is many-to-many — a
#: `constraint` is arguably both a constraint and a boundary — but a one-to-many
#: table whose consumers were written against one-to-one is worse than a narrow
#: table that says so.
KIND_TO_SECTION: dict[str, str] = {
    "actor": "stakeholders",
    "goal": "objectives",
    "constraint": "constraints",
    "assumption": "assumptions",
}

#: Kinds deliberately absent from the Definition, and why.
#:
#: Stated rather than omitted. "Not in the table" and "excluded on purpose" look
#: identical in code and mean different things to whoever reads it next.
EXCLUDED_KINDS: dict[str, str] = {
    "requirement": (
        "Requirements are their own stage. Definition is what requirements are "
        "derived from, not the catalogue of them."
    ),
    "rule": (
        "A business rule constrains behaviour rather than describing the "
        "project. It belongs to the domain model, which Definition precedes."
    ),
    "decision": (
        "A decision records a choice that was made. Which section it affects "
        "depends on what was decided, and nothing records that."
    ),
    "unknown": (
        "An unknown is a recorded question, not a fact. Listing one among "
        "established statements is what made a confirmed unknown read as an "
        "answer."
    ),
}

#: The area whose statements compose the problem and value sections.
#:
#: Not a guess from kind. `goal` fits both `problem_and_value` and
#: `scope_and_boundaries`, so kind alone cannot say which — this is why the two
#: sections were reported uncomputable until the listing began returning areas.
PROBLEM_AREA = "problem_and_value"

#: Sections that cannot be computed from what Memory exposes, and why.
_UNCOMPUTABLE: dict[str, str] = {

    "inScope": (
        "Scope needs a polarity — in or out — that nothing records. A decision "
        "may set either and the text does not say which."
    ),
    "outOfScope": (
        "Scope needs a polarity — in or out — that nothing records. A decision "
        "may set either and the text does not say which."
    ),
    "workflows": (
        "A workflow is an ordered sequence of steps. Memory holds statements, "
        "not sequences, so there is nothing here to order."
    ),
}


def build_definition(statements: list[dict[str, Any]]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Return the Definition block, and the sections that could not be filled.

    Only **confirmed** statements compose the Definition. A proposed statement
    is KAE's reading of what someone said, and this block is the product's
    answer to "what does my project hold" — putting inference there is precisely
    the failure the founding rule names. Proposed statements are still visible;
    they are visible *as* proposed, elsewhere.

    The unavailable list uses the projection's existing vocabulary, so a section
    nobody can compute reports itself the same way a Memory outage does. Both
    are "we cannot tell you", and the interface should not have two ways to say
    it.
    """

    sections: dict[str, list[dict[str, Any]]] = {
        "objectives": [],
        "stakeholders": [],
        "assumptions": [],
        "constraints": [],
    }

    for statement in statements:
        if statement.get("lifecycle") != "validated":
            continue
        section = KIND_TO_SECTION.get(statement.get("kind", ""))
        if section is None:
            continue
        sections[section].append(
            {
                "id": statement.get("id", ""),
                "text": statement.get("text", ""),
                "status": "confirmed",
            }
        )

    # Every confirmed statement about the problem, joined — not the best one.
    #
    # Choosing *which* of several qualifying statements to show is ranking, and
    # ranking is CIE's (ADR-0002). Picking one here would also throw away the
    # rest of what a person confirmed, which is worse than a longer paragraph.
    #
    # **`value` is computable now** (`RUN-D14`). The area still covers problem
    # *and* value, and Memory now records which claim a statement establishes —
    # so this is a read of what somebody classified rather than the guess it
    # would have been. A statement whose link names no claim stays in `problem`,
    # because that is what an assignment made before claims existed meant and
    # inventing a value statement from it would be exactly the guess this
    # comment used to forbid.
    def _claim(statement: dict[str, Any]) -> str:
        claims = statement.get("claims") or {}
        return str(claims.get(PROBLEM_AREA, "")) if isinstance(claims, dict) else ""

    def _joined(claim: str) -> str:
        """Every qualifying statement, joined — not the best one.

        Choosing which to show is ranking, and ranking is CIE's (ADR-0002).
        """

        return " ".join(
            statement.get("text", "")
            for statement in statements
            if statement.get("lifecycle") == "validated"
            and PROBLEM_AREA in (statement.get("areas") or [])
            and _claim(statement) == claim
        ).strip()

    # Unclaimed statements read as problem statements, which is the reading the
    # area's own name puts first and the one a person would expect.
    problem = " ".join(part for part in (_joined("problem_statement"), _joined("")) if part).strip()
    value = _joined("value_proposition")

    definition: dict[str, Any] = {
        "problem": problem,
        "value": value,
        "objectives": sections["objectives"],
        # Stakeholders carry a name rather than a text, because that is the
        # shape the interface reads. The name *is* the statement: "Ministry
        # leaders submit monthly reports" is what the project knows about them,
        # and shortening it to "Ministry leaders" would discard the part that
        # says why they matter.
        "stakeholders": [
            {"id": entry["id"], "name": entry["text"], "status": "confirmed"}
            for entry in sections["stakeholders"]
        ],
        "inScope": [],
        "outOfScope": [],
        "workflows": [],
        "assumptions": sections["assumptions"],
        "constraints": sections["constraints"],
        "mappingVersion": MAPPING_VERSION,
    }

    unavailable = [
        {"section": f"definition.{name}", "reason": reason}
        for name, reason in _UNCOMPUTABLE.items()
    ]
    return definition, unavailable


__all__ = [
    "EXCLUDED_KINDS",
    "KIND_TO_SECTION",
    "MAPPING_VERSION",
    "build_definition",
]
