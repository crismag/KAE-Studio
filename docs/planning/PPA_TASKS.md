# KAE-Studio under the PPA operating model

What this repository owes, and why. The governing decision, the findings and the
ordering live in KAE-Ecosystem — `decisions/ADR-0001-ppa-operating-model.md`,
`roadmap/PPA_FINDINGS_REGISTER.md`, `roadmap/EXECUTION_SEQUENCE.md`, and the two
contracts in `contracts/`. This file is the Studio-side view of them.

## What Studio owns

**Orientation and action** — progress · current state · outstanding decisions ·
artifacts · next actions · approvals · workflow transitions.

**Studio does not decide project truth.** It renders Memory's projection and
CIE's proposals. Every task below is presentation, navigation or gesture.

## The heartbeat, and where Studio breaks it

```text
Talk → KAE understands something → the project model changes
     → Studio visibly changes → artifacts and pages improve
     → KAE identifies the next useful work → repeat
```

**PPA-17, the major finding, is Studio's:** the conversation progresses and the
workspace does not. Discovery Progress, Current Understanding, Definition,
Requirements and everything downstream behave as separate inspection screens
rather than views of one project changing in real time. After twenty minutes of
real definition work, nothing on screen says the project grew.

## Tasks

### S-1 · Delete the fixture content — *PPA-13, do this first*

`src/app/routes/Workspace.tsx:179` hard-codes *"Draft → submit → approve or
reject → publish"* as the project's Core workflow. `Architecture.tsx` and
`Plan.tsx` carry fixture prose about *"Approval Workflow"* and *"Identity and
Access"* — a different project entirely.

The ecosystem's founding rule is that inference must never pass as fact. **This
passes fiction as fact**, which is a harder breach, and it is the highest-
severity finding of the session.

*Exit:* no page renders content it cannot source from the projection.

### S-2 · Three channels — *R2, PPA-02/03/04*

| Channel | Carries |
|---|---|
| Conversation | human ↔ planner, only |
| Status, beside it | progress, state, decisions waiting |
| Explanation, on demand | provenance · reasoning · confidence · history |

Today internal orchestration renders as a conversational turn, and reasoning
renders **twice, both inline** — `Workspace.tsx:92` per-message panel and
`:631` `WhyThisQuestion`, from the same `points`.

`WhyThisQuestion` is good and must survive: it composes a human sentence from
skill and subject. Wrong position, right idea — move it behind disclosure.

### S-3 · The confirmation gesture — *R14, PPA/STATE-01*

Render `contracts/CIE_INTERACTION.md`'s turn: `narrative` · `interaction` ·
`project_updates` · `provenance` · `reasoning` · `next_action`.

First slice, five primitives: **rich Markdown**, `confirm`, `choice` /
`multi_choice`, `recommendation`, `next_action`.

**CIE emits intent; Studio decides appearance. CIE never returns HTML.** That
boundary is what lets the same turn render as a wide card on desktop and a
stacked one on mobile — which is why it cannot wait for mobile to exist.

**The UI action is the confirmation.** Clicking Accept confirms the set named in
`provenance`, via Memory's set-confirmation (M-1). No follow-up question.

Delete the EC-3 stopgap in the same change.

### S-4 · Definition renders real content — *DEF-1.3, PPA-14*

`src/services/live/liveServices.ts:496` hard-codes the `definition` block empty.

Then: absence renders as absence. An empty problem string currently renders as
`.`; empty users render blank. **Missing must be visibly missing, and missing is
not the same as unavailable.**

### S-5 · Stage readiness instead of placeholders — *R9, PPA-16*

`Architecture.tsx` and `Plan.tsx` have no hooks at all. An empty page is not a
defect; a page that cannot say what it is waiting for is.

```text
Architecture — not ready to develop yet
  ✓ Product problem understood      ◐ Functional scope developing
  ✓ Initial users understood        ○ Data requirements incomplete
                                    ○ Integration requirements unknown

  Continue planning with KAE →
```

This converts four "placeholder" pages from things to delete into the progress
model itself — cheaper than building four features and more useful before any of
them exist.

### S-6 · Discovery Progress becomes navigation — *PPA-20*

It is already the right panel and already honest. It needs classification and a
gesture, not a redesign.

*"Discuss this"* currently prefills the composer: the user must notice it, send
it, answer, and the card still reads `missing · 0 of 1 confirmed`.

Clicking must **initiate a focused activity that begins from current project
knowledge** — evaluate what is known, determine what is actually missing, ask
only if user input is genuinely required. Never restart acquisition for that
category.

Actions follow state, per `contracts/PLANNING_MODEL.md`: Explore with KAE ·
Complete this · Review draft · Make decision · Resolve conflict · View/refine ·
Generate proposal.

### S-7 · The persistent project navigator — *R11, R12, PPA-19*

```text
Project progress — 38%
  ✓ Idea captured        ◐ Scope
  ✓ Problem understood   ○ Requirements
  ● Define users ← now   ○ Architecture · Development plan

  Next: identify who the first version is for.   Continue →
```

Every turn already returns `subject`; `liveServices.ts:747` renders it as a
debug bullet, **twice**. It should drive orientation.

One recommended next action, always present, with its reason — guidance, not a
gate. *Who ranks it is open; the recommendation is CIE. Decide before building
this.*

This is what makes an awkward CIE transition survivable: **the product knows
where you are even when the sentence doesn't.**

### S-8 · Requirements gains structure — *R10, PPA-15*

72 derived items, flat, unranked, ungrouped. *"I don't know how to organise my
project"* becomes *"KAE generated 70 things I don't know how to organise."*
Producing an unmanageable list is the customer's original problem restated.

Hierarchy, grouping, status, prioritisation and progressive disclosure are
**KAE's work**, not the user's. Near-duplicate grouping (EM-3) and the surface
that renders it (ES-5) ship together.

### S-9 · Badges mean attention — *R13, PPA-21*

`Requirements · 3 need review`, never `Requirements 12`. `Reviews 81` on a first
project reads as *"KAE has found 81 things wrong with your idea."*

Notifications are for meaningful asynchronous events — analysis finished, a
proposal ready, a contradiction found between two confirmed requirements — not
for conversational transitions.

### S-10 · Setup honesty — *standing constraint*

The setup wizard may truthfully support **output** configuration. Its
source-intake portion stays marked **planned** until acquisition exists, and
repository selection is never presented as *"repository analyzed"* while it
proves only connectivity or configuration.

## Status, 2026-08-09 evening

**All ten shipped**, across four Phase 2 slices.

| | | |
|---|---|---|
| **S-1** fixture content deleted | `a94bbd9` | six sites, not the three recorded |
| **S-2** three channels | `456bb91` | one disclosure per turn, on demand |
| **S-3** the confirmation gesture | `48111a0` · `29fa528` | one click confirms a reading |
| **S-4** Definition renders real content | `6bc90ca` · `8837b03` | the problem statement can be shown |
| **S-5** stage readiness | `ffbba95` | Architecture and Plan only — the other two already said something true |
| **S-6** Discovery Progress as navigation | `7c3b3cb` | it sends, and asks CIE to continue rather than restart |
| **S-7** the navigator | `c15fcb8` · `f4ec671` | ranked by CIE, durable, no model call to render |
| **S-8** requirements gains structure | `3ec8c1c` | grouping by category; similarity grouping is still owed |
| **S-9** badges mean attention | `3ec8c1c` | critical only in the navigation |
| **S-10** setup honesty | — | unchanged and still true |

Plus two the slices added: the recommendation card with Accept · Modify · Keep
open (`06987dd`), and content loss disclosed beside the coverage figure
(`8e8d41f`).

**One defect found while building, worth remembering:** "Bring back" on a
deferred decision sent `answered`, which settles — so it closed the question it
existed to reopen, silently, because a settled question simply stops appearing
(`ba94c53`).

**What Studio still owes.** Similarity grouping for requirements (EM-3/ES-5),
which is real work rather than a finishing touch. And every one of these is
proved by test rather than by use — the replay against a running deployment has
not happened.

Suites: **108 backend, 85 frontend.**
