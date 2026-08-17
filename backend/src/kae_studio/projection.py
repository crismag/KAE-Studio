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

from .definition import build_definition
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


def extraction_coverage_view(payload: Any) -> dict[str, Any]:
    """Memory's coverage figures in the shape Studio's surfaces read.

    Studio reaches this number two ways — inside the projection, and through
    `GET /api/projects/{id}/extraction-coverage`. They emitted different shapes
    for one TypeScript interface, which is how a field can be present on one
    path and absent on the other while `tsc` reports the type satisfied. Both
    doors call this, so they cannot disagree (`D-232`).

    `notIngested` and `total` are `None` when the backend did not send them.
    A Memory older than `AUD-024` reports neither, and reading a missing
    `not_ingested` as *nothing was truncated* would rebuild the defect this
    exists to fix with a new field (`D-38`).
    """

    data = payload if isinstance(payload, dict) else {}
    not_ingested = data.get("not_ingested")
    total = data.get("total")
    return {
        "succeeded": data.get("succeeded", 0),
        "abandoned": data.get("abandoned", 0),
        # A different failure from `abandoned`, and kept apart for that reason:
        # extraction failed on this content, versus it never saw it (AUD-024).
        "notIngested": not_ingested if isinstance(not_ingested, int) else None,
        "total": total if isinstance(total, int) else None,
        "complete": data.get("complete", True),
    }


async def build_projection(memory: MemoryClient, project_id: str) -> dict[str, Any]:
    """Compose the workspace projection for one project."""

    (
        project,
        readiness,
        knowledge,
        clarifications,
        blockers,
        preliminary,
        coverage,
        graph,
        review,
    ) = await asyncio.gather(
        _safe(memory.get_project(project_id)),
        _safe(memory.readiness(project_id)),
        _safe(memory.knowledge(project_id)),
        # Candidates, not clarifications: displaying what could be asked must
        # not ask it. This called the materialising endpoint, so every
        # projection read — every page load — wrote up to twenty questions
        # into the transcript (issue #3, PPA-02/03).
        _safe(memory.clarification_candidates(project_id)),
        _safe(memory.blockers(project_id)),
        _safe(memory.preliminary_context(project_id)),
        _safe(memory.extraction_coverage(project_id)),
        _safe(memory.module_graph(project_id)),
        _safe(memory.review(project_id)),
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
    # Defaults to complete when the section is unavailable. A Memory too old to
    # answer has told us nothing about loss, and rendering "content may be
    # missing" on that basis would be a warning derived from our own ignorance.
    coverage_data = section("extraction_coverage", coverage, {"complete": True})

    statements = _statements(knowledge_data)
    # Built from confirmed knowledge, with the sections nothing can compute
    # declared rather than returned empty. See `definition.py` for why several
    # of them cannot be filled from what Memory exposes per item.
    definition, definition_gaps = build_definition(statements)
    unavailable.extend(definition_gaps)

    return {
        "project": {
            "id": project_data.get("id", project_id),
            "name": project_data.get("name", ""),
            "phase": project_data.get("status", "active"),
            # The project's revision *now* (EM-1), not the readiness snapshot's.
            #
            # This read `readiness.knowledge_revision`, which records the
            # revision readiness was last *calculated at* — so the footer showed
            # a number that stopped moving whenever readiness stopped being
            # recalculated, and showed 0 for a project whose readiness had never
            # been calculated at all. `current_knowledge_revision` is the
            # project's, and the project payload carries it too.
            #
            # `None` rather than 0 when neither is present: this Studio may run
            # against a Memory older than EM-1, and 0 is a real revision meaning
            # "nothing written yet". A default that renders identically to a
            # fact is how the previous version stayed wrong for so long.
            "memoryRevision": _revision(project_data, readiness_data),
            "createdAt": project_data.get("created_at", ""),
        },
        # Split by lifecycle rather than merged with a label. A reader scanning
        # a list reads structure before badges, and confirmed and proposed
        # statements carry different weight in every decision they inform.
        # What the project holds, in the shape a person reads it in. Confirmed
        # statements only: this block answers "what does my project hold", and
        # putting KAE's unconfirmed reading there is the founding failure.
        "definition": definition,
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
        # The other half of the question `rejected` is kept for. That one
        # answers *what did we decide against, and is it back?*; this answers
        # **what did we replace, and with what?** (`D-34`).
        #
        # `superseded` is in `_DECIDED`, so it was in neither `proposed` nor
        # `confirmed` nor `rejected` — it reached no collection at all and the
        # adapter never saw it. The contract requires the lifecycle survive
        # presentation, and a statement that vanishes has not survived it.
        "superseded": [s for s in statements if s["lifecycle"] == "superseded"],
        "health": _health(readiness_data),
        # How the number was reached, beside the number. Memory computes this
        # carefully (`AUD-025`, `AUD-026`, `AUD-039`) and Studio dropped it, so
        # a percentage produced by the 16% offline ceiling — or by no review at
        # all — read exactly like one a model produced.
        "classification": _classification(readiness_data),
        # Beside the health percentage, never inside it. `PLANNING_MODEL.md`:
        # content loss is reported separately and never folded in, because a
        # percentage computed over content that was never captured is a
        # confident lie.
        "extractionCoverage": extraction_coverage_view(coverage_data),
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
        # Six collections KAE-Memory keeps deliberately apart, carried apart.
        #
        # Its own words: *"known, proposed, assumed and unknown are four
        # separate collections and never merge."* Nothing here summarises,
        # counts, or folds them, because the distinction between what a person
        # said, what KAE inferred, and what nobody has decided is the entire
        # value of the section (`D-18`).
        #
        # `known` and `proposed` are deliberately **not** carried: the same
        # statements already reach the reader through `confirmed`/`proposed`
        # above, and two paths to one set of statements is two things to keep
        # in agreement forever.
        "preliminary": {
            "isPreliminary": preliminary_data.get("is_preliminary"),
            "statedVerbatim": preliminary_data.get("stated_verbatim", []),
            "assumed": preliminary_data.get("assumed", []),
            "materialUnknowns": preliminary_data.get("material_unknowns", []),
            # Carried, because *not now* is an answer and an unrendered
            # deferrable unknown is one KAE has silently dropped.
            "deferrableUnknowns": preliminary_data.get("deferrable_unknowns", []),
            "warnings": preliminary_data.get("warnings", []),
            # Whether this section was composed at all. `False` because a
            # Memory that did not answer has told us nothing, and a section
            # rendering as "nothing preliminary here" on that basis would be a
            # reassurance derived from our own ignorance.
            "composed": bool(preliminary_data),
        },
        # **Curation**, and still unavailable. Proposing a module or drawing
        # an edge is KAE-Memory's MCP write path; Studio has no contract for
        # it, and the Modules route must keep saying so rather than rendering
        # an empty curation view.
        "modules": {"available": False, "gap": _gap(MODULE_GAP)},
        # **Reading** the architecture, which is new (`D-19`) and is a
        # different capability from curating it. Kept as its own key precisely
        # so the two cannot be confused: a project whose architecture is
        # readable is not a project whose modules can be edited.
        "architecture": _architecture(graph),
        # The review KAE-Memory computes, which nothing called (`D-30`). Its
        # eight finding kinds are a diagnostic; the proposal list above is a
        # gesture surface, and they are carried apart because folding them
        # together would dress "this area is empty" up as something to click
        # yes on.
        "review": _review(review),
        "unavailable": unavailable,
    }


def _review(pair: tuple[Any, str | None]) -> dict[str, Any]:
    """Quality findings, or why they could not be read.

    `recommended_action` is carried verbatim. Memory writes a sentence saying
    what would make each finding disappear, and a paraphrase would be advice
    nobody can follow.
    """

    payload, problem = pair
    if problem is not None or not isinstance(payload, dict):
        return {
            "available": False,
            # A review that could not be computed is not a project with nothing
            # wrong, and an empty list would say the second.
            "reason": problem or "KAE-Memory returned no review.",
            "findings": [],
        }

    return {
        "available": True,
        "reason": "",
        # Memory's order, kept. It sorts most severe first and that is the
        # reason it bothers to sort.
        "findings": [
            {
                "kind": finding.get("kind", ""),
                "severity": finding.get("severity", ""),
                "summary": finding.get("summary", ""),
                "recommendedAction": finding.get("recommended_action", ""),
                "areaKey": finding.get("area_key"),
                "subjectKey": finding.get("subject_key", ""),
                # Which statements the finding is about. Dropped in `D-30`, so
                # a contradiction arrived as "two knowledge items contradict
                # each other" with a recommended action to supersede one of
                # them and no way to tell which (`D-37`).
                "knowledgeItemIds": [
                    str(identifier)
                    for identifier in finding.get("knowledge_item_ids", [])
                    if str(identifier)
                ],
            }
            for finding in payload.get("findings", [])
            if isinstance(finding, dict)
        ],
    }


def _architecture(pair: tuple[Any, str | None]) -> dict[str, Any]:
    """The module graph as read, or why it could not be read.

    Kept apart from `unavailable` because the two say different things to a
    surface. `unavailable` means *this section of the projection failed*; this
    means *the architecture view has nothing to draw*, and the page has to
    render its own answer either way.

    What arrives is what KAE-Memory holds — a key, a name, a summary, a status,
    and the edges between them. Deliberately **not** mapped into Studio's rich
    `ProjectModule`, whose responsibilities, interfaces and data references
    nothing derives: filling those with empty arrays would render as a module
    that has no responsibilities rather than one nobody has described.
    """

    payload, problem = pair
    if problem is not None or not isinstance(payload, dict):
        return {
            "available": False,
            "reason": problem or "KAE-Memory returned no module graph.",
            "modules": [],
            "edges": [],
            "buildOrder": [],
            "note": "",
        }

    return {
        "available": True,
        "reason": "",
        "modules": [
            {
                "key": module.get("key", ""),
                "name": module.get("name", ""),
                "summary": module.get("summary", ""),
                "status": module.get("status", ""),
            }
            for module in payload.get("modules", [])
            if isinstance(module, dict)
        ],
        "edges": [
            {
                "source": edge.get("source", ""),
                "relation": edge.get("relation", ""),
                "targetModule": edge.get("target_module"),
                "targetKnowledge": edge.get("target_knowledge"),
            }
            for edge in payload.get("edges", [])
            if isinstance(edge, dict)
        ],
        "buildOrder": [key for key in payload.get("build_order", []) if isinstance(key, str)],
        "note": payload.get("note", ""),
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
        # `candidates` for the observational clarification listing, which
        # returns its own envelope.
        for key in ("results", "items", "questions", "candidates"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _gap(gap: CapabilityGap) -> dict[str, str]:
    return {"capability": gap.capability, "reason": gap.reason, "reachableBy": gap.reachable_by}


#: Lifecycles a person has already ruled on, or that Memory has retired. None of
#: them belongs on a review surface: the question they answer is closed.
_DECIDED = frozenset({"validated", "rejected", "superseded", "retracted"})


def _revision(project_data: dict[str, Any], readiness_data: dict[str, Any]) -> int | None:
    """The project's current knowledge revision, or `None` if unreported."""

    for source, key in (
        (project_data, "knowledge_revision"),
        (readiness_data, "current_knowledge_revision"),
    ):
        value = source.get(key)
        if isinstance(value, int):
            return value
    return None


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
                # What this statement is about. Memory always held it; the
                # listing started returning it, which is what lets Definition
                # show a problem statement at all.
                "areas": list(item.get("areas") or []),
                # Which claim inside an area this statement establishes, keyed
                # by area. Memory has served it since `RUN-D14`; this hop did
                # not copy it, so Definition read `{}` for every statement in
                # existence and reported every project as having no value
                # proposition (`D-224`).
                "claims": _claims(item),
                # Which statements say adjacent things (`ES-5`, `PPA-15`).
                # Carried, never acted on: Studio groups them for reading and
                # merges nothing, because `EM-3`'s ruling on unattended merging
                # is open and grouping does not need it answered.
                "related_group": item.get("related_group"),
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


def _claims(item: dict[str, Any]) -> dict[str, str]:
    """Which claim this statement establishes, per area.

    Anything that is not a mapping is no claim at all rather than an error: the
    reader downstream distinguishes *nobody classified this* from *classified as
    something else*, and a malformed payload is the first of the two.
    """

    claims = item.get("claims")
    if not isinstance(claims, dict):
        return {}
    return {str(area): str(claim) for area, claim in claims.items()}


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


def _classification(readiness: Any) -> dict[str, Any]:
    """How this project's knowledge reached its areas, if it ever did.

    `engine: null` is the state that matters most and the one a bare percentage
    hides: **no review has run**, so no statement is in any area and the number
    is 0 whatever the project holds. On the deployed system that described the
    acceptance project exactly — five successful extraction runs, no review runs
    (`AUD-041`).

    Passed through rather than summarised. `note` is Memory's sentence about its
    own limits, and a client that rewrote it would be deciding how alarmed to
    be on the reader's behalf.
    """

    payload = readiness.get("classification") if isinstance(readiness, dict) else None
    if not isinstance(payload, dict):
        # A Memory older than the classification block tells us nothing about
        # how it classified. `unknown` says that; `null` would claim the
        # stronger thing, that no review has run.
        return {"engine": "unknown", "degraded": False, "note": "", "reviewedAt": None}
    return {
        "engine": payload.get("engine"),
        "degraded": bool(payload.get("degraded", False)),
        "note": payload.get("note", ""),
        "reviewedAt": payload.get("reviewed_at"),
    }


def _positive_weight(value: Any) -> float | None:
    """Return a readiness area's weight, or `None` when Memory did not say.

    Only a positive number is a weight — `AreaResult.__post_init__` refuses
    anything else — so a missing, malformed or non-positive value is *unknown*
    and never `0`, which would read as an area that counts for nothing.
    """

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if value > 0 else None


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
        # What this project is *fit for*, which is the pair Memory computes and
        # nothing here carried (`D-33`). Two facts, never one score: "enough to
        # draft from" and "safe to build from" answer different questions, and
        # a single "ready" collapses the distinction the readiness model exists
        # to draw.
        #
        # Absent reads as **not** eligible. A Memory too old to send these has
        # told us nothing, and the direction that costs somebody a generated
        # package is better than the one that costs them a package they trusted.
        "draftEligible": bool(readiness.get("draft_eligible"))
        if isinstance(readiness, dict)
        else False,
        "implementationEligible": bool(readiness.get("implementation_eligible"))
        if isinstance(readiness, dict)
        else False,
        # Memory's field names, read correctly. These were `area_key` and
        # `satisfied`, which exist in neither payload — so every area arrived
        # with an empty key and was permanently unsatisfied, and nothing noticed
        # because an empty string and a false render as plausibly as real values.
        #
        # `minimum_confirmed` is what makes an area's state explicable rather
        # than merely coloured: "one confirmed item, two needed" is a sentence a
        # person can act on, and dropping it left the UI able to say only that
        # something was incomplete.
        # `weight` is what readiness is actually denominated in — `score_areas`
        # is a weighted mean, and the shipped areas carry 1.0, 1.5 and 2.0 — so
        # dropping it here left every surface able to count areas and unable to
        # say that covering one moves readiness twice as far as covering
        # another (`D-195`). Absent stays `None`: a Memory too old to send it
        # has said nothing, and `0` is a weight `AreaResult`'s own invariant
        # forbids.
        "areas": [
            {
                "key": a.get("key", ""),
                "name": a.get("name", ""),
                "confirmed": a.get("confirmed_count", 0),
                "proposed": a.get("proposed_count", 0),
                "required": a.get("minimum_confirmed", 0),
                "state": a.get("state", ""),
                "mandatory": a.get("mandatory", False),
                "contradicted": a.get("contradicted", False),
                "weight": _positive_weight(a.get("weight")),
            }
            for a in areas
            if isinstance(a, dict)
        ],
    }


def _questions(payload: Any) -> list[dict[str, Any]]:
    """Map candidates, and say which of them anybody has actually been asked.

    `id` is the message id when a question was put to somebody, and the
    deterministic candidate key when it was not. Both identify the same
    unknown; only one of them can be answered, and a consumer that cannot tell
    them apart would offer an answer control for a question nobody has seen.
    """

    return [
        {
            "id": q.get("asked_id") or q.get("candidate_key") or q.get("clarification_id", ""),
            "question": q.get("question", ""),
            "severity": q.get("severity", ""),
            # The sentence saying what is wrong, beside the grade saying how
            # much it matters (`D-246`, `D-248`). Carried verbatim: where the
            # finding gave none, KAE-Memory sends its own `REASON_UNSTATED`
            # wording and a second phrasing invented here would be one concept
            # in two words across a boundary (`D-125`).
            #
            # `""` for a KAE-Memory older than the field, which is not the same
            # as a stated absence and must not read as one.
            "reason": q.get("reason", ""),
            "area": q.get("area_key"),
            "disposition": q.get("disposition", "open"),
            # False means nobody has been shown this. It is a fact about the
            # project, not a missing field.
            "asked": bool(q.get("asked_id")),
        }
        for q in _items(payload)
        if isinstance(q, dict)
    ]


def _listing(payload: Any) -> list[dict[str, Any]]:
    return [entry for entry in _items(payload) if isinstance(entry, dict)]
