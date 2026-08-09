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

## Why several sections stay empty

`problem`, `value`, `inScope`, `outOfScope` and `workflows` cannot be filled
from kind alone.

- **problem and value** need to know which statements belong to
  `problem_and_value`, and that is an *area* classification. Memory's knowledge
  listing returns kind and lifecycle; it does not return area links per item.
  Picking the first `goal` and calling it the problem statement would be a
  guess rendered as a fact.
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

#: Sections that cannot be computed from what Memory exposes, and why.
_UNCOMPUTABLE: dict[str, str] = {
    "problem": (
        "The problem statement is the project's `problem_and_value` knowledge, "
        "and Memory's knowledge listing does not return area links per item. "
        "Choosing a goal statement to stand for it would be a guess shown as a "
        "fact."
    ),
    "value": (
        "Same as the problem statement: it needs area classification, which is "
        "not on this response."
    ),
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

    definition: dict[str, Any] = {
        "problem": "",
        "value": "",
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
