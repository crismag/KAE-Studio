"""An assembled Memory context, as KAE-Artifacts generation input.

The join between two systems that deliberately do not know about each other.
Memory assembles what a project knows, pinned to a revision; KAE-Artifacts reads
a provider-neutral structure. This is the twenty lines in between, and it lives
in Studio because Studio is the one component that talks to both.

## Why the mapping is not a rename

Three decisions are taken here, and each could be got wrong quietly.

**Lifecycle to confidence.** Memory's `validated` is KAE-Artifacts' `confirmed`.
Anything unrecognised becomes `proposed` — the *weaker* claim — because a
generator that renders an unknown state as settled fact produces a document a
reader acts on. Memory will add lifecycle states this mapping has not seen, and
the default has to be safe rather than convenient.

**The revision is a real pin.** `memory:281` names the knowledge revision the
assembly read. KAE-Artifacts digests the input itself as well, so a package can
prove *which bytes* produced it and not merely which label somebody passed.

**Unresolved gaps become open questions.** Memory's critical gaps travel into
the generated documents rather than being dropped. A development context that
reads as complete when it is not is how an agent chooses on the project's
behalf — silently, and once.
"""

from __future__ import annotations

from typing import Any

#: Memory lifecycle → what a generator may claim. Absent means `proposed`.
_CONFIDENCE = {
    "validated": "confirmed",
    "confirmed": "confirmed",
    "accepted": "confirmed",
    "proposed": "proposed",
    "superseded": "proposed",
    "rejected": "proposed",
}


class ContextNotUsable(ValueError):
    """An assembled context that cannot become generation input.

    Raised with the missing field named. A Memory schema change should produce
    one diagnosable failure here rather than a package whose provenance is
    quietly wrong.
    """


def to_generation_input(context: dict[str, Any], project_name: str = "") -> dict[str, Any]:
    """Convert `GET /v1/projects/{id}/context` into KAE-Artifacts input."""

    manifest = context.get("manifest")
    if not isinstance(manifest, dict):
        raise ContextNotUsable(
            "the assembled context has no manifest. Without one there is no "
            "revision to pin generated files to."
        )

    project_id = str(manifest.get("project_id", "")).strip()
    revision = manifest.get("knowledge_revision")
    if not project_id or revision is None:
        raise ContextNotUsable(
            "the assembled context is missing a project id or knowledge revision. "
            "Generating from it would produce artifacts nobody could trace back "
            "to a project or a moment."
        )

    statements: list[dict[str, Any]] = []
    for section in context.get("sections", []):
        area = str(section.get("area", ""))
        for statement in section.get("statements", []):
            text = str(statement.get("text", "")).strip()
            if not text:
                continue
            lifecycle = str(statement.get("lifecycle", "proposed")).lower()
            statements.append(
                {
                    "text": text,
                    "kind": str(statement.get("kind", "unknown")),
                    "confidence": _CONFIDENCE.get(lifecycle, "proposed"),
                    "area": area,
                    # A reference, not a copy. An artifact that embedded its
                    # evidence would restate what Memory already holds, and
                    # would go stale the moment Memory corrected it.
                    "evidence_refs": [str(statement.get("knowledge_id", ""))],
                }
            )

    open_questions = [
        {
            "question": str(gap.get("summary", "")).strip(),
            "area": str(gap.get("area_key", "")),
            "blocks": str(gap.get("area_key", "")),
        }
        for gap in manifest.get("unresolved_critical_gaps", [])
        if str(gap.get("summary", "")).strip()
    ]

    return {
        "subject_id": project_id,
        "subject_name": project_name or project_id,
        "input_revision": f"memory:{revision}",
        "summary": _summary(manifest),
        "statements": statements,
        "open_questions": open_questions,
        # The content hash is Memory's own fingerprint of what it assembled.
        # Carried so a package's provenance can be checked against Memory
        # without re-reading every statement.
        "source_references": [f"memory:content_hash:{manifest.get('content_hash', '')}"],
        "options": {},
    }


def _summary(manifest: dict[str, Any]) -> str:
    """A factual line about the assembly, not a description of the product.

    Memory does not return a prose summary, and inventing one here would put
    Studio's words into a document attributed to the project. Stating what the
    assembly contained is true, useful, and clearly not a claim about the
    software.
    """

    state = manifest.get("confirmation_state", {})
    confirmed = state.get("confirmed", 0) if isinstance(state, dict) else 0
    total = manifest.get("statement_count", 0)
    purpose = manifest.get("purpose", "implementation")
    return (
        f"Assembled from KAE-Memory for {purpose}: {total} statement(s), "
        f"{confirmed} confirmed."
    )


__all__ = ["ContextNotUsable", "to_generation_input"]
