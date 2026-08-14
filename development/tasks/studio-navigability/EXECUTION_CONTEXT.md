# Execution context — making Studio navigable (`NAV-01`)

Module: the Studio shell and every room reachable from it.

## Mission

Turn fourteen destinations that each tell the truth into **one product a person
can move through**. KAE-Studio is unusually honest — nearly every screen states
its own limits — and almost unusable, because honesty was applied per page and
navigation was not applied at all.

The verdict is in the product's own transcript. In `Cris Test1: New Project`,
after 95 revisions of real conversation, the owner typed into the Workspace:

> **"How do I proceed. It looks very complicated?"**

That is the acceptance test this package exists to pass.

## Evidence (live, 2026-08-14)

Swept with a headless browser against `localhost:5199/studio/#/…` at 1440px and
1280px, project `Cris Test1: New Project` (revision 95, 180 statements,
readiness `discovering`). Every claim below is from the running application, not
from reading the source.

### Interactive controls per destination

| Route | Buttons | What that means |
|---|---:|---|
| `/reviews` | **350** | one undifferentiated queue |
| `/requirements` | **188** | a second view of the same queue |
| `/setup` | 71 | a repository picker inside a form |
| `/workspace` | 19 | the conversation, which works |
| `/sources` | 4 | works |
| `/deliverables` | 3 | one control, disabled |
| `/settings/project` | 3 | works |
| `/dashboard` | 2 | links only, by design |
| `/definition`, `/modules`, `/architecture`, `/dependencies`, `/plan`, `/memory` | **2** | **the shell's own controls. Nothing on the page can be operated.** |

**Six of fourteen destinations have no controls of their own.** Four more
(`/modules`, `/architecture`, `/dependencies`, `/plan`) say so in prose:
*"0 of 4 prerequisites met"*, *"This project has no modules yet"*, *"Modules can
be read here"*. The sidebar gives them the same visual weight as the four rooms
that work.

### One list, three destinations

The same 180 statements render on `/requirements`, `/memory` and `/reviews`.
`/requirements` shows 174 of them with the line **"Review this on the Reviews
page: confirm it, correct it, or reject it"** — a page whose main content is 174
redirects to another page.

### Numbers that disagree on one screen

`/requirements` shows tabs reading **All 180 · Confirmed 6 · Proposed 174**
directly above the line **"120 requirements · 5 confirmed · 115 awaiting review ·
60 open questions"**. The tabs count questions as requirements; the summary does
not. Both are defensible alone. Adjacent, they read as a bug.

Elsewhere: `/dashboard` says *174 proposed statements*, `/reviews` says *59
critical / 174 awaiting review*, and the sidebar carries a bare `59` that never
says what 59 is.

### Machine identifiers in the leftmost column

`/definition` puts a **UUID before the sentence** in Objectives, so the first
thing read on the page that explains what the project *is* is
`07975a71-5831-4a4f-b678-ea8c37ab49e2`. `/memory` does the same for all 180. The
sweep also found, rendered as user-facing text:

- `question:partial_area:problem_and_value:-` (`/workspace`)
- `artifacts_not_configured` (`/deliverables`)
- `acceptance_criteria`, `problem_and_value`, `functional_requirements` (`/reviews`)
- `revision unreported` in the footer of **every** page, and `revision —` in
  `/memory`'s header — two spellings of one unknown
- a model's invented quote, verbatim, inside a run error on `/sources`

### Sections that are labels with nothing under them

`/definition` renders **THE PROBLEM** and **THE VALUE** as headings with no
value and no *not established yet*. Its stakeholder table has ROLE and INTEREST
columns that read *Not recorded* for every row that exists.

### Defects found and fixed during this sweep

1. **The journey strip never worked, for any project, ever.**
   `DashboardPage.tsx` read `health.phase` — which the backend fills from the
   project's *status* (`"active"`) — and compared it to stage names. It never
   matched, so the home page's one orienting device permanently said *"This
   project reports a stage this view does not recognise."* The existing test
   encoded the bug by setting the same wrong field.
2. **"68 repositorys available"** on `/settings/project`. `plural()` promised
   *"1 dependency / 2 dependencies"* in its own comment and appended `s`.
3. **The Add-a-destination form on `/setup` rendered 508px past the right edge**
   of a 1440px window — clipped, not scrollable, so Path and Register were
   unreachable. A `<fieldset>`'s intrinsic `min-inline-size: min-content` beats
   `max-width`.

## What is already right, and must survive

Enumerated because a navigability pass is exactly where these get lost.

- **Nothing claims a capability it lacks.** `D-78`/`§19`: a prerequisite is
  stated when a control is reached for, never as a paragraph over the page.
- **Discrete state, no percentage** (`ADR-0003`). *Verified* means proved.
- **Degraded states carry one exact next action** (`§16`).
- **Capability gaps are per section**, so a room with one dead area still works.
- **`Not yet` is honest and stays** on branches nothing implements — it is the
  alternative to hiding them, which teaches people the product cannot do it.

The instinct to fix a wall of text by hiding it is the instinct this package
must resist. **Group, rank, and paginate. Do not delete a truth.**

## Target experience

### The shell — five destinations, not fourteen

```
CURRENT PROJECT  Cris Test1
  Home                    where the project stands, what needs you
  Conversation            resolve what the project needs to know      [Workspace]
  Sources                 everything this project reads from
  Decisions        174    everything waiting on you                   [Reviews + Requirements]
  Deliverables            what KAE produces from it
  ────────────────
  Understanding   ▸       Definition · Modules · Architecture · Dependencies · Plan
  Settings        ▸       GitHub · Memory · Project setup
```

Rules the shell must hold:

- **A destination in the primary list can be operated.** If a page's only
  controls belong to the shell, it is a *view* and belongs under Understanding.
- **A badge names its noun.** `174 waiting`, never `59`.
- Understanding stays reachable and stays truthful — the readiness prose on
  `/architecture` and `/plan` is good writing and moves unchanged.

### Decisions — one queue, ranked, grouped

`/reviews` and `/requirements` merge. The queue is grouped by **what the item
is** (requirement · rule · constraint · question), ranked by **what it blocks**,
and paginated. The seven *"X has 0 confirmed item(s); N are required"* findings
collapse to one row — **"Six areas need confirmed evidence"** — that expands.

Confirm and reject act **where the item is read**. No row tells a person to go
to another page to act on what they are looking at.

### Home — the one screen that answers "what now"

`Needs you` already does this and is the best thing on the site. It gains the
journey strip that now works, and **one primary action** rather than three
equal-weight rows.

### Identifiers move behind provenance

A UUID belongs under *Where this came from*, never in a column before the
sentence. Same for area keys and error codes: the sentence stays, the identifier
goes into the disclosure that already exists on those rows.

### Empty is a sentence, never a bare label

`THE PROBLEM` with nothing under it becomes *"Not established yet — discuss it
in Conversation."* A column that is always empty is removed until something
fills it.

## Slices (ship in order, each independently deployable)

| | Slice | Exit proof |
|---|---|---|
| **N1** | Shell: five primary destinations, Understanding and Settings as groups; every badge names its noun | Live sweep shows no primary destination whose only controls are the shell's |
| **N2** | Counts reconcile: one counting rule, questions never counted as requirements, the same number identical on every page | A test asserts Dashboard, Decisions and the badge read one function of one payload |
| **N3** | Decisions: `/reviews` + `/requirements` merged, grouped, ranked, paginated; confirm/reject in place | 174 items reachable without 174 redirects; no page over ~60 controls |
| **N4** | Identifiers behind provenance; empty sections get sentences; `revision unreported` spelled once | Sweep finds no UUID, area key or error code as primary text |
| **N5** | Home: one primary action, working journey strip, `Needs you` ranked | A first-time user reaches a useful action in one click from Home |

## Files this touches

- `src/app/registries/rooms.ts` — the registry every surface is declared in (N1)
- `src/app/shell/` — sidebar, groups, badges (N1)
- `src/pages/rooms/review/ReviewsRoom.tsx`, `src/pages/rooms/definition/RequirementsSubflow.tsx` (N3)
- `src/pages/dashboard/DashboardPage.tsx` (N5)
- `src/pages/rooms/definition/DefinitionRoom.tsx`, `src/pages/memory/` (N4)
- `src/lib/` — one counting helper, alongside `plural.ts` (N2)

## Open decisions — do not assume

### OD-NAV-1 — Does `/requirements` survive as a route?

`§6` separates *configure* from *select*, and this package proposes merging two
routes rather than deleting one. **No route is deleted before its replacement is
verified.** The redirect stays; whether the name survives in the sidebar is the
owner's call.

### OD-NAV-2 — What ranks the Decisions queue?

Ranking by *what it blocks* needs a blocking relation. KAE-Memory reports
`open_blocker_count` and area requirements; whether it can say *this statement
blocks that area* has not been verified. **If it cannot, group without ranking
and say so** — an invented priority order is worse than an alphabetical one.

### OD-NAV-3 — Where does Project Setup live?

It is stage one of the specified product and it is also configuration. Under
Settings it is discoverable by someone looking for settings; in the primary list
it competes with the four rooms that do work. Recorded, not decided.

## Explicitly out of scope

Visual redesign, a new type scale, colour changes, new charts, a module graph
renderer, upload/decode, publishing (`D-8`), repository creation (needs write
scope), CIE conversation quality, KAE-Memory schema changes.

**This package moves and groups what exists. It does not restyle it.**

## Completion report (required per slice)

Slice · commit · what a person can now do that they could not · the live sweep
output before and after · the guard that was verified by breaking it · what was
left out and why.
