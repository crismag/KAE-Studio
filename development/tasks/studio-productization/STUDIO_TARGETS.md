# KAE Studio Targets

## ES-1 — Real project lifecycle and active-project shell

### Problem

Studio chooses one runtime project and displays it as static “Current project” text. A user cannot list, create, select, reopen, archive, or distinguish projects.

### Actions

- Define the smallest versioned Studio client contract for list, create, get, and select project operations.
- Add a project landing/selection state before project routes.
- Add **New project** with sparse setup: name plus optional initial context. Unknowns remain allowed.
- Persist only the active-project preference in Studio/browser-owned state; durable project identity remains in Memory.
- Scope query keys, conversation, projections, review mutations, and invalidation by project ID.
- Make route entry without a selected project redirect to the selector, not a fixture.
- Provide explicit loading, unavailable, empty-list, create-failure, and deleted/inaccessible-project states.
- Do not add archive/delete until Memory exposes deliberate lifecycle semantics.

### Acceptance proof

1. Create Project A and Project B.
2. Add distinguishable input to each.
3. Switch between them and verify no messages, requirements, decisions, modules, or deliverables cross.
4. Reload and reopen the chosen project.
5. Open a deep link with no active project and recover through project selection.
6. Verify internal UUIDs are not the normal project label.

---

## ES-2 — Cross-route projection coherence

### Problem

The deployed routes disagree: Requirements/Reviews contain many extracted items, Memory reports zero knowledge/evidence, and Plan/Deliverables refer to entities absent from Modules.

### Actions

- Establish a route-level projection context containing selected project identity, Memory revision, load time, and capability availability.
- Make each route render only records from that context.
- Remove remaining fixture fallbacks once a real project is selected.
- Reconcile count labels by naming their domain: observations, extracted proposals, confirmed knowledge, requirements, review items.
- Add invariant diagnostics for impossible UI combinations, such as a dependency referring to an absent module.
- Prefer “unavailable from the current contract” over a plausible empty value when data was not returned.
- Extend UUID hiding to Open decisions and any uncovered normal-user surface.

### Acceptance proof

For one selected project, every route shows the same human-readable project and revision; aggregate counts reconcile by definition; no referenced entity is absent from its owning route; a contract failure is visibly different from an empty project.

---

## ES-3 — Conversation workspace usability

### Problem

Development traffic produces an extremely long transcript. Repeated generic instruction cards obscure the active move, and the most useful current context is below historical noise.

### Actions

- Make the latest CIE move and composer the primary interaction.
- Collapse or paginate older transcript segments without losing durable history.
- Visually distinguish user messages, CIE moves, extraction/review events, and transport/system notices.
- Render turn metadata once per turn; do not repeat generic “answer or accept assumption” cards as independent responses.
- Preserve “Discuss this” as composer-prefill only.
- Provide clear controls for retryable failure, skipped/deferred topics, and returning to the latest move when supported.
- Treat test/development traffic markers as display metadata only; exclusion from acquisition belongs to Memory.

### Acceptance proof

A project with 100 messages remains usable on desktop and mobile; the current question and composer are immediately reachable; one submitted message yields one visible user turn and at most one visible CIE move; history remains accessible.

---

## ES-4 — Actionable page states

### Problem

Several pages are structurally sensible but render blank documents or static blockers with no trustworthy route forward.

### Actions by route

- **Project Definition:** show “Not established yet” per section plus **Discuss this**.
- **Modules:** show **Continue discovery** when decomposition is premature; show **Ask KAE to propose modules** only when a real capability exists.
- **Interfaces:** offer **Discuss integrations** and explain prerequisites.
- **Architecture:** derive blockers from current state and link each prerequisite to its route/action.
- **Dependencies:** avoid MCP/implementation jargon; explain that accepted modules are prerequisite.
- **Plan:** show no build order unless it is derivable from current accepted modules and relationships.
- **Deliverables:** render actual package cards or a precise missing-prerequisites state.
- Remove or disable any action that cannot complete against the current contract.

### Acceptance proof

Every empty or blocked route answers: what is missing, why it matters, and the one valid next action. No page cites a module, decision, or deliverable absent from the selected project.

---

## ES-5 — Requirements and Reviews at scale

### Problem

Large noisy acquisition histories overwhelm both pages, provenance classifications are too broad, and counts are difficult to reconcile.

### Actions

- Consume canonical/supersession information from Memory when EM-3 provides it.
- Present one canonical item with expandable evidence/version history rather than every duplicate as a peer row.
- Separate conversation extraction, document extraction, coding-agent proposal, assumption, unknown, and confirmed knowledge using stored provenance only.
- Add search, lifecycle/source filters, sort, and pagination or virtualization.
- Add bulk confirm/reject only where API semantics remain individually auditable.
- Add correction to the normal review path.
- Keep proposed/assumed/confirmed states visually distinct.
- Do not invent requirement-level acceptance criteria until Memory models them.

### Acceptance proof

A dataset with repeated evidence remains understandable; totals reconcile; provenance is accurate; bulk review records individual auditable outcomes; a canonical item retains access to every supporting source.

---

## ES-6 — Planning and deliverable truthfulness

### Problem

Plan and Deliverables currently make claims about dependencies and packages that do not correspond to visible selected-project entities.

### Actions

- Derive availability from selected-project module, relationship, readiness, and deliverable contracts.
- Represent generated artifacts as cards with type, revision, readiness, unresolved decisions, target, and lifecycle.
- Separate “can generate,” “generated,” and “published.”
- Carry unresolved decisions into generation; never resolve them for presentation.
- Remove Report Management/Approval Workflow fixture residue.
- Keep generation disabled with precise prerequisites when no reproducible package can be made.

### Acceptance proof

The same revision and unresolved decisions appear in source routes and deliverable cards. A project with no accepted modules cannot claim module packages or a build plan.

---

## ES-7 — Diagnostics and settings

### Problem

The footer conflates transport state with project quality, Memory contradicts other routes, revision is blank, Agent activity is unimplemented, and Settings is a no-op.

### Actions

- Replace “Memory: synchronised” with separate connectivity, last projection refresh, revision, and health/quality indicators.
- Connect Memory diagnostics to real contract data or explicitly mark fields unavailable.
- Remove unimplemented Agent activity until a real source exists.
- Implement the current minimum settings surface or remove/disable the control with an honest explanation.
- Show when authentication is disabled in a development deployment.
- Replace the global “Prototype — mock data” label with capability-specific status reflecting the actual active adapters.

### Acceptance proof

No green/synchronised label is shown for an unknown or failed state. Settings always causes a visible result. Status accurately reports the selected project and deployed adapter/authentication configuration.

---

## ES-8 — Deployed vertical validation

### Scenario

1. Open Studio with no selected project.
2. Create a project using only a name and one sentence.
3. Complete several CIE turns.
4. Observe project-specific definition/readiness updates.
5. Review, correct, confirm, reject, and defer supported items.
6. Leave the application, return, and select the same project.
7. Verify the conversation, knowledge, revision, and review state persist.
8. Create a second project and verify isolation.
9. Verify every route's empty/blocked/generated state against the same revision.

### Required checks

- desktop and mobile;
- browser console clean;
- accessibility names for actions;
- no horizontal overflow;
- one user submission produces one durable message;
- no UUIDs in ordinary presentation;
- no fixture entity names;
- no CockroachDB-specific test requirement.
