"""Drive the real stack, report what it did, and fail if the plumbing did not.

Not a test runner in the sense of asserting on wording. The CIE acceptance scenarios are behavioural, and a
probabilistic interviewer cannot be judged by asserting its wording — so this
exercises the actual journey through Studio's API and prints what changed, for
a person to read.

Where a check *is* mechanical — did a candidate appear, did confirmation move
the lifecycle, does a fresh client see it — it now records a pass or a failure
and the process exits non-zero if any failed.

**It previously said that and did not do it** (`AUD-032`): failures printed
`FAIL:` and returned, the process exited 0, and in 214 lines there were two
`isinstance` assertions. Nothing it observed was enforced, so it could not have
gated anything — which is why nobody noticed that no test in the estate
exercised the artifact chain through the wiring the deployment actually uses.

    STUDIO_API=https://host/studio python e2e/acceptance/journey.py <scenario>

`STUDIO_PASSWORD` is needed only where the deployment reports
`authentication: required`; the harness asks before signing in (`D-64`).

Scenarios: sparse-idea, messy-requirements, weak-answer, does-not-know,
established, lifecycle, continuity.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

#: Studio's port. It defaulted to `8100`, which is KAE-Memory on the canonical
#: local deployment — so a bare run went at the wrong service and failed on
#: `/api/status` before signing in.
API = os.environ.get("STUDIO_API", "http://127.0.0.1:8200")

#: Mechanical checks that did not hold. Non-empty means a non-zero exit.
#:
#: This file printed `FAIL:` and returned, and the process exited 0 — so in 214
#: lines nothing it observed was ever enforced, and it could not have failed a
#: pipeline if it had been in one (`AUD-032`). Its own docstring says the
#: mechanical checks assert; they did not.
#:
#: Collected rather than raised on the first one, because a run that stops at
#: the first failure tells you less than a run that finishes and lists them —
#: and the judgement output below a failure is still worth reading.
_FAILURES: list[str] = []


def must(condition: bool, what: str) -> bool:
    """Record a mechanical check. Returns the condition, so callers can branch.

    Judgement stays a person's — nothing here asserts on an interviewer's
    wording. What it asserts is the plumbing the wording depends on: a
    candidate appeared, a confirmation moved the lifecycle, a fresh client saw
    the same state.
    """

    print(f"  {'ok  ' if condition else 'FAIL'} {what}")
    if not condition:
        _FAILURES.append(what)
    return condition
PASSWORD = os.environ.get("STUDIO_PASSWORD", "")

_cookie = ""


def call(path: str, body: object | None = None, method: str = "") -> object:
    global _cookie
    request = urllib.request.Request(
        f"{API}{path}",
        method=method or ("POST" if body is not None else "GET"),
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", **({"Cookie": _cookie} if _cookie else {})},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            if raw := response.headers.get("Set-Cookie"):
                _cookie = raw.split(";")[0]
            payload = response.read()
            return json.loads(payload) if payload else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:300]
        raise RuntimeError(f"{error.code} {path}: {detail}") from None


def authentication_required() -> bool:
    """Whether this deployment wants a password at all.

    Asked rather than assumed. The harness exited before doing anything if
    `STUDIO_PASSWORD` was unset and then signed in unconditionally, so it could
    not run against a deployment with `STUDIO_NO_AUTH` on — which is the one it
    is pointed at, by decision (`T0.4`). `/api/status` says which it is, and
    every route this harness uses is open when authentication is disabled
    (`D-64`).
    """

    status = call("/api/status")
    # Skipped only where the deployment says so **explicitly**. Anything else —
    # an older status shape, a field renamed, a proxy returning something
    # unexpected — signs in, because guessing wrong in that direction produces a
    # confusing `401` three calls later instead of a clear message now.
    return not (isinstance(status, dict) and status.get("authentication") == "disabled")


def sign_in() -> None:
    """Sign in where the deployment requires it, and nowhere else.

    Deliberately not a `401` swallowed: that would pass on a deployment which
    *does* require authentication and rejects the password it was given, which
    is the case the check exists to catch.
    """

    if not authentication_required():
        print("  authentication is disabled on this deployment; not signing in")
        return
    if not PASSWORD:
        raise SystemExit("this deployment requires authentication: set STUDIO_PASSWORD")
    call("/api/session", {"password": PASSWORD})


def new_project(name: str) -> str:
    return str(call("/api/projects", {"name": name})["id"])  # type: ignore[index]


def say(project: str, message: str) -> dict:
    print(f"\n  YOU  : {message}")
    move = call(f"/api/projects/{project}/turn", {"body": message})
    assert isinstance(move, dict)
    print(f"  KAE  : {move['move']}")
    print(f"         [skill: {move['skill']}  subject: {move['subject'] or '-'}]")
    return move


def projection(project: str) -> dict:
    result = call(f"/api/projects/{project}/projection")
    assert isinstance(result, dict)
    return result


def wait_for_candidates(project: str, at_least: int, seconds: int = 90) -> list[dict]:
    """Extraction is asynchronous. Poll rather than assume, and say how long."""

    started = time.time()
    while time.time() - started < seconds:
        proposed = projection(project)["proposed"]
        if len(proposed) >= at_least:
            print(f"  → {len(proposed)} candidate(s) after {int(time.time() - started)}s")
            return proposed
        time.sleep(5)
    print(f"  → still {len(projection(project)['proposed'])} candidate(s) after {seconds}s")
    return projection(project)["proposed"]


def wait_for_readiness(project: str, above: int, seconds: int = 300) -> dict:
    """Poll until the number moves, or say plainly that it did not.

    Review is a model call over every statement the project holds, so this
    waits in minutes rather than seconds. Returning the last projection rather
    than raising keeps the failure legible: the caller asserts, and the printed
    state above it says what was actually observed.
    """

    started = time.time()
    latest = projection(project)
    while time.time() - started < seconds:
        latest = projection(project)
        if latest["health"]["percentage"] > above:
            print(f"  → readiness moved after {int(time.time() - started)}s")
            return latest
        time.sleep(10)
    print(f"  → readiness still {latest['health']['percentage']}% after {seconds}s")
    return latest


def show(label: str, statements: list[dict]) -> None:
    print(f"  {label} ({len(statements)}):")
    for s in statements[:8]:
        print(f"    [{s.get('kind')}] {s.get('text', '')[:88]}")


def header(text: str) -> None:
    print(f"\n{'=' * 78}\n{text}\n{'=' * 78}")


# -- scenarios ---------------------------------------------------------------


def weak_answer() -> None:
    header("Scenario A — a weak answer must not settle a gap")
    project = new_project("Acceptance A")
    say(project, "I want a tool for keeping track of client work.")
    move = say(project, "anything")

    print("\n  What to judge:")
    print("   - did it treat 'anything' as an answer, or notice it was not one?")
    print("   - did it stay on the unresolved thread?")
    print(f"   - skill chosen: {move['skill']}")

    proposed = projection(project)["proposed"]
    weak = [s for s in proposed if s.get("text", "").strip().lower() in {"anything", "anything."}]
    print(f"\n  Candidates derived from 'anything': {len(weak)} (want 0)")
    print(f"  project: {project}")


def established() -> None:
    header("Scenario B — confirmed knowledge shapes the conversation")
    project = new_project("Acceptance B")
    say(project, "A tool for tracking client work. It is just me, freelancing, about ten clients.")
    proposed = wait_for_candidates(project, 1)
    show("Candidates", proposed)

    actor = next((s for s in proposed if s.get("kind") in {"actor", "goal"}), None)
    if actor is None and proposed:
        actor = proposed[0]
    if not must(actor is not None, "extraction produced something to confirm"):
        return

    call(f"/api/projects/{project}/knowledge/{actor['id']}/confirm", {})
    print(f"\n  Confirmed: {actor['text'][:80]}")

    move = say(project, "What else do you need to know about who uses this?")
    print("\n  What to judge:")
    print("   - did it re-ask who the user is, having just been told and confirmed?")
    print(f"   - skill: {move['skill']}")
    print(f"  project: {project}")


def lifecycle() -> None:
    header("Scenario C — conversation to durable knowledge and back")
    project = new_project("Acceptance C")

    print("\n-- 1. a substantive turn")
    say(project, "Invoices must be sent within three days of a job finishing, and every invoice needs a client reference.")

    print("\n-- 2. extraction")
    proposed = wait_for_candidates(project, 1)
    show("Candidates", proposed)
    if not must(bool(proposed), "a substantive turn entered the acquisition path"):
        return

    print("\n-- 3. reviewable, not trusted")
    before = projection(project)
    print(f"  confirmed={len(before['confirmed'])} proposed={len(before['proposed'])}"
          f" readiness={before['health']['percentage']}%")

    print("\n-- 4. confirm one")
    target = proposed[0]
    call(f"/api/projects/{project}/knowledge/{target['id']}/confirm", {})
    after = projection(project)
    print(f"  confirmed={len(after['confirmed'])} proposed={len(after['proposed'])}"
          f" readiness={after['health']['percentage']}%")
    print(f"  moved: {target['text'][:80]}")
    must(
        len(after["confirmed"]) > len(before["confirmed"]),
        "confirming moved a statement into confirmed knowledge",
    )
    must(
        after["health"]["percentage"] >= before["health"]["percentage"],
        "readiness did not go backwards when knowledge was confirmed",
    )
    # Deliberately `>=` and not `>`. Confirming alone cannot move the number —
    # only classification puts a statement in an area — and asserting movement
    # here would have been asserting something the product does not do. Step 5
    # is where movement is claimed, and it is claimed after the thing that
    # causes it.

    print("\n-- 5. the classification the number depends on")
    # `AUD-041`. Readiness counts statements per discovery area, and a
    # statement reaches an area only when a review run classifies it. Nothing
    # in the product asked for one, so the assertion below — the journey's own
    # third step, "readiness recalculates" — could not have held on any project
    # ever driven through Studio. Cris Test 2 held five extraction runs, no
    # review runs, and 0%.
    queued = call(f"/api/projects/{project}/classify", {})
    assert isinstance(queued, dict)
    if queued.get("status") == "already_current":
        print("  → already classified at this revision")
        classified = after
    else:
        print(f"  → review queued: {queued.get('run_id')}")
        classified = wait_for_readiness(project, above=after["health"]["percentage"])
        print(f"  readiness={classified['health']['percentage']}%")

    must(
        classified["health"]["percentage"] > 0,
        "classification moved readiness off zero",
    )
    engine = (classified.get("classification") or {}).get("engine")
    print(f"  classified by: {engine}")
    must(
        engine is not None,
        "the projection says which engine classified, rather than only a number",
    )
    # The word has to be earned. A fixture reviewer reported `reviewed_by_model`
    # until `AUD-039`, so a run against recorded payloads published a claim
    # about a model beside a number capped by the offline ceiling.
    must(
        engine != "unknown",
        "a deployment that cannot say how it classified is not a deployment to trust a number from",
    )

    print("\n-- 6. does a later turn use it")
    move = say(project, "Remind me what we have settled so far.")
    settled = target["text"].lower()[:40]
    print(f"\n  Mentions the confirmed statement: {settled[:30]!r} in reply → "
          f"{settled[:30] in move['move'].lower()}")
    print(f"  project: {project}")


def continuity() -> None:
    header("Scenario D — knowledge outlives the conversation")
    project = new_project("Acceptance D")
    say(project, "A booking system for a physiotherapy clinic. Four therapists, one receptionist.")
    proposed = wait_for_candidates(project, 1)
    if not must(bool(proposed), "there is knowledge to carry across a session"):
        return
    call(f"/api/projects/{project}/knowledge/{proposed[0]['id']}/confirm", {})
    print(f"  Confirmed: {proposed[0]['text'][:80]}")

    print("\n  -- a fresh client, no shared memory --")
    global _cookie
    _cookie = ""
    sign_in()

    state = projection(project)
    show("Still confirmed after reconnecting", state["confirmed"])
    # The one thing in this file that proves durability rather than describing
    # it: a different client, a fresh session, the same confirmed statement.
    must(bool(state["confirmed"]), "a fresh client sees the knowledge the last one confirmed")
    move = say(project, "Where were we?")
    print("\n  What to judge: does the reply reflect the clinic, the therapists,")
    print("  and what was confirmed — or does it start over?")
    print(f"  project: {project}")


def _established(state: dict) -> int:
    """How much is **confirmed**, per area. Never the advisory percentage.

    The percentage counts proposed material and is labelled advisory precisely
    because of that. A journey clause about confirmed readiness has to read the
    confirmed counts or it is measuring the model's output rather than the
    project's agreements.
    """

    areas = (state.get("health") or {}).get("areas") or []
    return sum(int(area.get("confirmed") or 0) for area in areas)


SPARSE = "I want an inbox where I can dump thoughts and have them turned into useful things."


def sparse_idea() -> None:
    """`J1` — a sparse idea, against the journey's **own** pass conditions.

    `established` and `weak-answer` overlap `J1` and `J3` without matching them
    (`D-65`), so this asserts what the journey actually says rather than what
    was convenient to check. Six of its clauses are mechanical; the seventh —
    *semantic interpretation produces useful knowledge without phrase-specific
    rules* — is judgement, is printed, and is not asserted. `J1` says so itself:
    *test usefulness and epistemic integrity, not model taste.*
    """

    header("J1 — a sparse idea, and what may be claimed from it")
    project = new_project("Acceptance J1")
    say(project, SPARSE)
    proposed = wait_for_candidates(project, 1)
    show("Proposed", proposed)

    state = projection(project)
    preliminary = state.get("preliminary") or {}

    # 1. The original sentence, kept as it was said.
    verbatim = [entry.get("text", "") for entry in preliminary.get("statedVerbatim") or []]
    must(SPARSE in verbatim, "the original evidence is stored verbatim")

    # 2. Inference is offered, never asserted. Nothing was confirmed here, so a
    #    confirmed statement at this point came from the model deciding.
    must(bool(proposed), "semantic interpretation produced proposed knowledge")
    must(
        all(item.get("lifecycle") == "proposed" for item in proposed),
        "every inferred statement is explicitly non-confirmed",
    )
    must(not state.get("confirmed"), "nothing is confirmed that nobody confirmed")

    # 3. Unknowns are representable rather than silently dropped.
    unknowns = (preliminary.get("materialUnknowns") or []) + (
        preliminary.get("deferrableUnknowns") or []
    )
    must(bool(unknowns or state.get("openQuestions")), "meaningful unknowns can be represented")

    # 4. Provenance reaches the sentence, not merely a record id.
    trace = call(f"/api/projects/{project}/knowledge/{proposed[0]['id']}/trace")
    quoted = json.dumps(trace) if trace is not None else ""
    must(SPARSE[:40] in quoted, "provenance leads back to the source evidence")

    # 5. Readiness is about what is established. A model inferring six things
    #    must not move it, or the number measures the model's enthusiasm.
    health = state.get("health") or {}
    must(
        health.get("advisory") is True,
        "readiness is advisory rather than a gate",
    )
    must(
        not health.get("implementationEligible") and not health.get("draftEligible"),
        "inference alone did not make the project fit to build from",
    )

    # 6. Assembly separates what is known from what is guessed.
    must(
        preliminary.get("isPreliminary") is True,
        "preliminary assembly says it is preliminary",
    )

    print("\n  What to judge (not asserted):")
    print("   - is the inferred material useful, or generic filler?")
    print(f"   - readiness: {health.get('percentage')}%  status: {health.get('status')}")
    print(f"  project: {project}")


DONT_KNOW = (
    "I don't know yet. Recommend something reasonable for a prototype, "
    "but don't make it a permanent project decision."
)


def does_not_know() -> None:
    """`J3` — the user does not know, and that must not become an answer.

    `weak-answer` overlaps this and does not match it (`D-65`): `anything` is a
    non-answer, while this is somebody explicitly deferring **and** asking for a
    recommendation. The difference is the whole journey — KAE is invited to
    decide, and must record the decision as its own.
    """

    header("J3 — deferring is not deciding")
    # Named per run, for `D-265`'s reason one function away: Memory derives a
    # project key from the name and returns the existing project for a repeat, so
    # a fixed name would let clause 1 hold on candidates the deferral turn never
    # produced (`D-273`).
    project = new_project(f"Acceptance J3 {int(time.time())}")
    say(project, "A scheduling tool for a small veterinary practice.")
    wait_for_candidates(project, 1)

    before = projection(project)
    settled_before = len(before.get("confirmed") or [])
    established_before = _established(before)
    proposed_before = len(before.get("proposed") or [])

    say(project, DONT_KNOW)
    # Wait for the deferral turn's **own** extraction. Reading the projection
    # straight after `say` read the first turn's candidates and none of this
    # one's, so clause 3 — the clause `J3` is named for — took its `else` branch
    # on every run and printed *no assumption was recorded* while an assumption
    # was landing seconds later (`D-273`). Bounded and not asserted: `J3` permits
    # KAE to record nothing, so a window that closes empty is a real answer.
    wait_for_candidates(project, proposed_before + 1, seconds=60)
    after = projection(project)
    health = after.get("health") or {}

    # 1. The uncertainty is taken, not refused. A project that gained nothing
    #    from the turn treated "I don't know" as noise.
    must(bool(after.get("proposed") or after.get("openQuestions")),
         "the uncertainty was not rejected")

    # 2. Deferring is never confirming. Nobody pressed anything.
    must(len(after.get("confirmed") or []) == settled_before,
         "saying 'I don't know' confirmed nothing")

    # 3. **Conditional by design.** `J3` allows KAE to continue conversationally
    #    without recording anything; what it forbids is a faked state
    #    transition. So an assumption is permitted, not required — and if one
    #    exists it must be attributed to the model rather than to the person who
    #    just said they did not know (`D-66`).
    assumptions = [s for s in after.get("proposed") or [] if s.get("kind") == "assumption"]
    if assumptions:
        trace = call(f"/api/projects/{project}/knowledge/{assumptions[0]['id']}/trace")
        produced_by = (trace or {}).get("produced_by") if isinstance(trace, dict) else None
        print(f"  recommendation recorded, attributed to: {produced_by}")
        must(bool(produced_by) and produced_by != "user",
             "a recommendation is attributed to KAE, not to the user")
        # 4. Revisitable: proposed, so it can still be rejected or corrected.
        must(all(a.get("lifecycle") == "proposed" for a in assumptions),
             "the recommendation stays revisitable")
    else:
        print("  no assumption was recorded — permitted, and nothing was faked")

    # 5. **Confirmed** readiness, which is what `J3` names — not the advisory
    #    percentage. The first draft asserted the percentage and failed on a run
    #    that behaved correctly: with nothing confirmed at all, it had moved 0 →
    #    14 because it counts *proposed* material, which is its stated job
    #    (`RFA-1` asserts it moves). Confirmed readiness is the per-area
    #    confirmed count, and that is what may not rise on a deferral (`D-66`).
    must(_established(after) == established_before,
         "deferring did not move confirmed readiness")
    must(not health.get("implementationEligible"),
         "deferring did not make the project fit to build from")

    print("\n  What to judge (not asserted):")
    print(f"   - advisory readiness moved {(before.get('health') or {}).get('percentage')}%"
          f" -> {health.get('percentage')}% on proposed material, with nothing confirmed")
    print("   - is the recommendation reasonable for a prototype, or filler?")
    print("   - is it offered as KAE's, and easy to overturn?")
    print(f"  project: {project}")


def read_version(item: dict) -> int:
    """The version the reviewer read. Memory refuses a rejection naming another.

    Read from the projection rather than passed as `1`, because a statement
    corrected between extraction and review is exactly the case that check
    exists for.
    """

    return int(item.get("version") or 1)


MESSY = (
    "We run a small print shop and orders come in by email, phone and sometimes "
    "in person, so what I really want is one place where an order exists once. "
    "Every order has to carry a customer reference, and nothing may be marked "
    "despatched before it has been paid for or signed off by me.\n\n"
    "For example, last week a rush job for a school went out on a Friday and we "
    "invoiced it eleven days later, which is the sort of thing this should make "
    "impossible.\n\n"
    "I am not sure whether we need per-user logins. There are four of us and we "
    "trust each other, but the accountant asks who changed a price and I cannot "
    "currently answer that. I would prefer something plain and fast over "
    "anything clever, and I would rather not pay per seat."
)


def messy_requirements() -> None:
    """`J2` — several paragraphs of mixed material, told apart rather than flattened.

    `J2` passes when CIE disentangles the material *without flattening all
    statements into confirmed requirements*, and Memory *retains traceable
    lifecycle distinctions*. Both halves are mechanical here; whether the
    disentangling is a good reading is judgement and is printed, not asserted.

    The uncertain sentence is deliberately not asserted to have become an
    `unknown`. Which kind a probabilistic extractor gives it is taste; that the
    material did not arrive as one undifferentiated requirement is not.
    """

    header("J2 — messy requirements, disentangled and not flattened")
    # Named per run. Memory derives a project key from the name and returns the
    # existing project for a repeat, so a fixed name meant the second run
    # inherited the first run's confirmed statement — and clause 3 below, the
    # one that catches flattening into settled requirements, was then false on
    # every run but the first (`D-265`).
    project = new_project(f"Acceptance J2 {int(time.time())}")
    say(project, MESSY)
    proposed = wait_for_candidates(project, 3)
    show("Proposed", proposed)

    state = projection(project)

    # 1. Several statements, not one. A single candidate from four paragraphs is
    #    the flattening this journey is named after.
    must(len(proposed) >= 3, "mixed material arrived as several statements, not one")

    # 2. Told apart. Goals, constraints and uncertainty are different things and
    #    the extractor has kinds for them.
    kinds = sorted({str(item.get("kind")) for item in proposed})
    print(f"  kinds present: {', '.join(kinds)}")
    must(len(kinds) >= 2, "the material was told apart by kind rather than given one label")

    # 3. Nobody confirmed anything, so nothing may be confirmed.
    must(not state.get("confirmed"), "nothing arrived confirmed")
    must(
        all(item.get("lifecycle") == "proposed" for item in proposed),
        "no requirement was asserted as settled on the strength of one message",
    )

    # 4. Three lifecycle states, held as three states. Confirm one, refuse
    #    another with a reason, and read the projection back.
    keep, refuse = proposed[0], proposed[1]
    call(f"/api/projects/{project}/knowledge/{keep['id']}/confirm", {})
    call(
        f"/api/projects/{project}/knowledge/{refuse['id']}/reject",
        {
            "reason": "not something we said; keeping the record honest",
            "expected_version": read_version(refuse),
        },
    )
    after = projection(project)
    print(f"\n  confirmed={len(after['confirmed'])} proposed={len(after['proposed'])}"
          f" rejected={len(after.get('rejected') or [])}")
    must(
        any(item["id"] == keep["id"] for item in after["confirmed"]),
        "the confirmed statement is held as confirmed",
    )
    must(
        any(item["id"] == refuse["id"] for item in after.get("rejected") or []),
        "the refused statement is held as rejected rather than deleted",
    )
    must(
        any(item["lifecycle"] == "proposed" for item in after["proposed"]),
        "what nobody ruled on is still proposed",
    )

    # 5. Traceable, and still traceable after the lifecycle moved. A projection
    #    alone cannot answer this: it says what state a statement is in, not
    #    whether the sentence it came from can still be reached.
    trace = call(f"/api/projects/{project}/knowledge/{keep['id']}/trace")
    quoted = json.dumps(trace) if trace is not None else ""
    must(MESSY[:40] in quoted, "confirming did not cost the statement its provenance")

    print("\n  What to judge (not asserted):")
    print("   - is the disentangling a fair reading, or did it shred one thought into five?")
    print("   - did the uncertainty about logins survive as uncertainty?")
    print(f"   - readiness: {(after.get('health') or {}).get('percentage')}%")
    print(f"  project: {project}")


ARCHITECTURE_ASK = (
    "I don't know how this should be architected. I've never made that kind of "
    "decision before — what are the reasonable options for a first version, and "
    "which would you pick?"
)

ARCHITECTURE_FOLLOW_UP = (
    "That helps. Before I choose: what would each option cost us if the practice "
    "grows to four sites and we need per-site scheduling?"
)


def architecture() -> None:
    """`J4` — the user cannot architect this and asks KAE to help.

    Written to `J4`'s own pass conditions (`D-289`), not to the neighbouring
    scenarios': *recommend and compare approaches, capture decisions only when
    actually made, retain unchosen and revisitable reasoning appropriately, and
    progressively develop implementable architecture context.*

    Whether the options offered are good architecture is judgement and is
    printed. What is asserted is that asking for advice settles nothing, that
    the unchosen option is retained through the product's own door, and that
    what the conversation produced can still be traced back to it.
    """

    header("J4 — architecture collaboration, with nothing decided by asking")
    # Named per run: Memory derives a project key from the name and returns the
    # existing project for a repeat, so a fixed name would let the "nothing was
    # confirmed" clauses hold on a project that had already been through this
    # once (`D-265`, `D-273`).
    project = new_project(f"Acceptance J4 {int(time.time())}")
    say(project, "A scheduling tool for a small veterinary practice.")
    seeded = wait_for_candidates(project, 1)

    before = projection(project)
    settled_before = len(before.get("confirmed") or [])
    established_before = _established(before)
    proposed_before = len(seeded)

    move = say(project, ARCHITECTURE_ASK)
    # The architecture turn's **own** extraction, bounded. Reading straight back
    # would read the seeding turn's candidates and none of this one's, which is
    # the defect `D-273` found in `J3` — a clause that never reaches the branch
    # it exists for. An empty window is still a real answer here, so this is
    # waited on and not asserted.
    wait_for_candidates(project, proposed_before + 1, seconds=90)
    after_ask = projection(project)

    # 1. The question was taken rather than refused. A project that gained
    #    nothing at all from being asked for architectural help treated the ask
    #    as noise — which is the "never decline access without naming the route"
    #    failure one level up.
    must(
        len(after_ask.get("proposed") or []) >= proposed_before
        or bool(after_ask.get("openQuestions")),
        "asking for architectural help was taken rather than refused",
    )

    # 2. **Capture decisions only when actually made.** Nobody chose anything, so
    #    nothing may be settled: not a confirmation, not confirmed readiness, and
    #    not a `decision` statement sitting in the project as though ruled.
    must(
        len(after_ask.get("confirmed") or []) == settled_before,
        "asking for a recommendation confirmed nothing",
    )
    must(
        _established(after_ask) == established_before,
        "asking for a recommendation did not move confirmed readiness",
    )
    decisions = [s for s in after_ask.get("proposed") or [] if s.get("kind") == "decision"]
    must(
        all(item.get("lifecycle") == "proposed" for item in decisions),
        "no architectural decision was recorded as settled by the asking",
    )

    # 3. **Compare approaches — conditional by design**, in `J3`'s clause-3
    #    shape. A turn may legitimately ask a clarifying question instead of
    #    advising, and requiring advice here would be asserting model behaviour.
    #    Where advice *is* given it has to be weighable: `Recommendation` exists
    #    because the advice used to arrive as prose a person had to retype.
    recommendation = move.get("recommendation")
    if isinstance(recommendation, dict):
        print(f"\n  advice     : {recommendation.get('advice', '')[:100]}")
        print(f"  reason     : {recommendation.get('reason', '')[:100]}")
        print(f"  consequence: {recommendation.get('consequence', '')[:100]}")
        must(
            bool(str(recommendation.get("reason", "")).strip()),
            "advice arrives with the reason it outranks the alternatives",
        )
        must(
            bool(str(recommendation.get("consequence", "")).strip()),
            "advice says what taking it would commit to",
        )
    else:
        print("\n  no recommendation on this turn — permitted; nothing was faked")

    # 4. **Retain the unchosen.** The product's own door, not the model's memory:
    #    `keep_open` writes origin `unresolved_alternative` and forces
    #    `revisit=before_build`, because an option nobody chose has to come back
    #    or "keep open" is a way of losing the question politely.
    advice = (
        str(recommendation.get("advice"))
        if isinstance(recommendation, dict) and recommendation.get("advice")
        else "a single deployable service to begin with, split later if it hurts"
    )
    call(
        f"/api/projects/{project}/recommendations",
        {
            "disposition": "keep_open",
            "advice": advice,
            "reason": "worth deciding, and not today",
            "subject": "architecture",
        },
    )
    kept = projection(project)
    assumed = ((kept.get("preliminary") or {}).get("assumed")) or []
    unresolved = [a for a in assumed if a.get("origin") == "unresolved_alternative"]
    must(bool(unresolved), "an option nobody chose is retained rather than dropped")
    must(
        all(a.get("state") != "accepted" for a in unresolved),
        "the unchosen option is not recorded as agreed to",
    )
    # **`revisit` is deliberately not asserted here, and that is a finding.**
    # The route forces `revisit=before_build` for `keep_open`, and the field
    # exists on `AssumptionResponse` — but the preliminary context, which is the
    # only path Studio reads assumptions through, does not carry it. A check on
    # `revisit_when` here could only ever read `None`, which is a check that
    # cannot fail. Recorded as `ASSUME-REVISIT` rather than written as one.

    # 5. **Progressively develop.** A second architectural turn, and what it
    #    produced must still lead back to the conversation it came from — a
    #    projection says what state a statement is in, never whether the sentence
    #    behind it can still be reached.
    standing = len(kept.get("proposed") or [])
    say(project, ARCHITECTURE_FOLLOW_UP)
    grown = wait_for_candidates(project, standing + 1, seconds=90)
    after_follow = projection(project)
    must(
        len(after_follow.get("proposed") or []) >= standing,
        "a second architectural turn did not cost the project what the first produced",
    )
    # Identified by id rather than by position: the projection's order is its
    # own, and `[-1]` is not a promise about which statement is newest.
    seeded_ids = {str(item.get("id")) for item in seeded}
    from_architecture = [
        item for item in after_follow.get("proposed") or [] if str(item.get("id")) not in seeded_ids
    ]
    if from_architecture:
        traced = False
        for item in from_architecture[:5]:
            trace = call(f"/api/projects/{project}/knowledge/{item['id']}/trace")
            quoted = json.dumps(trace) if trace is not None else ""
            if ARCHITECTURE_ASK[:40] in quoted or ARCHITECTURE_FOLLOW_UP[:40] in quoted:
                traced = True
                break
        must(traced, "what the architecture conversation produced leads back to it")
    else:
        print("  the architectural turns produced no new statements — printed, not asserted")

    show("Proposed after two architectural turns", after_follow.get("proposed") or [])
    print("\n  What to judge (not asserted):")
    print("   - were real alternatives compared, or one option presented as the answer?")
    print("   - is the reasoning behind the unchosen option still legible?")
    print(
        "   - architecture curation is KAE-Memory's MCP path and Studio cannot write "
        f"modules: modules.available={((after_follow.get('modules') or {}).get('available'))}"
    )
    print(f"   - readiness: {(after_follow.get('health') or {}).get('percentage')}%")
    print(f"  project: {project}")


SCENARIOS = {
    "architecture": architecture,
    "messy-requirements": messy_requirements,
    "sparse-idea": sparse_idea,
    "weak-answer": weak_answer,
    "does-not-know": does_not_know,
    "established": established,
    "lifecycle": lifecycle,
    "continuity": continuity,
}


if __name__ == "__main__":
    # The password check moved into `sign_in`, where the deployment can be asked
    # whether it wants one. Here it refused to start against a host that needs
    # no password at all (`D-64`).
    chosen = sys.argv[1:] or list(SCENARIOS)
    sign_in()
    for name in chosen:
        SCENARIOS[name]()

    print()
    if _FAILURES:
        print(f"{len(_FAILURES)} mechanical check(s) failed:")
        for failure in _FAILURES:
            print(f"  - {failure}")
        # Non-zero, so this can gate something. Printing a failure and exiting
        # 0 is how a harness becomes documentation.
        raise SystemExit(1)
    print("All mechanical checks held. The judgement above is still a person's.")
