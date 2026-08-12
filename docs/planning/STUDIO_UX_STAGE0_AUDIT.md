# Stage 0 audit and Stage 1 route map

**Gate A deliverable** for
[`STUDIO_UX_ARCHITECTURE_IMPLEMENTATION_DIRECTIVE.md`](STUDIO_UX_ARCHITECTURE_IMPLEMENTATION_DIRECTIVE.md).
Read-only: no route moved, no component relocated, no UI changed.

The directive's Stage 0 is *"audit only"* and Stage 1 asks for a target route and
ownership map. Both are here, because the second is unreadable without the
first.

---

## 1 · Every user-visible route and where it renders

Hash router (`createHashRouter`, chosen for static hosting — every URL is
`/#/…`). Thirteen routes, all children of `AppShell`, each with its own
`errorElement`. **No route takes a parameter and none has a detail view.**

| Route | Entry point | Lines | Mutates? | Tests |
|---|---|---:|---|---|
| `/setup` | `routes/ProjectSetup.tsx` | 559 | **10 hooks** | `projectSetup.test.tsx` |
| `/workspace` | `routes/Workspace.tsx` | 979 | **10 hooks** | `confirmReading`, `discoveryProgress`, `rfa1`, `attentionBadges` |
| `/sources` | `routes/Sources.tsx` | 431 | 2 hooks | `sources.test.tsx` |
| `/ingestion` | `routes/Ingestion.tsx` | 417 | 2 hooks | `ingestion.test.tsx` |
| `/definition` | `routes/ProjectDefinition.tsx` | 268 | — | `rfa2` |
| `/modules` | `routes/Modules.tsx` | 766 | 2 hooks | `rfa2` |
| `/requirements` | `routes/Requirements.tsx` | 469 | — | `contentLoss` |
| `/architecture` | `routes/Architecture.tsx` | **49** | — | — |
| `/dependencies` | `routes/Dependencies.tsx` | 273 | — | — |
| `/plan` | `routes/Plan.tsx` | **52** | — | — |
| `/deliverables` | `routes/Deliverables.tsx` | 247 | — | `GeneratePackage.test` |
| `/reviews` | `routes/Reviews.tsx` | 300 | 4 hooks | — |
| `/memory` | `routes/Memory.tsx` | 220 | — | — |

`/` redirects to `/workspace`; `*` redirects to `/workspace`.

**Deep-link behaviour that must not regress:** none beyond the thirteen paths.
There is no query-string state, no route parameter, and no restorable selection —
every filter, expansion and selection on every page is component state and is
lost on reload. That is a *finding*, not a constraint: the migration cannot break
deep links that do not exist, and Rooms should add them.

## 2 · Where each route gets its data

One projection dominates. `useProjection()` — a single `GET /api/projects/{id}/projection`
composed by the Studio backend from six Memory calls — backs **nine of thirteen**
routes. The rest reach dedicated ports.

| Port | Routes |
|---|---|
| `projection` | workspace, definition, modules, requirements, architecture, dependencies, plan, reviews, memory |
| `setup` | setup |
| `acquisition` | sources, ingestion *(read-only listing)* |
| `ingestion` | ingestion |
| `interview` | workspace |
| `pipeline` / `artifacts` | deliverables |
| `memory` | reviews, workspace |

**Consequence for Rooms:** the projection is already a revision-pinned
cross-cutting read, which is what §15 asks for. Rooms do not need a new
projection layer; they need to stop treating it as a bag and start naming which
slice each Room consumes.

## 3 · Component locality today

`PageLayout` is used by **12 of 13** routes — genuinely shared, correctly placed.
`statusVocabulary` by 6. Everything else in `components/project/` is used by
**one or two** routes:

| Component | Routes using it | Belongs to |
|---|---|---|
| `runVocabulary`, `neverClassified`, `ClassificationState` | 1 | Ingestion / Workspace |
| `skillSentences`, `NextAction`, `nextActionFloor`, `RecommendationCard` | 1 | Interview |
| `GeneratePackage` (827 lines) | 1 | Planning/Package |
| `unavailableReason` | 1 | Definition |
| `SectionsNotRead`, `sectionsNotRead` | 2 | shared — genuine |
| `StageReadiness`, `stagePrerequisites` | 2 | Architecture + Plan |
| `CapabilityNote` | 10 | shared — genuine |

So the directive's locality rule would move **most of `components/project/`** into
Room folders and leave a small genuine shared set: `PageLayout`,
`CapabilityNote`, `statusVocabulary`, `SectionsNotRead`, plus everything already
in `components/ui/`.

**One orphan, and it is mine.** `components/project/ProjectSources.tsx` — 530
lines — is imported by **no route**. I built `/sources` and removed it from
`/deliverables` without deleting it. Its test still passes because the test
imports it directly, which is exactly how a dead component keeps a green tick.

## 4 · Live, degraded, and absent capability

Ten of thirteen routes render a `CapabilityNote` or `FutureState`, so the honesty
mechanism is in place estate-wide. What differs is how much is behind it.

**Genuinely live and mutating:** `/setup` (10), `/workspace` (10), `/reviews` (4),
`/sources` (2), `/ingestion` (2), `/modules` (2).

**Read-only by nature:** `/definition`, `/requirements`, `/memory`,
`/deliverables` *(reads; `GeneratePackage` mutates through the pipeline port)*.

**Structurally empty:**

| Route | State |
|---|---|
| `/architecture` | 49 lines: `StageReadiness` + a hardcoded `FutureState` bullet list. No data. |
| `/plan` | 52 lines: the same shape, different bullets. **A near-duplicate of `/architecture`.** |
| `/dependencies` | 273 real lines that render nothing on a live deployment — the module graph is MCP-only |
| `/memory` | has a prose panel that says *"Not implemented in this prototype"* |
| `/reviews` | 3 of 5 groups hardcoded never-computable |

**Blocked on a credential, not on code:** `/sources` and the repository half of
`/ingestion`. `STUDIO_GITHUB_SOURCE_TOKEN` is unset on the deployment, so
`github_source: not configured` and no repository is reachable —
[`GITHUB_SOURCE_TOKEN.md`](../../../KAE-Ecosystem/deployment/GITHUB_SOURCE_TOKEN.md).

## 5 · The `/setup` responsibility inventory the directive asks for

Every responsibility currently on that one page, and where §6 says it goes:

| Responsibility | Today | Destination |
|---|---|---|
| Source repository, branch, working directory | text inputs | **Intake / Sources Room** — a picker, not a text field |
| Project kind, output format | text + select | **Intake**, inferred and confirmed |
| Add a GitHub connection (`env:` reference) | form on the page | **Settings → Connections** |
| Grant / check a connection | button on the page | **Settings → Connections** |
| Register an output destination | form on the page | **Project Settings** |
| Change the default destination | button on the page | **Project Settings** |
| Sources / Destinations state summary | panel | **Dashboard** |

**Seven responsibilities on one page** is what §5 means by *"too
information-heavy"*, and the split is not a matter of taste: four of the seven
are configuration and three are selection, which is the line §6 draws.

---

## 6 · Stage 1 — target route and ownership map

| Current route | Purpose | Destination | Owner folder | Behaviour change | Depends on |
|---|---|---|---|---|---|
| — | *(new)* project home | **Dashboard** `/` | `pages/dashboard/` | new surface | Stage 3 |
| `/setup` | configure everything | **split**: Intake `/start` · Project Settings `/settings/project` · Settings `/settings/connections` | `pages/setup/`, `pages/settings/` | **yes** — the point | `GH-CONNECT` |
| `/workspace` | conversation | **Interview Room** `/rooms/interview` | `pages/rooms/interview/` | route only | Stage 2 |
| `/sources` | repositories | **Sources Room** `/rooms/sources` | `pages/rooms/sources/` | absorbs `/ingestion` | Stage 5 |
| `/ingestion` | paste, files, runs | **merged into Sources Room** as a tab/subflow | `pages/rooms/sources/` | **yes** — §7 one Source abstraction | Stage 5 |
| `/definition` | what is being built | **Definition Room** `/rooms/definition` | `pages/rooms/definition/` | route only | Stage 2 |
| `/requirements` | statements by category | **Definition Room** subflow | `pages/rooms/definition/` | route only | Stage 5 |
| `/modules` | curation | **Architecture Room** subflow | `pages/rooms/architecture/` | route only | Stage 5 |
| `/architecture` | stub | **Architecture Room** `/rooms/architecture` | `pages/rooms/architecture/` | gains real content | `ARC-1` |
| `/dependencies` | build order | **Architecture Room** projection | `pages/rooms/architecture/` | route only | module graph over HTTP |
| `/plan` | stub | **Planning Room** `/rooms/planning` | `pages/rooms/planning/` | gains real content | Stage 6 |
| `/deliverables` | generate & publish | **Planning Room** subflow, or its own | `pages/rooms/planning/` | route only | Stage 5 |
| `/reviews` | proposed knowledge | **Review Room** `/rooms/review` | `pages/rooms/review/` | drops 3 dead groups | Stage 5 |
| `/memory` | provenance | **retained, `system`** — not a Room | `pages/memory/` | none | — |

**Nothing is retired.** `/memory` stays out of the Room set deliberately: §8 says
Rooms are user-intent surfaces and there must not be a Memory Room merely
because KAE-Memory exists — but the page answers *"why does KAE believe this"*,
which is a real question, so it keeps its route below the Advanced separator.

**Every old route redirects** to its destination until deep links are verified;
the directive forbids removing one before its replacement is proved.

## 7 · Conflicts this audit was required to surface

**§22:** *"Implementation should begin only after those outputs reveal any
conflicts with existing product/architecture contracts."* Three:

1. **Two information architectures.** `usable-kae/01` names seven *stages*
   — Project Setup, Discovery, Definition, Requirements, Architecture,
   Development Plan, Development Package — and this package names seven *Rooms*.
   They overlap on two. Ruled in
   [`UNATTENDED_DECISIONS.md`](../../../KAE-Ecosystem/development/UNATTENDED_DECISIONS.md)
   `D-2`: the package governs Studio's organisation; the stages remain a correct
   description of what a project goes through. They are different kinds of
   statement, so both stand, and the map above assigns every stage a home.

2. **`ADR-0003` already ruled how Project Setup reports state** — discrete
   `none · configured · verified`, never a percentage. The package's §3 wants
   the Dashboard to carry readiness *"using meaningful denominators"* and prefers
   `7 of 10 areas` to `70%`. **These agree**, and the Dashboard should reuse the
   existing rule rather than invent a second one.

3. **§5 says do not ask for what KAE can infer.** Memory models `inferred` and
   `suggested` values with evidence, `/setup` renders them — and **nothing in
   the estate produces a suggestion.** The state has a reader and no writer.
   Recorded as `INFER-1`; it is the difference between the intake flow §5
   describes and a shorter form.

## 8 · What this audit says to do first

In directive order, with the two that are already unblocked marked:

1. **Gate A — this document.** ✅
2. **`GH-CONNECT`** — Settings owns the connection, the workflow owns the
   picker. Independent of the folder move, and the feature the owner asked for.
3. **Stage 2 locality** — registries and page folders, one route at a time, no
   behaviour change. Delete the `ProjectSources` orphan as part of it.
4. **Stage 3 Dashboard** — smallest truthful version; it has real data to show
   because the projection already carries readiness, blockers and next action.
5. **Stage 5 Rooms** — merging `/ingestion` into the Sources Room is the first,
   because §7's Source abstraction is the one place the current split actively
   misleads.
