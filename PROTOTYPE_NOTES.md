# KAE-Studio Prototype — Notes for Review

Status: **frontend product prototype.** No backend integration exists. Nothing here is authorized as platform implementation.

Built 2026-08-01 against the merged documentation set (`CLAUDE.md`, `docs/`, ADR-0001 through ADR-0006).

## What this is, precisely

A static React application that demonstrates the KAE-Studio product experience end to end:

```text
Conversation -> structured project understanding -> module decomposition
  -> connected requirements and dependencies -> readiness and unresolved decisions
  -> module-level development context package
```

Every piece of project data and every intelligent behaviour is supplied through a replaceable interface with a deterministic mock adapter. **No AI provider, KAE-Memory instance, database, GitHub repository, filesystem, or S3 bucket is contacted.**

The prototype states this in the product itself: a persistent `Prototype — mock data` badge in the status bar, `Provider: Scripted prototype responder`, and an explicit disclaimer on every publish action.

## Decisions taken that may need review

Recorded rather than asked, per instruction. Ordered by how much they would cost to reverse.

### 1. Hash routing (`createHashRouter`) and `base: './'`

Hostinger shared hosting serves static files without rewrite rules, so a browser-history route like `/modules` would 404 on refresh. Hash routes (`/#/modules`) work from any subdirectory with no server configuration. **Reversible**, but doing so requires either an `.htaccess` rewrite or a host that supports SPA fallback.

### 2. `react-router-dom` carries one open high-severity advisory

GHSA-qwww-vcr4-c8h2 affects 7.12.0–8.2.0; **no patched release exists yet** (7.18.2 is latest). I first pinned to 7.11.0 and reverted: that version carries *fourteen* advisories instead of one. The remaining advisory is an RSC-mode CSRF bypass — this application has no server, no RSC, and no server actions, so it is not reachable here. Worth re-checking when a fix ships.

### 3. Studio holds no durable conversation, and the mock enforces it

Following ADR-0006, `useSendMessage` submits to `ProjectMemoryClient` **first** and only then requests the assistant turn. The mock rejects duplicate idempotency keys rather than appending, so retry-safety is demonstrated rather than asserted. There is no Studio-side message store, and no database of any kind.

### 4. Module split semantics are deliberately conservative

`MODULE_SPECIFICATION.md` names split/merge semantics as an unresolved platform question. Rather than guess, splitting keeps all requirements, interfaces, and data with the first module and starts the second empty. The dialog says so on screen. **This is a placeholder for a decision that must be made properly on the platform side.**

### 5. The assistant is a fixed script, and says so when it runs out

Three scripted turns follow the fixture conversation. After that the assistant states plainly that the prototype script has ended and no response is being generated. It does not improvise plausible-sounding requirements — fabricated discovery would misrepresent the one thing the product is for.

### 6. Dependencies renders as layers, not a node graph

Build order is the question that screen answers, and a layered reading answers it more legibly than an arbitrary force-directed layout. The layering function also detects a cycle (it would leave modules unplaced) — the fixture has none, so that path is unexercised.

### 7. Architecture and Plan are genuinely empty

Both are designed future states naming what they will contain and **why they are not ready**, tied to a specific blocker. Neither is populated with fabricated conclusions. Plan cites the real reason: build order is not derivable past layer 1 while `OD-011` is open.

### 8. Light theme only

The UI brief says implement one theme well before adding two. Tokens are defined in `src/index.css` as CSS custom properties, so a dark theme is a token-layer change rather than a component rewrite.

### 9. Single 567 kB JS bundle

No code splitting. At this size it is one request and roughly 168 kB gzipped; route-level `lazy()` is the obvious first step if it matters. Flagged rather than silently optimised.

### 10. `KAE_NO_WATCH` escape hatch in `vite.config.ts`

This environment had its inotify instance limit exhausted, so `npm run dev` could not start. The flag disables the module watcher. Normal `npm run dev` is unaffected. Screenshots were taken against `vite preview` on the production build instead, which also validates the real output.

## Documentation conflicts found

### A. Navigation differs between two governing documents

`docs/ui/UI_GENERATION_CONTEXT.md` specifies six work-layer destinations (Workspace, Requirements, Architecture, Plan, Deliverables, Project Health). `docs/product/USER_WORKFLOW.md` and `CLAUDE.md` specify eleven (adding Project Definition, Modules, Interfaces, Dependencies, Reviews, Memory).

**Resolved in favour of the eleven-route navigation**, which the task instruction also specifies. The UI brief predates ADR-0002.

**Consequence:** *Project Health* now has no destination. Its content — phase, coverage by topic, blocking decisions, recommended next conversations — lives in the Workspace right-hand context panel and in Reviews. That is arguably better placement, but it is an unrecorded change and `UI_GENERATION_CONTEXT.md` should be updated to say so.

### B. Studio-owned conversation/database instructions still present

As the task instruction notes, `IMPLEMENTATION_DIRECTIVE.md`, `DATA_OWNERSHIP.md`, and `VERTICAL_SLICE.md` retain traces of Studio-owned persistence. These did not guide the prototype. They remain a live hazard for anyone reading those documents in isolation.

### C. `docs/product/UI_DEFINITION.md` has no screen in this prototype

That document covers screen specifications KAE-Studio *produces for the customer's project* — a deliverable, not a Studio screen. The prototype models it in `Deliverable.includes` but has no dedicated view. Not a conflict, but easy to misread as an omission.

### D. First-run onboarding state not built

`UI_GENERATION_CONTEXT.md` specifies a calm no-project onboarding state with starter prompts. The prototype opens directly on the single sample project. Deferred deliberately — the brief's demonstration project is the point of this pass — but it is unbuilt, not merely unstyled.

## Stack

| Concern | Choice | Version |
| --- | --- | --- |
| Build | Vite | 6.4.3 |
| UI | React | 19.2.8 |
| Language | TypeScript (strict) | 5.7 |
| Routing | react-router-dom (hash) | 7.18.2 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | 4.3.3 |
| Primitives | Radix UI (dialog, radio-group, collapsible, slot) | — |
| Icons | lucide-react | — |
| Data | TanStack Query | 5.x |
| Unit/component tests | Vitest + Testing Library + jsdom | 3.x |
| Browser checks | Playwright (Chromium) | 1.5x |

Tailwind v4 is configured CSS-first — all design tokens are `@theme` custom properties in `src/index.css`. There is no `tailwind.config.js`.

## Architecture

```text
src/
├── domain/types.ts          product-oriented view types (NOT Memory row shapes)
├── services/
│   ├── interfaces.ts        ProjectMemoryClient · InterviewProvider · ProjectProjectionService
│   │                        ArtifactService · ArtifactPublisher
│   ├── serviceContext.ts    React context holding the implementations
│   ├── ServiceProvider.tsx  the single swap point for real clients
│   └── mock/
│       ├── mockServices.ts  deterministic adapters + prototype session state
│       └── fixtures/ministryReporting.ts
├── hooks/                   useServices, useProject (all data access)
├── components/
│   ├── ui/primitives.tsx    Button · Panel · Badge · Mono · EmptyState · Skeleton
│   └── project/             status vocabulary, labels, page layout
└── app/
    ├── shell/AppShell.tsx   rail · mobile sheet · status bar
    └── routes/              eleven routes
```

**Presentation components never import fixtures.** Data reaches them only through hooks → context → interface. Verified by inspection: the only import of `fixtures/` is `mockServices.ts`.

## Working interactions

- **Send a message** — submits through the memory client with an idempotency key, then requests an assistant turn; revision increments; discovery counts update.
- **Suggestion chips** — send directly, except questions ("Why does this matter?"), which populate the composer instead.
- **Defer / bring back a decision** — toggles deferral, reflected in the context panel and Reviews.
- **Accept / rename / split / merge / reject a module** — each recorded as a decision; **every generated package immediately becomes Outdated**, demonstrating revision pinning.
- **Expand a module specification** — full canonical spec including non-responsibilities, failure behaviour, and per-dimension readiness.
- **"Why this is here"** — per-requirement provenance disclosure with quoted source evidence.
- **Filter requirements** by status.
- **Select a module in Dependencies** — shows depends-on, depended-on-by, and interfaces.
- **Generate / regenerate a deliverable** — pins to the current revision, versions, and hashes.
- **Preview contents** — file list with traced-statement counts.
- **Publish** — destination selection, unavailable local target with its reason, proposed-change list, unresolved-decision warning, prototype disclaimer.
- **Confirm / reject an agent proposal** in Reviews.
- **Mobile navigation sheet** and **context drawer**.

## Placeholders

| Area | State |
| --- | --- |
| Architecture, Plan | Designed future states with stated blockers |
| Memory → Agent activity | Described, not implemented |
| Settings | Non-functional button |
| First-run onboarding | Not built |
| Project switcher | Displays the one project; not switchable |
| Attachment button | Present, does nothing |
| Dark theme | Not implemented |
| Playwright as a test suite | Used as a validation script, not a spec suite |

## Validation results

| Check | Result |
| --- | --- |
| `tsc -b --noEmit` | Clean |
| `eslint .` | 0 errors, 0 warnings |
| `prettier --check` | All files conform |
| `vitest run` | **16 passed** (2 files) |
| `npm run build` | Succeeds, 1.5 s |
| Console/page errors across 11 routes | None |
| Horizontal overflow at 1600 / 900 / 390 px | None |
| Buttons without accessible name | None |
| `<h1>` per route | Exactly one |
| Interaction: assistant reply | Works |
| Interaction: decision → package outdated | Works |

Tests assert the behaviours that matter to the product's claims: idempotent submission, decisions recorded rather than silently applied, packages pinned to a revision, open decisions surviving generation, provenance disclosed on demand and not before, agent proposals marked unconfirmed, and split not discarding requirements.

## Build output for Hostinger

```bash
npm run build     # → dist/
```

`dist/` is 600 kB total: `index.html`, `assets/index-*.js` (567 kB / 168 kB gzip), `assets/index-*.css` (29 kB / 6 kB gzip). Relative `base` plus hash routing means it can be uploaded to any directory — document root or a subfolder — with no `.htaccess` and no server configuration.

## Screenshots

`screenshots/` — 22 images. Regenerate with `npm run screenshots` (requires `npx vite preview --port 4173`).

Desktop 1600×1000 for all eleven routes, plus `workspace-after-send`, `modules-accepted`, `deliverables-outdated`, `publish-dialog`. Mobile 390×844 for workspace, modules, deliverables, reviews, navigation. Tablet 900×1100 for workspace and modules.

## What must be replaced for the real product

### KAE-Memory (via `ProjectMemoryClient`, `ProjectProjectionService`)

Everything currently in the fixture: projects, sessions, messages, requirements, modules, relationships, open decisions, findings, readiness, provenance, revisions. Per the capability matrix, the structural gaps this prototype's UI *assumes exist* are: **relationship write and traversal**, **module-scoped readiness**, and **purpose-bounded context assembly** — plus idempotent evidence ingestion, which the mock already demonstrates the need for. The Modules and Dependencies screens are not buildable for real until those land.

### KAE MCP

The Reviews screen already renders agent-proposed knowledge with agent identity, repository, commit, and source revision. That data arrives via `kae_submit_observation` in MCP-M1. Nothing else in the prototype depends on MCP.

### AI provider (via `InterviewProvider`)

The scripted responder is replaced by a Studio-side interview orchestrator over Claude, OpenAI, or Bedrock, informed by the current project briefing. Provider selection is Studio configuration; the status bar already has a place to display it honestly.

### AWS / delivery (via `ArtifactService`, `ArtifactPublisher`)

`GitHubPublisher` (branch or draft PR), `LocalWorkspacePublisher` (through the installed agent, approved-root enforced), `S3Publisher` (bytes in S3, metadata in CockroachDB). Credentials live server-side or in the local agent — **never in this frontend**. The publish dialog's preview-before-write and conflict semantics are designed for this and currently mocked.

### Not to be added to Studio

No Studio database. No authoritative projects, conversations, messages, knowledge, requirements, modules, relationships, readiness, or provenance. If a future change requires one of those, the boundary has been broken.
