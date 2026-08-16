# Interview Room

**Route:** `/workspace` · **Registry id:** `interview`

The Room `§8.1` describes: _"resolve missing project knowledge through guided
conversation"_. It keeps the `/workspace` path — renaming a route is a
behaviour change, and the directive forbids combining that with relocation.

## Purpose

Talk to KAE, and have the conversation change the project. The Room that makes
Studio a planning assistant rather than a set of forms.

## User questions it answers

- What should I say next, and why does KAE want to know?
- Does what KAE just reflected back actually hold?
- What has this conversation established so far?
- Why did it ask that, rather than something else?

## Entry conditions

None. A project with nothing in it opens here and the Room's first move is to
ask — which is the one surface that works before anything else does.

## Data it consumes

| Port         | For                                                   |
| ------------ | ----------------------------------------------------- |
| `interview`  | the turn — CIE's move, skill, subject, next action    |
| `memory`     | the transcript, confirmations, rejections             |
| `projection` | the context panel: understanding, coverage, decisions |

## Owns

`InterviewRoom.tsx`, plus the four components nothing else uses:
`AssistantProse` (markdown for a turn), `RecommendationCard`, `skillSentences`
(the _"why this?"_ translation of CIE's skill), and `ClassificationState` with
`neverClassified`.

## Contextual toolbelt

`§9`. The belt is the composer and the gestures a turn makes available:
**attach** (which links to `/ingestion` rather than opening a picker in the
composer — that page is where a person pastes text or uploads a file),
**confirm**, **defer**, and **discuss this** from any area of the context panel
and from any open decision — the decision one because postponement is not a path
to resolution (doc 01), and there is no gesture in Memory that answers a
decision, so the conversation is the path (`WS-DEFER`).

`§9`'s example also lists Voice, Transcript, Questions and Notes. **None
exists**, and they are not stubbed here: `VC-04` has no audio anywhere in the
estate, and a belt loop with nothing on it teaches somebody the Room is broken
rather than young.

Nothing here belongs in global navigation.

## Does **not** own

- **Ranking the next action.** `ADR-0002`: CIE ranks, Memory stores, Studio
  renders. `floorAction` is a _floor_ for when nothing has been ranked yet, and
  it is shared with the Dashboard precisely so the two cannot disagree about
  what "next" means.
- **What a statement means, or whether it is true.** Confirmation moves
  lifecycle in Memory; this Room sends the gesture.
- **Any lifecycle vocabulary CIE cannot effect.** `C-5` — a turn may not offer
  an action the system cannot perform.
- **Ingestion.** The composer's attach control links to the Sources Room; it
  does not read anything itself.
- **Streaming.** A turn is one awaited `POST`. `VC-03/H`'s note stands:
  revealing a complete response progressively is fictional progress.

## States it must render

Loading a transcript · a turn in flight · a turn that failed, saying nothing was
recorded · a message not yet saved · a project with no conversation · the
context panel when a projection section could not be read · a project nothing
has classified.

## Exit conditions

None — the Room is where a project is worked on, not a task with a finish. What
it produces is candidates for the Review Room and confirmed statements for the
Definition Room.

## Transitions out

`/reviews` · `/definition` · `/sources` (from the composer) · any area's
_"Discuss this"_, which stays here and sends a turn.

## Tests

`confirmReading.test.tsx` · `discoveryProgress.test.tsx` ·
`rfa1TheLoopCloses.test.tsx` · `attentionBadges.test.tsx` ·
`assistantProse.test.tsx` · `recommendationCard.test.tsx`
