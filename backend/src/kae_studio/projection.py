"""Assembling what the workspace renders, from what Memory actually holds.

The prototype's `ProjectProjection` was designed against fixtures, so it assumes
a richer model than Memory exposes over HTTP today. This builds every part that
maps and **marks the rest unavailable with a reason**, rather than returning
empty collections that would read as "this project has none of that".

That distinction is the whole reason this file is careful. An empty
`requirements: []` says the project has no requirements. A section marked
unavailable says Studio could not ask. Those are different facts and a person
reading the screen will act differently on each.
"""

from __future__ import annotations

import asyncio
from typing import Any

from .memory_client import MODULE_GAP, CapabilityGap, MemoryClient, MemoryRefused


async def _safe(coro: Any) -> tuple[Any, str | None]:
    """Run one Memory call, returning its result or why it did not answer.

    A projection is several calls, and one refusal must not blank the page.
    Reported per section so a reader can see which part is missing.
    """

    try:
        return await coro, None
    except MemoryRefused as error:
        return None, f"{error.status_code}: {error.detail[:160]}"
    except Exception as error:  # noqa: BLE001 - reported, never swallowed
        return None, str(error)[:160]


async def build_projection(memory: MemoryClient, project_id: str) -> dict[str, Any]:
    """Compose the workspace projection for one project."""

    project, readiness, knowledge, clarifications, blockers, preliminary = await asyncio.gather(
        _safe(memory.get_project(project_id)),
        _safe(memory.readiness(project_id)),
        _safe(memory.knowledge(project_id)),
        _safe(memory.clarifications(project_id)),
        _safe(memory.blockers(project_id)),
        _safe(memory.preliminary_context(project_id)),
    )

    unavailable: list[dict[str, str]] = []

    def section(name: str, pair: tuple[Any, str | None], default: Any) -> Any:
        value, problem = pair
        if problem is not None:
            unavailable.append({"section": name, "reason": problem})
            return default
        return value if value is not None else default

    project_data = section("project", project, {})
    readiness_data = section("readiness", readiness, {})
    knowledge_data = section("knowledge", knowledge, {})
    clarification_data = section("clarifications", clarifications, {})
    blocker_data = section("blockers", blockers, {})
    preliminary_data = section("preliminary_context", preliminary, {})

    statements = _statements(knowledge_data)

    return {
        "project": {
            "id": project_data.get("id", project_id),
            "name": project_data.get("name", ""),
            "phase": project_data.get("status", "active"),
            "memoryRevision": readiness_data.get("knowledge_revision", 0),
            "createdAt": project_data.get("created_at", ""),
        },
        # Split by lifecycle rather than merged with a label. A reader scanning
        # a list reads structure before badges, and confirmed and proposed
        # statements carry different weight in every decision they inform.
        "confirmed": [s for s in statements if s["lifecycle"] == "validated"],
        # Not simply "everything that is not validated". A rejected statement is
        # already decided, and returning it here put it back on the review page
        # to be judged again — the one outcome a review surface must never
        # produce. Memory keeps rejected items for provenance; that is a reason
        # to retain them, not to re-ask about them.
        "proposed": [s for s in statements if s["lifecycle"] not in _DECIDED],
        # Kept out of review and still visible. Memory retains a rejected item
        # for provenance, and hiding it from Studio entirely made "what did we
        # decide against, and is it back?" unanswerable from the product — which
        # is most of what a review surface is for.
        "rejected": [s for s in statements if s["lifecycle"] == "rejected"],
        "health": _health(readiness_data),
        "openQuestions": _questions(clarification_data),
        "blockers": _listing(blocker_data),
        # A count, not a list: Memory exposes recording and resolving a
        # contradiction over HTTP and no way to enumerate them. Saying so beats
        # an empty array, which would read as "none".
        "contradictions": {
            "count": readiness_data.get("unresolved_contradiction_count", 0)
            if isinstance(readiness_data, dict)
            else 0,
            "listable": False,
            "reason": "KAE-Memory exposes contradictions for recording and resolving, not listing.",
        },
        "preliminary": {
            "isPreliminary": preliminary_data.get("is_preliminary"),
            "statedVerbatim": preliminary_data.get("stated_verbatim", []),
            "assumed": preliminary_data.get("assumed", []),
            "materialUnknowns": preliminary_data.get("material_unknowns", []),
            "warnings": preliminary_data.get("warnings", []),
        },
        # Named rather than absent. The UI has a Modules route, and it must show
        # why the view is empty instead of implying the project has none.
        "modules": {"available": False, "gap": _gap(MODULE_GAP)},
        "unavailable": unavailable,
    }


def _items(payload: Any) -> list[Any]:
    """Normalise Memory's two collection shapes into one list.

    Some routes return a bare array (`/v1/projects`, `/v1/.../knowledge`) and
    some return the ADR-0021 wrapper with `results` beside `total` and `cursor`.
    Both are correct for what they are — a paged read needs the envelope and an
    unpaged one does not — so this reads either rather than each call site
    guessing, which is how a bare list met `.get` and produced a 500.
    """

    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "items", "questions"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _gap(gap: CapabilityGap) -> dict[str, str]:
    return {"capability": gap.capability, "reason": gap.reason, "reachableBy": gap.reachable_by}


#: Lifecycles a person has already ruled on, or that Memory has retired. None of
#: them belongs on a review surface: the question they answer is closed.
_DECIDED = frozenset({"validated", "rejected", "superseded", "retracted"})


def _statements(payload: Any) -> list[dict[str, Any]]:
    """Flatten Memory's knowledge listing into what a list view needs."""

    flattened = []
    for item in _items(payload):
        if not isinstance(item, dict):
            continue
        flattened.append(
            {
                "id": item.get("id") or item.get("knowledge_id", ""),
                # `current_content` is the field Memory returns; `content`
                # appears only inside `versions[]`. Reading the wrong one gave
                # every statement an empty body while the list length was right.
                "text": item.get("current_content") or item.get("content") or item.get("text", ""),
                "kind": item.get("kind", ""),
                "lifecycle": item.get("lifecycle", ""),
                # Like the timestamp, the number lives on the version, not the
                # item. Defaulting to 1 made every reject claim to have seen the
                # first wording, which is the opposite of what the check is for.
                "version": _version_number(item),
                # Memory carries the timestamp on the version, not the item: a
                # statement's identity is older than its current wording, and
                # the date a reader wants is when this wording was recorded.
                "updatedAt": _recorded_at(item),
            }
        )
    return flattened


def _version_number(item: dict[str, Any]) -> int:
    """The current version number, for optimistic concurrency on review.

    Memory refuses a rejection that names a version other than the current one,
    so that a reviewer cannot reject wording they never read. Sending a guess
    would defeat exactly that.
    """

    versions = item.get("versions")
    if isinstance(versions, list) and versions:
        latest = versions[-1]
        if isinstance(latest, dict) and isinstance(latest.get("number"), int):
            return int(latest["number"])
    fallback = item.get("version") or item.get("current_version")
    return int(fallback) if isinstance(fallback, int) else 1


def _recorded_at(item: dict[str, Any]) -> str:
    """When the current wording was recorded, or empty if Memory did not say.

    Empty rather than a fabricated `now`: a display that invents a timestamp is
    lying about provenance, and provenance is most of what this product sells.
    The UI renders an unknown date as unknown.
    """

    versions = item.get("versions")
    if isinstance(versions, list) and versions:
        latest = versions[-1]
        if isinstance(latest, dict):
            return str(latest.get("recorded_at") or "")
    return str(item.get("updated_at") or item.get("recorded_at") or "")


def _health(readiness: Any) -> dict[str, Any]:
    """Readiness as the UI shows it — advisory, and labelled as such.

    `percentage` travels with the word "advisory" deliberately. Every version of
    this product that showed a bare number had someone read it as a gate, which
    is the one thing KAE's readiness model is built not to be.
    """

    areas = readiness.get("areas", []) if isinstance(readiness, dict) else []
    return {
        "percentage": readiness.get("percentage", 0) if isinstance(readiness, dict) else 0,
        "advisory": True,
        "status": readiness.get("status", "unknown") if isinstance(readiness, dict) else "unknown",
        "areas": [
            {
                "key": a.get("area_key", ""),
                "name": a.get("name", ""),
                "confirmed": a.get("confirmed_count", 0),
                "satisfied": a.get("satisfied", False),
            }
            for a in areas
            if isinstance(a, dict)
        ],
    }


def _questions(payload: Any) -> list[dict[str, Any]]:
    return [
        {
            "id": q.get("clarification_id", ""),
            "question": q.get("question", ""),
            "severity": q.get("severity", ""),
            "area": q.get("area_key"),
            "disposition": q.get("disposition", "open"),
        }
        for q in _items(payload)
        if isinstance(q, dict)
    ]


def _listing(payload: Any) -> list[dict[str, Any]]:
    return [entry for entry in _items(payload) if isinstance(entry, dict)]
