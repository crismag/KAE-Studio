# Modules Page Production Design Proposal

Status: proposed product-design and implementation direction.

Scope: the KAE-Studio **Modules** route. This document builds on `PROJECT_MODEL.md`, `MODULE_SPECIFICATION.md`, `USER_WORKFLOW.md`, and the Workspace and Project Definition proposals. It does not redefine Memory-owned project truth or readiness.

## 1. Product purpose

The Modules page answers:

> What are the major parts of this system, why are those boundaries appropriate, how do they relate, and which part is safe to implement next?

It is the bridge from project definition to executable software planning. It must not be a static list of AI-generated component names. A production page is simultaneously:

1. **A decomposition workspace** — Studio proposes boundaries and the user curates them.
2. **A system map** — responsibilities, data ownership, interfaces, workflows, and dependencies become visible.
3. **A readiness portfolio** — each module has honest, per-dimension implementation readiness.
4. **A boundary-review surface** — users can detect overlap, missing ownership, excessive coupling, and unclear responsibility.
5. **A navigation hub** — selecting a module leads to its requirements, interfaces, data, decisions, tests, plan, and package.
6. **A change-impact surface** — upstream changes and split/merge decisions reveal affected work.
7. **A delivery selector** — users can identify the next module to refine, review, package, or implement.

The page becomes useful before any module is implementation-ready. It becomes displayable as soon as KAE can honestly explain whether decomposition is unavailable, eligible, running, proposed, accepted, or stale.

## 2. Current live-page assessment

The deployed page currently shows:

- the title and a good governing promise;
- “0 accepted”;
- “0 proposed.”

It does not explain whether zero means:

- the project definition is insufficient;
- decomposition has not been requested;
- analysis is queued or failed;
- no module candidates were found;
- a projection is unavailable;
- all proposals were rejected;
- the project genuinely needs no decomposition.

There is no readiness criterion, trigger, acquisition action, decomposition action, empty-state explanation, revision, provenance, or useful graphic. The counters therefore describe absence without helping the user advance.

## 3. Repository-grounded role and current capability boundary

The repository makes the intended role much more precise than the live empty page.

### 3.1 What is already designed in the frontend

`src/app/routes/Modules.tsx` is not an empty placeholder. It already prototypes:

- proposed, accepted, and rejected module lifecycle presentation;
- module identity, purpose, and “Why this boundary” rationale;
- accept, rename, split, merge, reject, restore, and undo controls;
- per-dimension readiness;
- counts for requirements, dependencies, interfaces, open decisions, and blocking dependencies;
- an expandable canonical module specification containing responsibilities, non-responsibilities, inputs, outputs, requirements, interfaces, data, dependencies, failure behavior, acceptance criteria, open decisions, and an implementation-readiness conclusion.

The mock service records these curation actions as decisions and conservatively keeps linked content during a split. This demonstrates the intended UX, but it is not evidence that live persistence semantics exist.

### 3.2 What the live backend deliberately does

The live backend currently returns:

```json
{
  "available": false,
  "gap": {
    "capability": "modules",
    "reachable_by": "MCP",
    "reason": "Studio curation is a separate contract, still to be reconciled (N12)."
  },
  "results": []
}
```

This is intentional. Repository comments state that KAE-Memory exposes modules over MCP for a coding agent implementing one module, while Studio's human curation workflow is a different act. Returning an ordinary empty array would falsely claim that the project was inspected and has no modules.

The live client also refuses every module decision with `CapabilityUnavailable`. Therefore, the current zero counters on the deployed page are a rendering defect: they flatten “capability unavailable” into “0 accepted / 0 proposed.”

### 3.3 What the page is for

The repository establishes two related consumers:

| Consumer | Purpose | Required access |
| --- | --- | --- |
| Coding agent through MCP | Retrieve a bounded module graph/context for implementation | Module-scoped read, traversal, readiness, context assembly |
| Human through Studio | Propose, understand, curate, approve, and revalidate decomposition | Revision-pinned projection plus versioned decision commands |

The Modules page is specifically the **human decomposition and implementation-readiness control surface**. It must not become merely a visual copy of the MCP response, and the MCP-only agent contract is insufficient for its write semantics.

### 3.4 Production prerequisite: resolve N12

Before the production page may display live module cards or enable curation, N12 must define and verify:

- revision-pinned module projection over Studio's trusted server path;
- stable module identity and lifecycle;
- module relationships and traversal;
- Memory-owned per-dimension readiness;
- provenance and decomposition rationale;
- optimistic-concurrency/version guards;
- accept, reject, rename, add, defer, split, and merge commands;
- complete split/merge mapping semantics;
- invariant findings and affected-entity/change-impact results;
- authorization, tenancy, idempotency, and audit behavior.

Until then, the correct production behavior is a capability-gap state that names N12 and explains that module information may exist for agents without yet being safely curatable in Studio.

## 4. When the page is available

The route should always be navigable. Its **mode** changes with project state.

| Mode | Entry condition | Page behavior | Primary action |
| --- | --- | --- | --- |
| Not established | No usable project evidence or definition | Explain inputs needed for decomposition | Acquire repository/documents or start definition |
| Definition forming | Some evidence exists, but minimum boundary signals are insufficient | Show prerequisite coverage and missing signals | Resolve the highest-value definition gap |
| Eligible | Minimum signals exist; no decomposition run exists | Explain why analysis is now possible | Propose modules |
| Analyzing | Decomposition run is queued/running | Show run status and safe partial findings | View run; cancel/retry only when allowed |
| Proposals ready | Candidate modules exist, none or some accepted | Show rationale, confidence, conflicts, and review queue | Review decomposition |
| Curated | Accepted modules exist | Show portfolio, topology, readiness, and next actions | Refine selected module |
| Stale | Upstream evidence changed after decomposition revision | Retain last safe map with impact warnings | Revalidate affected modules |
| Degraded | Projection or one subsection failed | Show known state and identify unavailable portions | Retry/diagnose |
| Unauthorized/not found | Access fails | Reveal no project details | Return to safe project selection |

Never hide the page simply because modules do not exist. An unavailable page should still explain why and launch the correct workflow.

## 5. Minimum signals for decomposition

Decomposition should not require a perfectly complete Project Definition. It should require enough evidence to propose meaningful boundaries and label uncertainty.

Useful signals include:

- a problem and intended outcome;
- primary actors;
- at least one workflow or capability cluster;
- known data entities or records;
- external systems/integrations;
- security, compliance, or ownership boundaries;
- existing repository structure for an established application;
- relevant constraints and deployment boundaries.

KAE-Memory or a server-side policy owns eligibility. The browser displays the result and reasons; it must not invent a readiness formula.

A proposed eligibility contract:

```ts
type DecompositionEligibility = {
  state: "not_established" | "forming" | "eligible" | "blocked"
  sourceRevision: string
  usableSignals: Signal[]
  missingSignals: Signal[]
  blockers: Blocker[]
  recommendedAction?: Action
}
```

Eligibility is not module readiness. It only states whether producing a reviewable candidate decomposition is worthwhile.

## 6. Triggers

### 5.1 Explicit triggers

The user can trigger **Propose modules** when eligible. The action must preview:

- evidence revision used;
- decomposition policy/strategy;
- existing modules that may be affected;
- whether this creates new proposals or revalidates existing ones.

### 5.2 Automatic suggestions, not silent mutation

Studio may recommend decomposition when:

- a repository acquisition completes;
- the Project Definition reaches eligibility;
- primary workflows become known;
- a substantial architecture or integration document is ingested;
- an existing-project scan identifies stable package/service boundaries.

It may run analysis automatically only under an explicit project policy. Results remain proposed. KAE must never silently accept module boundaries.

### 5.3 Revalidation triggers

Revalidation is suggested when a newer revision materially changes:

- scope;
- primary workflows;
- actor authority;
- data ownership;
- external integrations;
- architecture constraints;
- module-owned requirements;
- repository structure.

A minor wording correction should not stale the entire map. The backend returns affected module IDs and reasons.

### 5.4 User-curation triggers

Accept, rename, add, reject, defer, split, and merge are decomposition decisions. Each creates a revision request with provenance and impact preview. Split and merge require explicit mapping of requirements, interfaces, data, dependencies, tests, and open decisions; unresolved mappings remain visible and block completion.

## 7. Valuable page contents

### 6.1 Header and portfolio status

Show:

- Modules;
- decomposition state;
- project/model revision and freshness;
- accepted, proposed, contested, stale, and blocked counts;
- overall portfolio readiness summary;
- primary ranked action;
- view selector: Portfolio, Map, Matrix, Changes.

Example:

> **Decomposition review needed** · Revision 42  
> 5 accepted · 2 proposed · 1 boundary conflict  
> **Next: Decide ownership of User Profile data**

### 6.2 Decomposition rationale

Provide a concise explanation of how candidates were derived:

- workflow boundaries;
- responsibility/cohesion;
- authoritative data ownership;
- integrations;
- security/compliance boundaries;
- repository evidence;
- relevant constraints.

Each module exposes its specific rationale and trace sources. Do not expose private chain-of-thought; show evidence-linked conclusions and heuristics.

### 6.3 Module portfolio cards

Each card should include:

- stable module ID and name;
- one-line business purpose;
- lifecycle state;
- readiness by dimension;
- top responsibilities and explicit non-responsibilities;
- owned data count;
- exposed/consumed interface count;
- dependencies/dependents count;
- unresolved decisions and invariant findings;
- evidence/provenance summary;
- last changed revision;
- ranked next action.

Cards should be compact enough to compare. Full specifications belong in a module detail drawer or route.

### 6.4 Module detail

Selecting a module opens a persistent detail view containing the canonical specification:

- purpose;
- responsibilities/non-responsibilities;
- inputs/outputs;
- linked requirements;
- interfaces;
- data ownership;
- dependencies;
- business rules;
- failure behavior;
- security/permissions;
- acceptance criteria;
- open decisions;
- implementation readiness;
- provenance and history;
- package/generation status.

Every absent section is an explicit gap.

### 6.5 Findings and boundary quality

Surface actionable structural findings:

- overlapping responsibilities;
- unowned or multiply-owned data;
- dependency cycles;
- orphan requirements;
- interfaces without owners;
- workflows not realized by modules;
- oversized “god” modules;
- modules with no business purpose;
- accepted modules built mainly from proposed knowledge;
- split/merge mappings incomplete.

Heuristic findings must be labeled advisory unless they violate a defined invariant.

### 6.6 Recommended work

Rank a small number of actions based on downstream value:

- review one proposed module;
- settle a boundary conflict;
- assign data ownership;
- resolve a blocking decision;
- specify an interface;
- add acceptance tests;
- revalidate a stale module;
- generate a bounded context package.

Avoid a long undifferentiated issue list.

## 8. Best data representations

The default view should be a **portfolio**, not a graph. Graphs become noisy and less useful as the project grows.

### 7.1 Portfolio view — default

Use a responsive grid/list of module cards with filters:

- lifecycle;
- readiness;
- blocked/stale;
- delivery phase;
- owner/team when known;
- search.

Sort options: recommended next, lowest readiness, dependency order, recently changed, name.

### 7.2 System map — boundaries and relationships

Use a node-link or grouped boundary map when topology matters:

- modules as nodes;
- typed dependency/interface edges;
- external systems visually distinct;
- data ownership shown on selection, not as every edge at once;
- workflow overlay optional;
- direction and cycles explicit;
- zoom, pan, focus, and keyboard navigation;
- synchronized text/table alternative.

The map must render only typed model edges. It must not infer plausible connections in the browser.

### 7.3 Readiness matrix — comparison

A heatmap/table is best for exact comparison:

| Module | Req. | Interfaces | Data | Security | Ops | Tests | UI | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Cells show canonical categorical states: complete, draft, incomplete, blocked, not applicable, unavailable. Color is reinforced with text/icon/pattern. Selecting a cell opens the evidence and next action behind that status.

Do not collapse readiness into a single opaque percentage. An optional score may summarize only when policy and denominator are disclosed.

### 7.4 Dependency/build-order view

Use a dependency graph or layered ordered list to answer:

- what can start now;
- what must precede it;
- which module is blocking several others;
- where cycles exist;
- which dependencies are runtime, build, data, or operational.

Build order is derived only when the graph is valid. If a cycle exists, show that ordering is unavailable and launch resolution.

### 7.5 Change-impact view

Compare the current decomposition revision with a selected earlier revision:

- modules added, renamed, split, merged, rejected, or superseded;
- requirements/interfaces/data moved;
- affected plans and packages;
- modules requiring revalidation.

Use a change table and focused before/after diagram. Avoid animation as the only explanation.

## 9. Decomposition review workflow

A review queue should support one candidate or coherent batch at a time.

For each proposal, show:

- proposed boundary and purpose;
- included responsibilities;
- excluded responsibilities;
- rationale and evidence;
- alternatives considered at a product level;
- overlap/conflict warnings;
- downstream implications;
- actions allowed.

Actions:

- Accept;
- Rename;
- Refine responsibilities;
- Split;
- Merge with…;
- Reject with reason;
- Defer;
- Add module;
- Inspect evidence.

“Accept all” is allowed only after a review summary identifies every candidate and outstanding conflict. Acceptance does not mean implementation-ready.

## 10. Truth, status, and consistency rules

- All counts and graphics belong to one project and revision.
- Unknown/unavailable is never serialized or rendered as zero.
- Proposed modules are never presented as accepted architecture.
- A renamed module retains stable identity.
- Rejected candidates remain in history so they are not repeatedly proposed.
- Split/merge never silently drops linked entities.
- Readiness is Memory-owned and per dimension.
- Dependency cycles and ownership violations are displayed, not repaired silently.
- Workspace, Definition, Modules, Architecture, Dependencies, and Plan use compatible projections.
- Fixture/example modules never appear as current project state.
- Repository folders may provide evidence but are not automatically equivalent to product modules.

## 11. Suggested projection contract

```ts
type ModulesProjection = {
  projectId: string
  revision: string
  generatedAt: string
  freshness: "current" | "pending" | "stale" | "unavailable"
  mode: ModulesPageMode
  eligibility: DecompositionEligibility
  summary: ModulePortfolioSummary
  modules: ModuleSummary[]
  relationships: ModuleRelationship[]
  findings: StructuralFinding[]
  recommendedActions: Action[]
  recentChanges: DecompositionChange[]
  run?: DecompositionRunSummary
}
```

A `ModuleSummary` includes stable identity, lifecycle, purpose, readiness dimensions, counts/links, blocker summary, trace references, last-change revision, and allowed actions.

Preferred server boundary:

```http
GET  /v1/projects/{project_id}/modules?revision=current
POST /v1/projects/{project_id}/module-decompositions
GET  /v1/runs/{run_id}
POST /v1/projects/{project_id}/model/revisions
POST /v1/projects/{project_id}/model/traversals
```

Exact endpoints must be reconciled with current KAE-Memory contracts. Studio must not create a second authoritative module store.

## 12. Empty, pending, stale, and failure behavior

### Empty/not ready

State why decomposition is premature and show the minimum missing signals. Never render only “0 modules.”

### Eligible/not run

Explain that enough project evidence exists and offer **Propose modules**.

### Pending

Show evidence revision, run status, started time, and safe retry behavior. Partial candidates must be labeled incomplete.

### Stale

Retain the last safe map and label affected modules. Explain the upstream change and offer scoped revalidation.

### Degraded

Render available portfolio data and mark unavailable graphics/sections. A failed graph traversal must not erase module cards.

### No decomposition appropriate

For a legitimately tiny project, allow a confirmed single-module or “no further decomposition” decision with rationale. This is different from no data.

## 13. Responsive, themed, and accessible behavior

### Desktop

- sticky status/action header;
- portfolio or matrix in main region;
- detail drawer/panel;
- map expands into the full content area.

### Tablet

- card/list default;
- filters collapse;
- detail uses drawer;
- matrix horizontally scrolls with sticky labels.

### Mobile

- summary and next action first;
- modules as ordered cards;
- readiness dimensions in an expandable list;
- graph defaults to accessible dependency list with optional full-screen map;
- all curation operations remain possible without drag-and-drop.

### Themes and accessibility

- light, dark, print, and high-density views use semantic design tokens;
- statuses use labels/icons/patterns as well as color;
- graph and matrix have keyboard and screen-reader alternatives;
- visible focus, minimum touch targets, reduced motion, and sufficient contrast;
- no hover-only details;
- screen-reader summary announces portfolio state and changes after a revision.

## 14. Permissions and collaboration

Suggested roles:

- viewer: inspect allowed projections and exports;
- contributor: propose modules and corrections;
- reviewer: accept/reject/defer and curate boundaries;
- owner/admin: project policies and high-impact operations.

Use revision guards for concurrent edits. If the model advanced, show the conflicting change and require reconciliation. Audit decomposition decisions, actor, source revision, target entities, result revision, and reason.

## 15. Performance and observability

- cache by project and revision;
- load portfolio before large topology traversals;
- lazy-load module detail and trace history;
- bound/cluster large graphs;
- cancel obsolete requests after project/revision switch;
- measure projection latency, decomposition-run completion, review completion, stale frequency, graph failures, and time to first accepted decomposition;
- do not prefetch unauthorized project evidence.

## 16. Delivery sequence

### Phase 0 — Truth prerequisite

- Remove fixture/cross-project leakage.
- Pin project/revision.
- Represent unavailable separately from zero.
- Verify stable module identity and lifecycle contracts.
- Establish authentication and tenant boundaries.

### Phase 1 — Honest activation

- Implement page modes and eligibility explanation.
- Add header, freshness, counts, and ranked action.
- Add meaningful empty/pending/stale/failure states.
- Add explicit decomposition trigger and run status.

### Phase 2 — Portfolio and review

- Add module cards and module detail.
- Add proposal review and controlled curation.
- Add provenance and revision guards.
- Add structural findings and filters.

### Phase 3 — Graphical intelligence

- Add readiness matrix.
- Add typed system/dependency map with accessible fallback.
- Add boundary-quality and build-order views.
- Add change-impact comparison.

### Phase 4 — Production hardening

- Complete split/merge semantics.
- Add permission-aware collaboration and audit.
- Harden responsive themes, accessibility, resilience, and performance.
- Integrate bounded module package generation.

## 17. Acceptance criteria

- **MOD-AC-01 — Honest zero:** Zero modules is always accompanied by a specific state and useful action.
- **MOD-AC-02 — Activation:** The page explains whether decomposition is premature, eligible, running, ready for review, curated, stale, or unavailable.
- **MOD-AC-03 — Traceability:** Every proposed/accepted module exposes rationale, evidence, lifecycle, and revision.
- **MOD-AC-04 — Human authority:** No AI-proposed module is silently accepted.
- **MOD-AC-05 — Stable identity:** Rename, split, merge, reject, and supersession preserve traceable identities and history.
- **MOD-AC-06 — Readiness:** Per-dimension readiness is shown without substituting a misleading aggregate.
- **MOD-AC-07 — Structural integrity:** Cycles, ownership conflicts, orphan requirements, and interface-owner gaps are visible.
- **MOD-AC-08 — Actionability:** Every incomplete, proposed, contested, blocked, or stale module has a focused next action.
- **MOD-AC-09 — Graphic honesty:** Maps and matrices render only authoritative typed nodes, edges, and states.
- **MOD-AC-10 — Cross-view consistency:** Modules, Dependencies, Architecture, Requirements, and Plan agree at the same revision.
- **MOD-AC-11 — Safe curation:** Split/merge previews and preserves or explicitly remaps linked entities.
- **MOD-AC-12 — Resilience:** A traversal or graph failure does not erase the usable portfolio.
- **MOD-AC-13 — Authorization:** Module data, trace, and actions respect tenant/project roles.
- **MOD-AC-14 — Responsive access:** Core review and curation work on desktop, tablet, and mobile.
- **MOD-AC-15 — Accessibility:** Every graphic has keyboard, non-color, and screen-reader-equivalent meaning.

## 18. Non-goals

This proposal does not:

- equate repository folders, deployable services, teams, or UI pages automatically with modules;
- turn Modules into a diagramming canvas detached from project truth;
- duplicate full Requirements, Interfaces, Dependencies, Architecture, or Plan pages;
- allow Studio to recompute authoritative readiness;
- require a complete Project Definition before useful proposals;
- imply accepted means implementation-ready;
- fabricate modules or relationships to make the page look populated.

## 19. Product outcome

The production Modules page should tell one coherent story:

> KAE has derived reviewable system boundaries from the available evidence. The user can understand why each boundary exists, curate it safely, see how the parts connect, identify structural risks, and choose the next module that can be made ready or implemented.

This is where KAE stops being only a requirements collector and starts becoming a software planning system.
