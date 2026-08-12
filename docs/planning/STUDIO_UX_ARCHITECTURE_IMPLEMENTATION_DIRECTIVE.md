# Studio UX Architecture Implementation Directive

Status: planning directive. This document instructs an implementation agent how to turn `../ui/STUDIO_UX_ARCHITECTURE_PACKAGE.md` into a safe, reviewable migration plan. It does not authorize a broad rewrite.

## Governing direction

Read first:

1. `../ui/STUDIO_UX_ARCHITECTURE_PACKAGE.md`
2. `../ui/WORKSPACE_VISUAL_DESIGN_PROPOSAL.md`
3. `../ui/PROJECT_DEFINITION_PRODUCTION_DESIGN_PROPOSAL.md`
4. `../ui/MODULES_PAGE_PRODUCTION_DESIGN_PROPOSAL.md`
5. `../product/USER_WORKFLOW.md`
6. `../architecture/SYSTEM_BOUNDARY.md`
7. `../architecture/API_CONTRACT.md`
8. `../../CLAUDE.md`

The target product model is:

`Dashboard -> focused Rooms/workflows -> project/global Settings`

The target code-organization principle is:

> Product locality should be visible in the filesystem. Keep one-page/one-Room code local; promote only genuinely shared primitives.

## Stage 0 — audit only

Do not begin route moves or UI redesign until the current implementation has been inventoried.

Produce:

- every user-visible route/hash and its rendering entry point;
- page-to-component dependency map;
- page-to-service/adapter map;
- shared state/context dependencies;
- route-specific CSS/style ownership;
- existing tests covering each route;
- mock-only, live, degraded, and dead controls/features;
- current Setup field/responsibility inventory;
- current Workspace, Definition, Modules, Reviews, Sources/Outputs, Architecture, Plan, Deliverables, Memory responsibilities;
- route/query/deep-link behavior that must not regress.

Classify each current page as one of:

- retained top-level surface;
- becomes Dashboard capability;
- becomes Room;
- becomes focused subflow within a Room;
- moves to Project Settings;
- moves to global Settings;
- merged into another surface;
- retired after capability-equivalent replacement;
- unresolved pending product decision.

No current functionality may simply disappear because the new information architecture is cleaner.

## Stage 1 — propose target route and ownership map

Create a table containing:

| Current route | Current purpose | Proposed destination | Owner folder | Behavior change? | Migration dependency |
| --- | --- | --- | --- | --- | --- |

The first proposal should include at least:

- Dashboard
- Project intake/start flow
- Interview Room
- Sources Room
- Definition Room
- Architecture Room
- Review Room
- Planning Room
- Project Settings
- global Settings / Connections

Treat Development Room as conditional unless its real capability is demonstrated.

## Stage 2 — establish architecture without redesign

Create/normalize:

- central route registry;
- Room registry;
- page/Room folders;
- per-folder `README.md` contracts;
- tests for route availability and registry uniqueness.

Move one route at a time. Preserve behavior. Keep commits reviewable. Do not combine broad visual redesign with structural relocation.

Suggested shape:

```text
src/
  app/
    router.*
    registries/
      routes.*
      rooms.*
  pages/
    dashboard/
    setup/
    rooms/
      interview/
      sources/
      definition/
      architecture/
      review/
      planning/
    settings/
  shared/
  services/
```

Adapt this to existing framework conventions instead of forcing unnecessary filename churn.

## Stage 3 — Dashboard walking skeleton

Build the smallest truthful Dashboard that can:

- show project identity;
- show journey/current stage from authoritative projection data;
- show up to three ranked attention/next-action items;
- launch an existing workflow/Room with context;
- show Room launchers with truthful availability;
- report unavailable data honestly.

Do not invent readiness, tasks, room status, or recent changes if the backing contract does not exist. Document missing contracts first.

## Stage 4 — Setup/intake split

Before implementation, map every existing Setup responsibility to one destination:

- Intake/start flow
- Sources Room
- Project Settings
- global Settings/Connections
- another existing Room
- retire because inferred/redundant

The main intake flow should use progressive steps or focused pages, not a universal form.

Repository behavior target:

- if GitHub is connected: searchable repository selector/picker;
- project workflow selects repo and branch;
- connection/auth/install management lives in Settings;
- repository analysis produces visible processing/result state;
- failure leads to actionable recovery, not dead-end configuration fields.

## Stage 5 — Rooms conversion

For each Room create a contract before implementation:

```text
Purpose
User questions answered
Entry conditions
Data/projections
Contextual toolbelt
Empty/loading/degraded states
Exit conditions
Allowed transitions
Explicit non-ownership
```

A page is not considered converted merely because its heading says `Room`.

## Stage 6 — action/work management model

Before adding a board, establish a shared action/work model. At minimum evaluate:

- recommended action;
- blocker;
- review item;
- open question;
- decision;
- gap;
- implementation task/work item.

Do not collapse these into one vocabulary if their semantics differ. A common routing envelope may reference distinct typed entities.

Define:

- destination Room;
- objective;
- project/revision;
- affected entity IDs;
- priority/severity;
- blocking state;
- completion rule;
- return destination.

Only then evaluate backlog/Kanban/timeline projections.

## Stage 7 — visual hardening

After core responsibilities are stable:

- reduce card/container overuse;
- establish page width/density rules;
- define primary/secondary action hierarchy;
- implement semantic design tokens;
- add focus modes for appropriate Rooms;
- ensure mobile-specific interaction patterns;
- validate keyboard/screen-reader graph, board, and interview interactions.

## Required guardrails

- Do not rewrite the frontend.
- Do not change KAE-Memory ownership boundaries.
- Do not expose privileged credentials to browser code.
- Do not migrate functionality into `shared/` merely to make imports shorter.
- Do not create generic global components for domain-specific UI before reuse is demonstrated.
- Do not make page structure depend on backend microservice names.
- Do not remove old routes until redirects/deep links and replacement behavior are verified.
- Do not mix source revisions in Dashboard/Room projections.
- Do not present unavailable capability as disabled-looking but otherwise real functionality without explaining the prerequisite.

## Proposed review gates

### Gate A — architecture map

Review current-route inventory, target-route map, and responsibility split. No UI changes required.

### Gate B — locality refactor

Review folder structure, route/Room registries, and behavior parity.

### Gate C — Dashboard

Review Dashboard information hierarchy and truthful action routing.

### Gate D — Intake

Review progressive setup/intake and Settings separation.

### Gate E — Rooms

Review each Room independently against its contract.

### Gate F — work management

Review work/action semantics before board/backlog implementation.

## Definition of done for this initiative

The initiative is not done merely when new pages exist. It is done when:

- Dashboard is a reliable project home;
- users can understand and launch their next work without scanning dense forms;
- Rooms isolate task-specific tools and context;
- Setup/intake uses progressive disclosure;
- integration configuration is separated from ordinary resource selection;
- the repository mirrors product ownership clearly enough that a developer can locate page code quickly;
- route and Room ownership is centrally discoverable;
- existing capability is preserved or deliberately replaced;
- degraded/error states are explicit;
- tests protect navigation, state truth, and architectural locality.