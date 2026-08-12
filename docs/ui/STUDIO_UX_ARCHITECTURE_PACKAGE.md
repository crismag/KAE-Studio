# KAE-Studio UX Architecture Package

Status: proposed product-design and frontend-architecture direction for review before implementation.

This package defines a unifying Studio experience architecture around **Dashboard + Rooms + focused workflows + progressive setup/intake + explicit Settings boundaries**. It consolidates the direction discussed after reviewing the overloaded Setup experience and the broader Studio navigation problem.

It complements, and does not replace:

- `WORKSPACE_VISUAL_DESIGN_PROPOSAL.md`
- `PROJECT_DEFINITION_PRODUCTION_DESIGN_PROPOSAL.md`
- `MODULES_PAGE_PRODUCTION_DESIGN_PROPOSAL.md`
- `UI_GENERATION_CONTEXT.md`
- `../product/USER_WORKFLOW.md`

## 1. Why this package exists

KAE-Studio is becoming capable enough that exposing every capability as another dense page or panel will make the product progressively harder to understand. The problem is no longer lack of information. It is **information architecture, focus, discoverability, and architectural locality**.

The target experience should answer:

1. Where is my project now?
2. What needs my attention?
3. What should I do next?
4. Where do I go to accomplish that specific task?
5. Which configuration belongs to this project versus the global Studio environment?

The target implementation should also let a developer understand those same product boundaries from the repository structure without tracing unrelated global components.

## 2. Core mental model

Studio adopts three primary layers:

### Dashboard

The Dashboard is the project home and orientation surface. It answers **where am I, what changed, what is blocked, and what should I do next?** It summarizes work but should not contain every work surface.

### Rooms

A Room is a focused work environment for accomplishing one class of activity. It owns the controls, information, tools, and status relevant to that work. A Room is technically a route/page family, but the product metaphor communicates intent better than generic navigation tabs.

Examples:

- Interview Room
- Sources Room
- Definition Room
- Architecture Room
- Review Room
- Planning Room
- Development Room, when implementation orchestration exists

Rooms are defined by **user intent**, not backend services. There should not be a Memory Room merely because KAE-Memory exists, or an Artifacts Room merely because KAE-Artifacts exists.

### Settings

Settings configure Studio, integrations, credentials, environment defaults, permissions, and advanced behavior. Ordinary project workflows should select already configured resources rather than expose their full configuration inline.

A project asks **which repository?** Settings owns **how GitHub is connected**.

## 3. Dashboard design

The Dashboard becomes the default project landing surface.

It must answer within seconds:

- project identity;
- current lifecycle stage;
- readiness or coverage using meaningful denominators;
- blocking items;
- recent meaningful changes;
- ranked recommended actions;
- available Rooms and their current attention state.

Suggested hierarchy:

```text
Project Dashboard

Current journey
Acquire -> Understand -> Define -> Decompose -> Connect -> Review -> Package
                  ^ active

Needs your attention
- 3 architecture questions -> Interview Room
- 4 unreviewed repository findings -> Review Room
- project definition changed -> Definition Room

Rooms
Interview | Sources | Definition | Architecture | Review | Planning

Recent changes
...
```

Dashboard principles:

- Do not turn it into another dense analytics page.
- Rank no more than three primary actions.
- Every alert or recommendation must link to the correct Room or focused workflow.
- Use graphical state only when it leads to action.
- Preserve truth vocabulary: question, gap, decision, contradiction, proposed item, blocker, stale projection, and implementation state are not interchangeable.
- Avoid ambiguous global percentages when dimensions differ. Prefer `7 of 10 planning areas have sufficient evidence` to `70% complete`.

## 4. Workflow and work management

Dashboard and Rooms should be connected by an explicit workflow-routing model.

A user response, repository finding, review outcome, or readiness change can create a work item or recommended action. That action should carry:

- objective;
- originating evidence/revision;
- destination Room;
- blocking or non-blocking state;
- prerequisite;
- completion condition;
- relationship to affected project entities.

Example:

```text
Architecture blocked by 3 unanswered deployment questions
        |
        v
Open Interview Room
Objective: resolve deployment constraints
        |
        v
Interview produces confirmed/proposed knowledge
        |
        v
Architecture projection recomputed
        |
        v
Return to Architecture Room
```

Work management may later include board/backlog views, but the first requirement is not a generic Kanban implementation. It is **a consistent action model that can route the user to the right work surface**.

When boards are added:

- treat cards as projections of real work items/findings/decisions;
- preserve source and project revision;
- allow filtering by Room, priority, blocker, module, stage, and owner;
- separate backlog/planned work from active work;
- support a focus mode for dense work surfaces.

## 5. Project setup becomes focused intake

The current Setup direction is too information-heavy if configuration, source acquisition, project description, repository connection, and advanced options compete on one page.

Replace the conceptual model:

`Project Setup form -> Project Intake / Start Project workflow`

A new-project entry surface should ask primarily **what are you bringing to KAE?**

Primary actions:

- Describe an idea
- Connect/select an existing repository
- Upload project material
- Import an existing KAE/context package
- Start empty

The user does not need every source on the first pass. More sources can be added later in the Sources Room.

### Progressive flow

Recommended creation flow:

1. **Start** — choose one starting mode.
2. **Sources** — select repository or add relevant material.
3. **Analyze** — KAE extracts project facts and detects maturity/technology/context.
4. **Review understanding** — user confirms, edits, or rejects important inferences.
5. **Ready** — Dashboard opens with the most useful next action.

Do not ask users to manually enter values KAE can infer from repository/material. Show inferred values for confirmation.

Use `I don't know / help me decide` for decisions that legitimately remain unresolved.

## 6. Selection is not configuration

Adopt this as a Studio-wide rule:

> Workflow pages select configured resources. Settings pages configure those resources.

Examples:

| Project/workflow surface | Settings surface |
| --- | --- |
| Repository: `crismag/KAE-Studio` selector | GitHub account/installations, authorization, credentials |
| Branch selector | Git defaults / advanced repository behavior |
| AI profile selector | Provider keys, models, limits, defaults |
| Artifact destination selector | Storage integration credentials and policies |
| Development environment selector | Environment provisioning and secrets |

Repository selection should resemble a simple searchable dropdown or picker when GitHub is already connected. Advanced connection management belongs behind `Manage GitHub connections` in Settings.

This separation is inspired by modern developer tools such as Codex, where users select an already configured environment/repository while administrative GitHub setup and environment management are separate concerns.

## 7. Sources are a first-class intake abstraction

Treat repository, uploaded document, pasted note, URL, interview transcript, existing context package, and imported specification as **Project Sources** rather than unrelated fields.

A Source Manifest should be able to show:

- source type and identity;
- connection/availability;
- processing stage;
- extracted facts/findings;
- provenance;
- conflicts/assumptions;
- freshness/revision;
- failure/retry state.

Suggested lifecycle:

`Connected -> Reading -> Extracted -> Classified -> Incorporated`

Never leave substantial user input visually inert. After repository/file input, transform the surface into an analysis/status result with clear next action.

## 8. Rooms

A Room is a route family with a focused objective and contextual toolbelt.

Every Room definition must include:

- purpose;
- user questions it answers;
- entry conditions;
- data projection(s) it consumes;
- contextual tools/actions;
- empty/degraded states;
- exit/completion conditions;
- valid transitions to other Rooms;
- what the Room explicitly does **not** own.

### 8.1 Interview Room

Purpose: resolve missing project knowledge through guided conversation.

Toolbelt:

- text conversation;
- voice conversation when available;
- question/topic navigator;
- transcript;
- notes/findings;
- attached supporting sources;
- session objective;
- end-session summary.

The Room should be launchable with a targeted objective, e.g. `Resolve deployment constraints`, not only as a generic interview.

### 8.2 Sources Room

Purpose: manage evidence and information acquisition.

Toolbelt:

- add/upload source;
- connect repository/integration;
- source processing status;
- extraction summary;
- coverage;
- provenance inspection;
- retry/replace/remove according to data rules.

### 8.3 Definition Room

Purpose: understand, refine, and approve what is being built.

Toolbelt:

- project charter/definition;
- coverage by definition area;
- assumptions and uncertainty;
- proposed versus confirmed knowledge;
- provenance;
- targeted gap resolution.

### 8.4 Architecture Room

Purpose: understand and design system structure and relationships.

Toolbelt:

- architecture/system map;
- modules/components;
- dependencies;
- interfaces;
- constraints;
- decisions;
- graphical and table projections;
- blockers/cycles/stale relationships.

### 8.5 Review Room

Purpose: resolve proposed knowledge, conflicts, decisions, gaps, contradictions, and verification findings.

Toolbelt:

- review queue;
- evidence comparison;
- accept/edit/reject/defer;
- impact and downstream effects;
- filters by severity/type/module/stage.

### 8.6 Planning Room

Purpose: turn accepted definition into actionable delivery planning.

Toolbelt may include:

- roadmap;
- backlog;
- Kanban/status board;
- dependencies;
- priorities;
- milestones;
- readiness-to-start;
- ownership.

### 8.7 Development Room — future/conditional

Only introduce when Studio has a real implementation-orchestration capability. Do not create a decorative Room for functionality that does not exist.

## 9. Contextual toolbelts

Global navigation should remain restrained. Actions specific to a task move into the current Room.

Examples:

- Interview: Voice, Chat, Transcript, Questions, Notes
- Sources: Add, Connect, Search, Extract, Inspect provenance
- Architecture: Diagram, Components, Dependencies, Decisions, Compare
- Review: Accept, Edit, Reject, Defer, Discuss, Compare evidence
- Planning: Board, Backlog, Roadmap, Dependencies, Priority

This reduces global clutter and strengthens the Room mental model.

## 10. Navigation model

Recommended top-level project navigation:

- Dashboard
- Rooms
- Work / Tasks, once work management warrants a dedicated view
- Project Settings

Rooms may be displayed as direct shortcuts when there are few, or under a Room switcher when the set grows.

Navigation should support:

- project switcher;
- persistent current Room identity;
- breadcrumbs for focused subflows;
- recent Rooms/actions;
- KAE-directed transitions;
- deep links to specific work items/entities;
- preservation of workflow objective when changing surfaces.

Do not expose every project-model noun as a permanent global navigation item merely because a data type exists.

## 11. Visual and interaction principles

### Progressive disclosure

Show only the information needed for the current decision. Advanced options remain discoverable but one layer deeper.

### One primary task per page state

A surface may contain supporting context, but it should have one obvious dominant purpose.

### Buttons and focused transitions over dense universal forms

Use clear action tiles, buttons, dropdown selectors, dialogs, drawers, steps, and dedicated subpages to isolate work.

### Fewer containers

Do not solve hierarchy by putting every section in a bordered card. Cards identify interactive or independently meaningful objects, not every paragraph.

### Explicit primary/secondary actions

Avoid equal visual weight for `Continue`, `Edit`, `Advanced`, `Remove`, `Retry`, and `Cancel`.

### Transform after input

After an upload, repository selection, or conversation-derived task, show the result/status rather than leaving a static input form unchanged.

### Purpose-specific responsive views

Mobile should prioritize objective/current action and use sheets/drawers for navigation, not compress desktop columns.

## 12. Design inspiration and techniques to borrow

These references are inspiration, not templates to copy.

### Codex / modern AI developer environments

Borrow:

- simple repository/environment selection in the working surface;
- separate environment/connection management;
- progressive onboarding;
- advanced configuration kept out of the primary task;
- action-first composer/work surface.

Do not borrow product-specific assumptions that do not match KAE's evidence and project-definition model.

### Claude / conversational AI tools

Borrow:

- conversation as a low-friction entry point;
- strong focus on the current interaction;
- concise secondary controls;
- artifact/tool surfaces revealed when relevant rather than permanently occupying the screen.

For KAE, conversation remains an intake/work mechanism; the durable structured project model remains the product.

### GitLab

Borrow:

- project-scoped navigation;
- work items as a common planning primitive;
- multiple purpose-specific boards/views;
- focus mode for dense work;
- direct manipulation of cards/status where semantically valid.

GitLab's issue boards demonstrate multiple boards for different workflows and a focus mode that hides navigation when the board is the task.

### Jira

Borrow:

- dashboard/project/space separation;
- backlog distinct from active board work;
- configurable navigation based on useful features;
- filters, density controls, and optional fields;
- dedicated full-screen/focus modes for high-density planning.

Avoid Jira's tendency toward configuration density. KAE should use its intelligence to reduce manual field management.

### Linear — recommended additional reference

Study:

- keyboard-friendly navigation;
- restrained density;
- command/search behavior;
- issue details in focused overlays/panels;
- fast transitions between list, board, project, and roadmap contexts.

### Notion / Coda — recommended additional reference

Study selectively:

- progressive disclosure;
- contextual menus;
- inline views of the same underlying information;
- keeping creation simple while allowing deeper structure later.

Do not turn KAE into a generic document editor.

## 13. Frontend code organization: make product architecture visible

The existing React/TypeScript implementation should be reorganized incrementally toward feature/page locality. The goal is that a developer can find a screen by looking at the filesystem.

Target shape:

```text
src/
  app/
    App.tsx
    router.tsx
    layout/
    registries/
      roomRegistry.ts
      routeRegistry.ts

  pages/
    dashboard/
      DashboardPage.tsx
      components/
      hooks/
      README.md

    setup/
      SetupPage.tsx
      components/
      hooks/
      README.md

    rooms/
      interview/
        InterviewRoomPage.tsx
        components/
        hooks/
        README.md
      sources/
      definition/
      architecture/
      review/
      planning/

    settings/
      SettingsPage.tsx
      connections/
      ai/
      storage/
      development/

  shared/
    components/
    hooks/
    types/
    utilities/

  services/
    github/
    memory/
    artifacts/
    cie/

  styles/
```

The exact folder names may adapt to current code, but preserve the principles.

### Locality rule

> If code is used by one page/Room, keep it inside that page/Room folder. Promote it to `shared/` only after genuine reuse exists.

Shared components should mostly be primitives such as Button, Dialog, Dropdown, Card, Progress, Tabs, EmptyState, StatusBadge, Drawer, and accessible graph foundations.

Domain components such as `InterviewTranscript`, `SourceCoverageSummary`, or `ArchitectureDependencyGraph` should remain in their owning Room unless multiple domains truly reuse them.

### One visible route registry

There must be one obvious place that maps user-facing routes to page owners. Avoid route definitions scattered across unrelated components.

### Room registry

Create a central declarative registry containing stable metadata such as:

```ts
{
  id: "interview",
  title: "Interview Room",
  route: "/rooms/interview",
  purpose: "Resolve project knowledge through guided discussion"
}
```

Dashboard cards, breadcrumbs, navigation labels, and workflow routing should consume the registry rather than duplicate Room identity.

### README per major page/Room

Each major folder should contain a concise `README.md` covering:

- route;
- purpose;
- owns;
- does not own;
- services used;
- key state/projection contracts;
- major child components;
- test entry points.

This is intentionally analogous to the visibility of folder-per-page systems while preserving React composition.

## 14. Vocabulary consistency across frontend/backend

User-facing domains and backend APIs do not need identical physical structure, but they should use consistent domain language where possible.

If Studio calls something a Source, Definition, Review, Interview Session, Module, or Work Item, adapters and contracts should avoid unrelated terminology that forces developers to translate concepts mentally.

Do not mirror backend services as Rooms. Services remain infrastructure; Rooms remain user-intent surfaces.

## 15. State and projection architecture

Pages/Rooms must not invent independent project truth. Each should consume revision-pinned projections derived from the authoritative project state.

Recommended cross-cutting metadata:

- project ID;
- project revision;
- generated timestamp;
- current/stale/pending/unavailable freshness;
- capability availability;
- source/provenance links;
- pending writes or analysis state.

Transitions between Rooms should preserve objective and affected entity IDs so the user does not lose context.

## 16. Empty, loading, error, and degraded states

Every Room needs designed states, not just the happy path.

At minimum:

- no project/first use;
- capability unavailable;
- no data yet;
- analysis pending;
- partially available projection;
- stale data;
- source failure;
- backend/Memory/provider unavailable;
- unauthorized/missing integration;
- conflict requiring review.

Each empty/degraded state must explain what belongs there, why it is unavailable, and one exact recovery/next action.

## 17. Accessibility and focus modes

- keyboard access to Room navigation and contextual toolbelts;
- visible focus states;
- text/table alternatives for diagrams;
- color never the only status signal;
- minimum touch target sizes;
- reduced-motion support;
- screen-reader announcements for meaningful workflow state changes;
- optional focus/full-screen mode for Interview, Architecture graph, Review queue, Board, and Backlog surfaces where surrounding navigation would distract.

## 18. Implementation strategy: refactor before broad redesign

Do **not** rewrite Studio.

Recommended sequence:

### Phase A — Architecture inventory

- map current routes to source files/components;
- identify cross-page components and state dependencies;
- identify current Setup/Workspace/Definition/Modules responsibilities;
- identify dead/mock-only capabilities separately from live capability.

### Phase B — Structural locality refactor

- create page/Room folder skeleton;
- centralize route definitions;
- introduce Room registry;
- move one route at a time without behavior changes;
- preserve tests after each move;
- add per-page README files.

A pure route/file move is a refactor and does not require a rapid-track hardening pair if it changes no capability.

### Phase C — Dashboard foundation

- establish Dashboard as project home;
- add journey, attention, recent changes, Room launchers, ranked actions;
- route existing workflows from Dashboard.

### Phase D — Setup/intake redesign

- separate configuration from selection;
- implement progressive new-project flow;
- repository picker;
- source manifest/processing feedback;
- understanding checkpoint;
- Settings links for integration management.

### Phase E — Room conversion

Convert existing pages incrementally into focused Rooms where appropriate. Do not rename a page `Room` without changing its responsibility and contextual controls.

### Phase F — Work management

- explicit action/work-item projection;
- action routing;
- backlog/board only when the underlying work model is stable;
- planning views and module/dependency coordination.

### Phase G — polish and responsive/focus modes

- themes/tokens;
- mobile-specific Room behavior;
- accessibility verification;
- focus modes;
- performance/interaction refinement.

## 19. Non-goals and guardrails

- Do not implement Rooms as decorative themed pages without task boundaries.
- Do not hide missing capability behind attractive UI.
- Do not move Memory-owned domain logic into frontend page folders.
- Do not make Dashboard a second source of project truth.
- Do not make global Settings a dumping ground for project-specific decisions.
- Do not require users to configure what KAE can safely infer and ask them to confirm.
- Do not expose credentials or privileged integration configuration to the browser.
- Do not add a board merely because project-management products have boards; add it when Studio has meaningful work items to manage.
- Do not use page/folder reorganization as an excuse for a large rewrite.

## 20. Additional recommended areas

The following should be treated as part of this initiative even though they were not in the original five headings:

1. **Navigation and transition contracts** — how objectives, entity IDs, filters, and return destinations move between Dashboard and Rooms.
2. **Work-item/action model** — a shared representation for recommendations, blockers, findings, tasks, and routing before introducing Kanban.
3. **Settings/integration information architecture** — explicit ownership of connections, credentials, environment defaults, AI, storage, and advanced controls.
4. **Source Manifest** — unified intake/provenance representation across repository, documents, URLs, interviews, and imports.
5. **State design** — loading, empty, stale, partial, failure, unauthorized, and recovery states per Room.
6. **Responsive and focus modes** — Rooms need purpose-specific mobile and distraction-reduced presentation.
7. **Accessibility** — especially graphs, boards, voice/interview controls, and keyboard navigation.
8. **Migration and anti-regression tests** — route, state, and visual responsibilities need tests before large UI transformation.
9. **Vocabulary contract** — use stable product terms across UI, adapters, API contracts, docs, and tests.
10. **Telemetry/usability evidence** — later record where users stall, which recommended actions are used, and which Rooms cause backtracking, without replacing direct usability testing.

## 21. Acceptance criteria for the package direction

- **UXA-01 Orientation:** the Dashboard communicates project state, attention items, and a next action without exposing every detail.
- **UXA-02 Focus:** each Room has one clear work purpose and a contextual toolbelt.
- **UXA-03 Progressive setup:** new-project intake does not present a universal configuration form.
- **UXA-04 Selection/config separation:** ordinary project workflows select resources; privileged/advanced configuration lives in Settings.
- **UXA-05 Source unification:** repository, documents, interviews, and other intake channels share a Source abstraction with provenance and processing state.
- **UXA-06 Workflow routing:** recommendations and blockers can open the appropriate Room with objective/context preserved.
- **UXA-07 Architectural locality:** a developer can locate a page/Room and most of its unique implementation from its folder.
- **UXA-08 Single route/Room registry:** user-facing navigation identity is not duplicated across unrelated files.
- **UXA-09 No rewrite:** structural migration is incremental and tested.
- **UXA-10 Truthful visuals:** no dashboard, Room, board, progress, or readiness component claims unavailable or invented state.

## 22. Immediate planning output expected from implementation agents

Before changing broad UI behavior, produce:

1. current route-to-file/component inventory;
2. proposed route/Room map showing retained, merged, renamed, or retired pages;
3. Setup responsibility split between Intake, Sources Room, Project Settings, and global Settings;
4. current component locality/coupling map;
5. migration plan with behavior-preserving moves first;
6. Dashboard minimum viable projection and actions;
7. Room registry schema;
8. action/work-item routing schema;
9. acceptance-test plan for navigation, degraded states, and truthful projections.

Implementation should begin only after those outputs reveal any conflicts with existing product/architecture contracts.