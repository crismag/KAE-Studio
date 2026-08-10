# Project Definition Production Design Proposal

Status: proposed product-design and implementation direction.

Scope: the KAE-Studio **Project Definition** route. This document builds on `UI_GENERATION_CONTEXT.md`, `WORKSPACE_VISUAL_DESIGN_PROPOSAL.md`, the canonical `PROJECT_MODEL.md`, and the candidate Studio-to-Memory API contract. It does not redefine Memory-owned readiness or project truth.

## 1. Product purpose

The Project Definition page is the canonical, human-readable answer to:

> What are we building, for whom, why, within which boundaries, and what remains uncertain?

It must not be a blank report template or a passive export preview. A production-grade page is simultaneously:

1. **A project charter** — a concise, readable statement of intent and boundaries.
2. **A truth projection** — revision-pinned content derived from the authoritative project model.
3. **A coverage diagnostic** — an honest view of confirmed, proposed, missing, contested, and stale areas.
4. **A refinement workspace** — users can review, correct, source, and complete the definition.
5. **A workflow gate** — it explains what downstream work is available, risky, or blocked.
6. **A decision surface** — uncertainty becomes actionable questions, decisions, or acquisition tasks.
7. **A traceable record** — every material statement can be traced to evidence and history.

The page succeeds when a new user can understand the project and its most important deficiency in under a minute, while an experienced user can inspect evidence, resolve uncertainty, and safely advance the project without returning to an unstructured chat.

## 2. Current-page assessment

The deployed page has a calm, credible document layout and a sensible section inventory:

- problem;
- value;
- objectives;
- stakeholders;
- in scope;
- out of scope;
- business workflows;
- assumptions;
- constraints.

Its current behavior, however, is an empty formatted document. Blank cards and table headers do not distinguish:

- no evidence acquired;
- analysis pending;
- knowledge proposed but awaiting review;
- confirmed knowledge;
- a projection or service failure;
- knowledge removed or made stale by a newer revision.

Other issues observed:

- Workspace can display a “Current Understanding” while Definition remains empty.
- Empty scope cards use symbols that resemble successful status.
- The only recovery action is a generic return to Workspace.
- Revision is unreported.
- Provenance is promised but cannot be inspected.
- There is no definition coverage, dependency impact, or meaningful progress graphic.
- Sections cannot launch focused acquisition, review, or interview workflows.
- Missing definition does not explain why Architecture, Modules, Plan, or Deliverables are affected.

The visual foundation should be retained. The behavior and state model need to change.

## 3. Definition boundary

Project Definition owns the readable, project-level definition. It does not duplicate every requirement, module specification, architecture decision, or implementation plan.

### 3.1 Included

- problem and painful activity;
- intended value and outcomes;
- objectives and success measures;
- users, actors, stakeholders, and responsibilities;
- scope, exclusions, and undecided boundaries;
- primary business workflows;
- business rules relevant to project identity;
- assumptions and their validation status;
- constraints;
- key risks and definition-level open decisions;
- definition coverage and downstream impact;
- provenance and revision history.

### 3.2 Linked, not duplicated

| Related view | Definition shows | Dedicated view owns |
| --- | --- | --- |
| Requirements | concise requirement themes and definition gaps | individual CR/FR/QR/IR/SR/OR items and acceptance |
| Modules | emerging capability boundaries and blocked state | module responsibilities, interfaces, data, readiness |
| Architecture | architectural implications and blockers | components, deployment, integrations, ADRs |
| Dependencies | important definition-level dependencies | complete typed dependency graph |
| Plan | delivery implications | phases, work packages, sequencing |
| Reviews | summarized unresolved/contested counts | review queues and resolution workflow |
| Memory | source preview and trace link | detailed evidence, revisions, supersession history |

Definition must never become a second authoritative store. User changes are submitted as evidence/revision commands and the page re-projects from Memory.

## 4. Shared truth and consistency contract

Workspace, Definition, Requirements, and downstream views must consume compatible projections from one project and one revision.

Every Definition response must include:

- project identifier;
- source revision;
- generated timestamp;
- freshness: `current | pending | stale | unavailable`;
- section availability;
- status counts;
- source/trace references;
- incomplete or degraded reasons;
- downstream impacts calculated by authoritative rules or explicit dependency metadata.

### 4.1 Required invariants

- A missing field is not serialized as a confirmed empty string.
- Unavailable data is not represented as zero.
- Proposed knowledge is not rendered as accepted fact.
- Counts from different revisions are not combined.
- Fixture or demo content never fills a real-project projection.
- A statement appearing in Workspace Current Understanding must either appear in Definition at the same revision or carry an explicit reason why it is excluded.
- User edits do not optimistically become confirmed truth before Memory accepts the revision.
- A superseded statement remains available in history but not in the current charter.
- Definition status is not independently recomputed in the browser.

## 5. Production information architecture

### 5.1 Sticky page header

Show:

- **Project Definition**;
- human status, such as “Definition forming” or “Ready for architecture review”;
- revision and freshness;
- confirmed/proposed/missing/contested summary;
- primary recommended action;
- secondary actions: export snapshot, compare revision, open trace.

Example:

> **Definition forming** · Revision 27 · updated 8 minutes ago  
> 5 confirmed areas · 2 proposed · 1 blocking gap  
> **Next: Connect the repository to validate current scope**

A percentage may appear as supporting information only when its denominator and policy are available.

### 5.2 Definition coverage navigator

Use a compact segmented navigator for:

- Problem
- Value
- Objectives
- People
- Scope
- Workflows
- Assumptions
- Constraints

Each segment includes label, icon/shape, status, and issue count. Selecting it scrolls to the section and focuses its primary action.

Canonical presentation states:

| State | Meaning | Typical action |
| --- | --- | --- |
| Confirmed | Sufficient human-confirmed content exists | Inspect or refine |
| Proposed | Content exists but awaits review | Review proposal |
| Incomplete | Some useful content exists but coverage is insufficient | Continue focused discovery |
| Missing | No authoritative content exists | Answer or acquire evidence |
| Contested | Conflicting claims require resolution | Compare evidence |
| Stale | A newer change may invalidate this section | Revalidate |
| Pending | Evidence is stored; processing is incomplete | View run/retry |
| Unavailable | Projection could not be obtained | Retry/diagnose |

Color reinforces these states but never carries meaning alone.

### 5.3 Definition summary

A concise charter card answers:

- What problem exists?
- Who experiences it?
- What outcome should improve?
- What is the core boundary?
- What is the primary workflow?

This is generated only from eligible current statements. It must explicitly label proposed or incomplete synthesis. It should not invent connecting prose to hide missing facts.

### 5.4 Section cards

Each section follows one component grammar:

- title and state;
- one-sentence purpose;
- current statements or a meaningful empty state;
- confidence/confirmation summary;
- provenance access;
- focused primary action;
- downstream impact;
- last meaningful change.

This consistent grammar makes the long page scannable and simplifies implementation and testing.

## 6. Section specifications

### 6.1 Problem

Must establish:

- affected actor;
- painful activity or unmet need;
- current workaround;
- consequence or cost;
- evidence strength.

A production-quality problem statement is specific enough to distinguish the project from its proposed solution.

Empty-state action:

> Establish the painful thing users should no longer have to do themselves.

Actions: **Answer focused question**, **Acquire source**, **Review proposal**.

### 6.2 Value and outcomes

Separate intended value from features. Show:

- user outcome;
- organizational outcome;
- measurable signals or success criteria;
- who receives the value;
- assumptions behind the expected benefit.

Do not mark “value” complete merely because a generic problem statement shares its knowledge area.

### 6.3 Objectives

Objectives should be independently identifiable and ideally measurable. Each objective includes status and related success measures. Avoid presenting implementation tasks as objectives.

Provide an “unmeasured” state rather than forcing fabricated metrics.

### 6.4 People: users, actors, and stakeholders

Use a responsive role matrix:

| Role | Relationship | Needs/responsibilities | Authority | Status |
| --- | --- | --- | --- | --- |
| Actor | interacts with system | goals and workflow role | allowed actions | confirmed/proposed |
| Stakeholder | affected or accountable | interest/obligation | decisions or approval | confirmed/proposed |

Distinguish named people from roles. Avoid collecting personal data when a role is sufficient.

### 6.5 Scope boundary map

Use three columns:

- **In scope**
- **Undecided**
- **Out of scope**

The undecided column is essential. Absence from “in scope” is not an exclusion.

Each boundary item can show rationale, source, related decision, and affected modules. Category icons must be neutral; completion indicators appear only when status is real.

### 6.6 Business workflows

When typed workflow steps exist, show a compact, interactive flow with a linear/list alternative. Each workflow includes:

- trigger;
- actors;
- major steps;
- outcome;
- exceptions;
- linked modules/screens when available;
- unresolved step or decision.

When no workflow exists, explain the consequence and launch a focused workflow interview. Never draw a plausible generic process.

### 6.7 Assumptions

Each assumption includes:

- statement;
- why it is currently believed;
- validation owner/method when known;
- consequence if false;
- expiry/review trigger;
- status: unverified, supported, disproved, superseded.

Assumptions must not silently become facts. High-impact assumptions should surface as risks.

### 6.8 Constraints

Group constraints by understandable category:

- technical;
- legal/compliance;
- budget;
- schedule;
- organizational;
- operational;
- legacy/integration.

Show whether a constraint is imposed, preferred, or inferred. A technology preference is not automatically a hard constraint.

### 6.9 Definition-level risks and decisions

Keep this compact and include only items that materially affect the project charter or block a downstream stage. Link to Reviews for complete handling.

## 7. Graphical intelligence

Graphics serve comprehension and action; they are never decorative fill.

### 7.1 Definition coverage strip

Default visual for categorical maturity. It is more honest than a radar chart because the dimensions do not necessarily share an interval scale.

Example labels:

- Problem — confirmed
- Value — missing
- People — proposed
- Scope — contested
- Workflow — incomplete

### 7.2 Scope boundary map

Use cards in the three boundary groups with drag/move only if the action creates a traceable revision request. Otherwise use explicit “Move to…” controls. Pending changes must be visible until committed.

### 7.3 Workflow diagram

Render only from typed workflow nodes/edges. Support:

- current selection and detail drawer;
- unresolved step markers;
- alternate/exception path;
- keyboard navigation;
- text sequence fallback;
- source and revision access.

### 7.4 Definition dependency impact

Show downstream stages affected by definition state:

| Downstream capability | State | Reason | Action |
| --- | --- | --- | --- |
| Module proposal | Available with warning | Scope is proposed | Review scope |
| Architecture | Blocked | Authority decision unresolved | Decide |
| Plan | Not ready | Modules not accepted | Open Modules |
| Context package | Available, incomplete | Two definition gaps remain | Preview limitations |

Do not infer these gates in the UI. Consume authoritative readiness or explicit dependency rules.

### 7.5 Change impact view

When a definition item changes, show what may be outdated:

- affected requirements;
- module proposals;
- architecture decisions;
- plans;
- generated deliverables.

This is a bounded traversal result, not an LLM guess.

## 8. Action and editing model

### 8.1 Action hierarchy

Each section can expose no more than:

1. one primary action;
2. one secondary review/trace action;
3. an overflow menu for advanced operations.

Possible actions:

- Answer focused question
- Connect/acquire evidence
- Review proposed statements
- Correct statement
- Resolve contradiction
- Decide later with reason
- Revalidate stale section
- Inspect source
- Compare revisions

### 8.2 Controlled editing

Do not use an unrestricted document editor as the default. Edits must preserve entity identity, provenance, and lifecycle.

Recommended flow:

1. User selects **Correct** or **Refine**.
2. Studio opens a structured editor with current text and source context.
3. User submits the correction and optional reason.
4. Studio persists it as evidence/revision request with idempotency.
5. The card shows “update pending.”
6. Memory returns the new revision and affected nodes.
7. Definition re-projects; change summary appears.

For low-risk text correction, the form can be lightweight. Structural actions such as splitting objectives or moving scope require explicit previews.

### 8.3 Bulk review

Allow grouped review only when statements share a source and status. Never place “Confirm all” across unrelated generated claims without showing the batch and its consequences.

### 8.4 Conversation handoff

“Continue in Workspace” must carry a workflow intent:

- project ID;
- definition section;
- gap/decision ID;
- preferred interaction type;
- return route.

The Workspace opens a focused interview or task card and returns the user to the affected section after processing.

## 9. Empty, pending, stale, and failure behavior

Every section must explicitly render one of the defined states.

### Empty

Explain what belongs in the section, why it matters, why it is empty, and the best action.

### Pending

State what is happening without fabricated chain-of-thought:

> Repository evidence was received. Definition analysis is still running.

Offer run status and retry only when appropriate.

### Stale

Continue showing the last safe projection with a clear banner:

> This scope reflects revision 24. Revision 27 changed the primary workflow; revalidation is required.

### Partial/degraded

Render known sections and mark affected sections unavailable. Do not replace failed content with blanks or zeros.

### Unauthorized/not found

Do not reveal project existence across tenant boundaries. Offer project selection or safe recovery.

### Contradiction

Show competing claims, status, evidence summaries, and a resolution action. Do not choose silently.

## 10. Provenance and trust drawer

Every material statement opens a common trace drawer with:

- stable entity ID;
- lifecycle status;
- exact current statement;
- evidence source type and safe label;
- evidence excerpt where permitted;
- source date and actor/role;
- confidence or extraction metadata when meaningful;
- confirmation/rejection history;
- superseded versions;
- current project revision;
- linked entities and downstream impact.

Ordinary page content uses human language. Raw provider payloads, schema names, hashes, and diagnostic IDs remain in an advanced disclosure.

## 11. Suggested projection contract

```ts
type DefinitionProjection = {
  projectId: string
  revision: string
  generatedAt: string
  freshness: "current" | "pending" | "stale" | "unavailable"
  overallState: DefinitionState
  summary?: DefinitionSummary
  coverage: DefinitionCoverageItem[]
  sections: {
    problem: DefinitionSection
    value: DefinitionSection
    objectives: ObjectiveSection
    people: PeopleSection
    scope: ScopeSection
    workflows: WorkflowSection
    assumptions: AssumptionSection
    constraints: ConstraintSection
  }
  attention: DefinitionAttentionSummary
  downstream: DownstreamImpact[]
  recommendedAction?: RecommendedAction
  recentChanges: DefinitionChange[]
}
```

A `DefinitionSection` requires:

- `state`;
- `availabilityReason` when unavailable;
- typed items;
- counts by lifecycle;
- trace references;
- last changed revision;
- actions allowed by policy;
- downstream impact references.

Unknown and unavailable fields should be nullable/discriminated, not defaulted to empty arrays that look authoritative.

## 12. Service requirements

The current candidate API provides useful foundations—briefing, filtered knowledge, readiness, findings, runs, and model revisions—but the production page may require a dedicated server-composed Definition projection.

Preferred boundary:

```http
GET /v1/projects/{project_id}/definition?revision=current
```

The response is server-composed or backend-for-frontend composed from authoritative Memory contracts. The browser must not join multiple unpinned calls and hope they describe the same revision.

Commands remain explicit:

```http
POST /v1/projects/{project_id}/model/revisions
POST /v1/projects/{project_id}/extractions
GET  /v1/runs/{run_id}
POST /v1/projects/{project_id}/model/traversals
```

Before implementation, verify these against current KAE-Memory code and tests. Where the real API differs, adopt its current vocabulary and record the gap instead of creating a parallel Studio-only truth model.

## 13. Responsive and themed presentation

### Desktop

- sticky header and coverage navigator;
- single readable document column;
- optional contextual right drawer for trace/impact;
- scope can use three columns when width permits;
- workflow graphics expand without shrinking body text.

### Tablet

- coverage navigator becomes horizontally scrollable or a compact dropdown;
- scope becomes stacked groups;
- trace and impact use a drawer.

### Mobile

- summary, overall state, and next action first;
- section status becomes an accordion/list;
- scope groups are stacked;
- workflow defaults to an ordered step list with full-screen diagram option;
- no hover-only provenance;
- sticky actions must not obscure content or the keyboard.

### Themes

Use the same semantic tokens established for Workspace. Light and dark themes must preserve status meaning, contrast, graph readability, print/export output, and visible focus. A print-friendly snapshot is a view, not a separate data source.

## 14. Accessibility

- semantic heading hierarchy and document landmarks;
- keyboard-accessible coverage navigation, section actions, workflow nodes, and drawers;
- visible focus in all themes;
- labels/icons/patterns in addition to color;
- table/list alternatives for graphics;
- screen-reader summaries of coverage and post-update changes;
- live-region announcements for submitted correction, pending revision, success, and failure;
- no automatic focus loss when a section re-projects;
- reduced-motion support;
- minimum touch target sizing;
- plain-language error and incomplete-state descriptions.

## 15. Permissions, collaboration, and production safety

A production page must respect project roles:

- viewer: read/export permitted snapshots;
- contributor: submit evidence and proposed corrections;
- reviewer: confirm/reject/defer allowed items;
- owner/admin: project policy, access, destructive operations.

The page must not expose one project’s definition to another project or tenant. Audit meaningful changes, including actor, action, target, prior revision, resulting revision, and correlation/idempotency reference.

Concurrent edits require revision guards. If the source revision changed, show a comparison and ask the user to reapply or reconcile rather than overwriting newer knowledge.

## 16. Performance and observability

Targets should be validated with real deployment conditions:

- render the last safe shell and header promptly;
- avoid blocking the entire page on one slow section;
- lazy-load trace history and large workflow graphs;
- virtualize only when lists genuinely become large;
- cancel obsolete requests when project/revision changes;
- cache by project and revision, never just route;
- record projection latency, section failures, command latency, stale-view frequency, and action completion;
- include safe correlation identifiers in diagnostics.

Do not prefetch sensitive projects or evidence without authorization.

## 17. Metrics for usefulness

Measure outcomes, not chart interaction vanity:

- time to identify the primary missing definition area;
- rate of recommended-action completion;
- proposal review completion;
- reduction in repeated questions;
- percentage of corrections that preserve trace/revision integrity;
- number of downstream artifacts generated from stale definitions;
- time from source acquisition to first coherent definition;
- user success identifying project purpose, users, boundary, and next action;
- accessibility task completion;
- mobile completion of focused definition workflows.

## 18. Delivery sequence

### Phase 0 — Truth prerequisite

- Remove fixture/cross-project leakage.
- Pin projections to project and revision.
- Represent unavailable separately from zero.
- Reconcile Workspace and Definition projections.
- Establish authentication, tenant boundary, and permission checks.

### Phase 1 — Honest operational page

- Add production header, freshness, and status summary.
- Implement explicit empty/proposed/confirmed/pending/stale/error states.
- Add section-specific actions and focused Workspace handoff.
- Remove misleading icons.
- Add trace drawer foundation.

### Phase 2 — Coverage and review

- Add definition coverage navigator.
- Add proposed-item review and controlled correction.
- Add three-way scope boundary.
- Add assumptions lifecycle and definition-level decisions.
- Add recent-change summary.

### Phase 3 — Graphical intelligence and impact

- Render typed business workflows with accessible fallback.
- Add downstream dependency/gate panel.
- Add change-impact traversal.
- Add revision comparison.

### Phase 4 — Production hardening

- Permission-aware collaboration and audit.
- Concurrency/version conflict handling.
- Responsive/mobile refinement.
- Light/dark/print themes.
- Performance budgets, telemetry, resilience, and accessibility verification.

## 19. Acceptance criteria

- **PD-AC-01 — Comprehension:** A first-time user can identify the project problem, intended value, primary users, scope state, and next action within one minute.
- **PD-AC-02 — Honest absence:** Missing, pending, stale, unavailable, proposed, confirmed, and contested states are visually and semantically distinct.
- **PD-AC-03 — Revision integrity:** Every displayed section belongs to the same project and revision, or is explicitly labeled stale/partial.
- **PD-AC-04 — Cross-view consistency:** Workspace Current Understanding and Definition do not contradict at the same revision.
- **PD-AC-05 — Actionability:** Every incomplete or contested section offers a focused acquisition, interview, review, or resolution action.
- **PD-AC-06 — Traceability:** Every material statement exposes provenance and lifecycle history to authorized users.
- **PD-AC-07 — Controlled correction:** User corrections create traceable revision requests and do not directly overwrite authoritative knowledge.
- **PD-AC-08 — Scope clarity:** In-scope, undecided, and out-of-scope items are distinct, sourced, and revisable.
- **PD-AC-09 — Workflow honesty:** Workflow diagrams render only known typed relationships and provide an accessible text alternative.
- **PD-AC-10 — Downstream impact:** The page explains which capabilities are available, risky, stale, or blocked and why.
- **PD-AC-11 — Resilience:** A single failed section does not collapse the page or appear as legitimate emptiness.
- **PD-AC-12 — Authorization:** Project and evidence access respects tenant and role boundaries, including trace drawers and exports.
- **PD-AC-13 — Responsive access:** Core review, correction, trace, and next-action workflows work at desktop, tablet, and mobile widths.
- **PD-AC-14 — Accessibility:** All statuses and graphical information have non-color, keyboard, and screen-reader equivalents.
- **PD-AC-15 — Concurrency:** A stale edit cannot silently overwrite a newer project revision.

## 20. Non-goals

This proposal does not:

- turn Definition into a general-purpose word processor;
- make Studio an authoritative duplicate of Memory;
- duplicate the full Requirements, Architecture, Plan, or Reviews views;
- authorize browser-side readiness calculation;
- require every graphic in the first delivery phase;
- permit attractive diagrams to fill missing relationships;
- equate planning maturity with implementation completion;
- block all early exports—an incomplete but honestly labeled definition can still be valuable.

## 21. Product outcome

The production Project Definition page should tell one coherent story:

> KAE has transformed the available evidence into a traceable understanding of the project. The user can see what is known, what is uncertain, what changed, what the uncertainty blocks, and the exact action needed to improve the definition.

It becomes useful when it helps users make and verify project-defining judgments—not merely when all of its cards contain text.
