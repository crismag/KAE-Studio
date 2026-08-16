# Review Room

**Route:** `/reviews` · **Registry id:** `review`

`§8`'s transitional Room: _"decide what KAE has proposed."_ The route keeps its path — a
rename is a behaviour change, and `D-50` forbids combining one with a move.

This is the legacy evidence-row curation surface. It remains for migration equivalence;
it is not the target human-work model. The governing replacement contract is
[`docs/architecture/EPISTEMIC_PRESENTATION_MODEL.md`](../../../../docs/architecture/EPISTEMIC_PRESENTATION_MODEL.md).

## Purpose

The screen that exposes the legacy proposal decisions and Memory's current quality
diagnostics. It does not decide whether a module is safe to hand to implementation;
task-specific readiness owns that conclusion. Two
different things live here and are deliberately not merged: **what KAE proposes
and a person rules on**, and **what a review of the project found**.

## User questions it answers

- What has KAE proposed that I have not agreed to?
- What is wrong with this project as it stands?
- What would make each of those findings go away?
- What is not being checked at all?

## Entry conditions

None. A project with nothing extracted opens here and sees an empty queue and a
review that found nothing — which are different sentences and both true.

## Data it consumes

| Port         | For                                                           |
| ------------ | ------------------------------------------------------------- |
| `projection` | `findings` (proposals), `review` (computed), `contradictions` |
| `memory`     | the confirm and reject gestures                               |

## Contextual toolbelt

`§9`. **Accept · Reject** per proposal, carrying the version the reviewer read
so a decision names the wording it was made against.

`§9`'s example also lists Edit, Defer, Discuss and Compare evidence. Defer and
Discuss live in the Interview Room, where a decision can be answered in
context — the review groups say so rather than duplicating them. **Edit and
Compare evidence do not exist**, and are not stubbed here: a control that opens
nothing teaches somebody the Room is broken rather than young.

Nothing on this belt belongs in global navigation.

## Empty, loading and degraded states

Loading · a project with nothing proposed · a review that found nothing, which
says what it did **not** check · a review KAE-Memory could not compute, which is
not the same as one that found nothing (`D-30`) · a group that cannot be
computed at all, which shows a neutral `—` rather than a green zero, because an
unrun check must never read as an all-clear.

## Exit conditions

None — the queue empties and refills as extraction runs. Confirming here moves a
statement's lifecycle in Memory; it does not finish anything.

The Room may be retired only after Attention covers required material issues and actions,
evidence drill-down works, live equivalence is demonstrated, and row-level gesture usage
has ceased.

## Owns

`ReviewsRoom.tsx` and `QualityReview.tsx`, which nothing else uses. It moved out
of `components/project/` with this Room rather than staying shared: `§19` warns
against global components for domain-specific UI before reuse is demonstrated,
and the converse holds — single-use UI stranded in a shared folder is a claim of
reuse nobody made.

## Does **not** own

- **What a finding means.** KAE-Memory derives every review finding from state
  on each read (`ADR-0015`), so there is nothing stable to address and nothing
  here dismisses one. Acting on a finding means changing the state that produced
  it, and then it is gone.
- **Ranking.** `ADR-0002`: CIE reasons, Memory stores, Studio renders.
- **Contradiction detection.** Memory records and resolves them; this page shows
  the count from readiness beside the ones the review could enumerate.
- **Answering an open decision.** That is the Interview Room's, in context.
- **The lifecycle.** Confirming and rejecting send a gesture; Memory rules on
  what it means and what it changes.

## Transitions out

`/workspace` for a decision that needs discussion · `/definition` for what the
project holds · `/memory` for the evidence behind a statement.

## Tests

`qualityReviewReachesTheUser.test.tsx` · `routes.test.tsx` (Reviews section) ·
`stage6ModelIsCurrent.test.ts` (this Room's surface is one of the six the action
model records as shipping).
