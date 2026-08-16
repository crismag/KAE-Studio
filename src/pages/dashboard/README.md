# Dashboard

**Route:** `/dashboard` · **Registry id:** `dashboard`

Not a Room. `§13` names it as its own page beside `rooms/`, and `§19` says why:
_do not make Dashboard a second source of project truth._ It shows what other
surfaces own and sends people to them.

## Purpose

The project home. Where a person arrives, learns where the project stands, and
finds the next useful thing to do — without reading every Room to assemble the
picture themselves.

## User questions it answers

- Where is this project, roughly?
- What needs me?
- What is blocked, and on whom?
- What should I do next, and is that a recommendation or a guess?

## Entry conditions

None. It is the landing surface after a project is chosen, and a project with
nothing in it must still be legible here.

## Data it consumes

| Port         | For                                                                     |
| ------------ | ----------------------------------------------------------------------- |
| `projection` | journey, coverage, blockers, review findings, decisions, contradictions |
| `registries` | the launchers for the primary surfaces, and each one's stated limit     |

## Contextual toolbelt

`§9`, applied by restraint. The Dashboard's belt is **launchers**, not actions:
every item routes to the surface that owns it. Nothing is accepted, confirmed,
resolved or dismissed here.

_Where work happens_ offers the `primary` group and not the `room` kind
(`HOME-ROOMS`, doc 14 invariant 3). `NAV-01` grouped the sidebar by whether a
surface can be operated; a grid built on `kind` went on offering three
read-only pages as places to work, so Home and the navigation disagreed about
how many places exist. Home is left out of its own grid.

That is deliberate. A gesture on this page would make it a second place where a
decision can be made, and then two surfaces would have to agree about what a
decision means. `§19`'s _second source of project truth_ is usually read as a
data problem; it is an interaction problem first.

## Empty, loading and degraded states

Loading · a project with nothing established, which still shows its journey and
says nothing is waiting **only when nothing is** (`D-38`) · sections KAE-Memory
could not read, named individually rather than blanking the page (`AUD-040`) ·
a surface that cannot do its job yet, marked and carrying its own reason.

## Exit conditions

None. Every path out is into a Room.

## Owns

`DashboardPage.tsx`, and `Blockers.tsx` with its test — the blocker panel is
used by nothing else. `openBlockers.ts` **stays shared**: the Interview Room's
`blockedBy` uses it to mark an area, so it is a predicate about blockers rather
than a piece of this page.

## Does **not** own

- **Any project truth.** Everything here is a projection read from KAE-Memory
  and rendered. `§19`.
- **Ranking the next action.** `ADR-0002`: CIE reasons, Memory stores, Studio
  renders. `floorAction` is a **floor** for when nothing has been ranked, and it
  says so on screen rather than passing for a recommendation.
- **What a surface can do.** Each launcher shows the surface's own `limit` from
  the registry. When that sentence is wrong the surface is wrong, not this page —
  though this page is where a person reads it, which is why `D-49` mattered.
- **Closing anything.** Blockers are resolved where somebody takes
  responsibility for them, which is not here.
- **Counting what it cannot see.** _"Nothing is waiting on you that KAE can
  currently detect"_ is a narrower claim than _all clear_, and it may only be
  made when nothing on the page is waiting.

## Transitions out

Every launcher · `/reviews` from proposals and contradictions ·
`/workspace` from decisions and coverage · `/ingestion` from unread content.

## Tests

`dashboard.test.tsx` · `blockersReachAPerson.test.tsx`
