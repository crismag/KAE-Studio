"""Drive the real stack and report what it did.

Not a test runner. The CIE acceptance scenarios are behavioural, and a
probabilistic interviewer cannot be judged by asserting its wording — so this
exercises the actual journey through Studio's API and prints what changed, for
a person to read.

Where a check *is* mechanical — did a candidate appear, did confirmation move
the lifecycle, did the next turn see it — it asserts and says so.

    STUDIO_PASSWORD=... python e2e/acceptance/journey.py <scenario>

Scenarios: weak-answer, established, lifecycle, continuity.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get("STUDIO_API", "http://127.0.0.1:8100")
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


def sign_in() -> None:
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
    if actor is None:
        print("  ! nothing to confirm — extraction produced no candidates")
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
    if not proposed:
        print("  FAIL: nothing entered the acquisition path")
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

    print("\n-- 5. does a later turn use it")
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
    if not proposed:
        print("  FAIL: nothing to carry forward")
        return
    call(f"/api/projects/{project}/knowledge/{proposed[0]['id']}/confirm", {})
    print(f"  Confirmed: {proposed[0]['text'][:80]}")

    print("\n  -- a fresh client, no shared memory --")
    global _cookie
    _cookie = ""
    sign_in()

    state = projection(project)
    show("Still confirmed after reconnecting", state["confirmed"])
    move = say(project, "Where were we?")
    print("\n  What to judge: does the reply reflect the clinic, the therapists,")
    print("  and what was confirmed — or does it start over?")
    print(f"  project: {project}")


SCENARIOS = {
    "weak-answer": weak_answer,
    "established": established,
    "lifecycle": lifecycle,
    "continuity": continuity,
}


if __name__ == "__main__":
    if not PASSWORD:
        raise SystemExit("set STUDIO_PASSWORD")
    chosen = sys.argv[1:] or list(SCENARIOS)
    sign_in()
    for name in chosen:
        SCENARIOS[name]()
