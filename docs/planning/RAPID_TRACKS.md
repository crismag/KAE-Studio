# Rapid experience tracks — implementer notes

The rule, the ship path and the exit criteria live in the ecosystem:
[`KAE-Ecosystem/roadmap/RAPID_EXPERIENCE_TRACKS.md`](../../../KAE-Ecosystem/roadmap/RAPID_EXPERIENCE_TRACKS.md).
**Read that first.** This file is the part an implementer needs: which files,
which ports, which components already exist, and what each track must not do.

Almost all of it lands in this repository, because Studio owns the experience
layer.

---

## The shape every track takes

```text
src/domain/types.ts            the DTOs
src/services/interfaces.ts     the port — one new key on StudioServices
src/services/mock/…            the fast half: fixtures, states, failures
src/services/live/…            the honest half: real data, or a CapabilityGap
src/hooks/useProject.ts        a React Query hook per port method
src/components/… / routes/…    the surface
```

**Three things ship together or none do.** The surface, its mock adapter, and a
live adapter — even when the live adapter's whole job is to return a
`CapabilityGap`. A port with no live implementation is invisible in production
while looking finished in development, which the guard below now fails CI for.

### Conventions that already exist — use them, do not re-invent

| Need | Use | Where |
|---|---|---|
| Panel, button, badge, empty state, skeleton | `Panel`, `Button`, `Badge`, `EmptyState`, `Skeleton` | `src/components/ui/primitives.tsx` |
| Page frame | `PageLayout` | `src/components/project/PageLayout.tsx` |
| A deliberately-unbuilt page | `FutureState({willContain, whyNotReady, nextAction})` | same file |
| An unbuilt capability inside a built page | `CapabilityGap` rendered as a standing notice | `src/domain/types.ts`, pattern in `ProjectSources.tsx` |
| Status with an icon and a word, never colour alone | `StatusBadge` | `src/components/project/statusVocabulary.tsx` |
| Absence rendered as absence | `UnderstandingField({label, absent})` | `src/app/routes/Workspace.tsx` |
| Colour, spacing, radius | the `@theme` tokens — `surface`, `ink-muted`, `accent-soft`, `line` | `src/index.css` |
| Class merging | `cn()` | `src/lib/cn.ts` |
| Errors from a port | `CapabilityUnavailable`, `ArtifactError` | `src/services/live/liveServices.ts` |

Font sizes as bracket values (`text-[13px]`) are house style, not an accident.
Components are named-export functions with the props destructured and typed
inline; `RecommendationCard.tsx` and `NextAction.tsx` are the templates.

### Adding a route — three edits

1. `src/app/routes/X.tsx`, named export
2. an entry in the router array in `src/App.tsx`
3. a `NavItem` in `NAV` in `src/app/shell/AppShell.tsx` — `system: true` puts it
   below the *Advanced* separator

### Tests

Colocated, `*.test.tsx`, Vitest + Testing Library configured inside
`vite.config.ts`. Route tests use the `renderRoute()` pattern from
`src/app/routes/routes.test.tsx` with `resetPrototypeState()` in `beforeEach`;
component tests render bare with `vi.fn()` callbacks. Test names are sentences
asserting product intent.

---

## The guard — land this before any track

| | What | File |
|---|---|---|
| **G1** | `noFixtureContent` scans all of `src/`, not only `src/app/routes/*.tsx` | `src/app/routes/noFixtureContent.test.ts` |
| **G2** | Nothing outside `src/services/mock/**` imports `src/services/mock/fixtures/**` | new |
| **G3** | Every key on `StudioServices` has a live implementation | new |

Each is verified **by breaking it** — paste a fixture phrase into a component,
import a fixture from a route, delete a port from `liveServices.ts` — and
confirming the failure message names what is wrong.

**Why G1 must widen.** The existing scan reads `readdirSync(ROUTES)` and looks
only at route files. These tracks fill `src/components/`, which it cannot see.
The defect it guards — a sentence hard-coded into a component, rendering
identically for every project — has no input that reveals it, so a behavioural
test cannot substitute.

**Why G2 replaces a word list.** Today's check is six phrases from the Ministry
Reporting fixture. One fixture per track makes that list unmaintainable and
silently incomplete. An import rule needs no vocabulary.

---

## VC-01 · Source browser and selector

**Already built and unreachable.** `GitHubSourceClient.tree()`
(`backend/src/kae_studio/acquisition/github_source.py:141`) returns a full
recursive listing plus a truncation flag, and is used only inside `pin()` to
count files and bytes. `POST /api/sources/{source_id}/sample`
(`backend/src/kae_studio/api.py:1045`) returns `{path, bytes, excerpt, proves}`
and is on no port and in no UI.

### VC-01/E

**Backend — read-only, permitted:**
- `GET /api/sources/{source_id}/tree` returning what `tree()` computes, with
  `truncated` preserved. Do not silently drop it: a truncated listing that looks
  complete is the same class of untruth this repository keeps guarding against.
- `sample` added to `AcquisitionPort`; the route exists already.

**Frontend:**
- Sources moves out of `Deliverables.tsx:214` to its own route (`VC-07/E` is the
  same edit — do them together).
- Tree and list views, breadcrumbs, search, filter, sort.
- Single and multiple selection, selected-source summary, *"Analyze selected
  sources"*.
- File preview through `sample()`.
- **Four states, not three:** loading · empty · **inaccessible** · error.
  `ConnectionState` already separates `refused` from `unreachable` because they
  need different things from the user, and the UI must keep them apart.
- `s3`, `upload` and local files appear as source kinds carrying a
  `CapabilityGap`. `SourceKind` declares `s3` and `upload` already.

**Must not:** relabel pinning or listing as *analysis*.
`POST /api/sources/{id}/analysis` returns 501 with `ANALYSIS_UNAVAILABLE` on
purpose, and GitHub issue #3 is what happens when that line blurs.

*Exit:* a pinned repository is browsable and a file previewable; the three
unbuilt kinds say why they are unbuilt.

### VC-01/H

- **Persistence first.** `AcquisitionService`
  (`backend/src/kae_studio/acquisition/service.py:39`) holds everything in
  process-memory dicts on `app.state`. Sources and connections vanish on
  restart. A browser is the first surface where a user notices, so this is a
  precondition, not a follow-up.
- S3 listing and reading — **new code**. KAE-Artifacts' `S3Client` protocol has
  `head_object`, `put_object` and `bucket_exists` only; it is publish-oriented.
  The boto session plumbing and error translation in
  `publishers/s3_boto.py` are reusable; the protocol is not.
- Pagination for large listings, path validation, tenant isolation.
- Credentials stay as `env:NAME` references on `Connection`. Never a secret in a
  request body, never one in the frontend.

---

## VC-02 · Activity and run workbench

**Reframed from the brief.** Memory's runs API is real and rendered nowhere:
`GET /v1/projects/{id}/runs`, `GET /v1/runs/{id}`, `GET /v1/runs/{id}/knowledge`,
carrying `status`, `attempt_number`, `error_code`, `error_message`,
`continuation_state` and timestamps.

Agent *execution* does not exist — it is `crazy_factory`, deferred by ADR-0001.
Pause, continue, retry and approve controls over nothing would be a page
describing a capability the product lacks.

### VC-02/E

- A runs port on `StudioServices`; `MemoryClient` needs run methods (it has
  none today).
- Activity timeline: run cards with status, attempt count and role.
- **The error vocabulary in words.** `extraction_failed`,
  `provider_unavailable`, `provider_timeout`, `provider_refused`,
  `output_truncated`, `invalid_output`, `unverifiable_output`,
  `retry_budget_exhausted` — the last means *the quoted text could not be found
  in the source, three times*, which is F-018's actual mechanism and currently
  invisible. This is `VC-10/E`; do it here.
- Collapsible output; what each run produced, linked to `useKnowledgeTrace`.
- Objective and plan panels from the projection and the ranked next action.
- **Execution controls absent**, with one `FutureState` naming what would appear.

*Exit:* the loss rate reads as individual failures with reasons, not only as a
coverage percentage.

### VC-02/H

Per-document run correlation — `document` lives inside `input_context` JSONB and
nothing queries it, so this is either client-side from the `extraction_runs_queued`
list the 202 returned, or a new index. Live updates. Then orchestration,
cancellation, concurrency, permissions and audit, when something executes.

---

## VC-06 · Ingestion workspace

**Behind it:** `POST /v1/projects/{project_id}/documents` → 202
(`kae_memory/api/routers/pipeline.py:138`). Chunks the text, records each chunk
as a verbatim message, queues one extraction run per chunk, reports
`truncated_chunks` and `warnings` rather than throwing.
`GET /extraction-coverage` reports loss beside readiness, never folded in.

**Text only.** `ingest_document(project_id, document, text: str, …)`. No file
parsing, no MIME handling, no bytes path anywhere in the estate — and
`backend/src/kae_studio/memory_client.py` has no ingest method at all.

### VC-06/E

- `MemoryClient.ingest_document()` — roughly ten lines over the existing route.
- An ingestion port, and an ingestion route in Studio.
- The centre: drop zone, connected sources, pending and completed imports,
  per-item stage, extracted candidates awaiting confirmation, duplicates and
  conflicts, provenance, retry showing the real error, resulting Memory updates.
- Storage strategy shown as a field — retained / summarised / indexed /
  referenced — reading a `CapabilityGap` until the decision below is taken.
- **Paste-text ingestion is fully real here.** No fixture in the path: text in,
  candidates out, progress and loss visible. It is the shortest honest
  end-to-end demonstration available in the estate.
- The drop zone itself renders a `CapabilityGap` until `/H` — accepting a file
  and decoding it is not an experience-layer concern.

*Exit:* pasted text becomes candidates with provenance, and both progress and
loss are visible.

### VC-06/H

File upload and decode (PDF, DOCX, Markdown → text), size and MIME limits,
malware handling, cross-document dedup (`kae_memory/domain/lexical.py` has
`is_near_duplicate`; ingestion does not use it), durability at volume, Memory
write rules.

> **Gated by a decision.** `usable-kae/04` requires each acquisition run to
> declare a persistence disposition — `MEMORY` / `RAG` / `ARTIFACT` /
> `REFERENCE` / `EPHEMERAL` — and none exists in code. They are what stops a
> large source being copied wholesale into Memory. Settle it before ingesting at
> volume; ingesting first means reclassifying real data.

---

## VC-03 · Conversation workspace

### VC-03/E

- **Split `Workspace.tsx` first** — 899 lines holding the composer, the message
  list and the context panel, several exported only so tests can reach them.
  That is `VC-09/E` and it is a prerequisite.
- **Markdown rendering.** There is none; assistant `body` renders as a plain
  `<p>` while the CIE interaction contract has specified rich Markdown since the
  first slice. This is the single highest-value item in the track.
- Message hierarchy; user / assistant / system distinction.
- Message actions: copy, retry, edit, convert to task.
- Conversation history and session resumption; suggested next actions.
- Mobile and keyboard behaviour.

> **Simulated streaming is prohibited.** No EventSource, WebSocket or
> ReadableStream exists; a turn is one awaited `POST /api/projects/{id}/turn`.
> Revealing an already-complete response progressively is fictional progress —
> the same class of untruth as fixture content. Real transport is `/H`.

`ConfirmReading`, `RecommendationCard` and `NextAction` exist and are refined
here, not rebuilt. The confirmation gesture's failure state — which never
renders as success — is the pattern to preserve.

### VC-03/H

Streaming transport, session persistence beyond today's model, accessibility
audit, failure recovery, confirmation semantics under concurrent edits.

---

## VC-05 · Expandable composer actions

### VC-05/E

**First, a defect.** The `Paperclip` "Attach a document" button in `Composer`
(`src/app/routes/Workspace.tsx`) has no `onClick`. `CLAUDE.md`'s own rule says a
control that cannot do anything is worse than an absent one, and `AppShell.tsx`
deletes the Settings button rather than disabling it. Wire it or delete it.

Then the `+` menu: upload, select project documents, browse S3, connect
repository, add requirements, add configuration, import a reference, start
research, capture voice, create task, generate artifact.

**Context-aware, not exhaustive.** Options change with project stage,
permissions and current workflow — `stagePrerequisites.ts` already computes
stage state. An unavailable action appears **with its reason**, which makes this
menu the natural consumer of `CapabilityGap`; it does not silently vanish.

Keyboard behaviour and mobile presentation are part of `/E`, not polish after it.

### VC-05/H

Upload limits, supported types, security scanning, ingestion routing,
per-action authorization.

---

## VC-04 · Voice conversation

Last: nothing exists — no Web Speech, no audio, no media dependency.

### VC-04/E

Record control; permission and unavailable states; listening / paused /
processing / speaking indicators; waveform; transcript preview and review before
submission; cancel and re-record; interruption.

**Browser-local, strictly.** A `MediaRecorder` buffer or the Web Speech API,
nothing leaving the tab. The screen states retention truthfully — *nothing is
kept* — which is true precisely because nothing is sent.

### VC-04/H

**Not merely hardening.** Consent, retention and provider choice are
preconditions. The moment audio leaves the browser it is personal data with
legal weight, and settling consent after the interaction feels good is the wrong
order in a way the other five tracks are not. Provider, cost, failure behaviour,
retention policy and explicit consent are settled **before the first byte is
transmitted**.

---

## Candidates

Recorded per the discovery rule in `CLAUDE.md`.

| | Candidate | Why | Its `/H` |
|---|---|---|---|
| `VC-07/E` | Sources gets its own route | 394 lines rendered once, inside Deliverables. Pure navigation | none needed — no capability changes |
| `VC-08/E` | Knowledge-trace surface | `useKnowledgeTrace` and `GET /knowledge/{id}/trace` exist, used on one page | performance over large histories |
| `VC-09/E` | Split `Workspace.tsx` | 899 lines, three components | none — refactor only |
| `VC-10/E` | Run errors in words | eight codes rendered as identifiers or not at all | none — presentation over existing data |

`VC-07` and `VC-09` have no `/H` because they change no capability. That is
allowed; a candidate needing hardening and lacking a named `/H` item is not.

### Disqualified, kept as worked examples

- **Simulated streaming** — fictional progress.
- **Execution controls over no execution engine** — a control implying a
  capability that does not exist.
- **A "repository analyzed" state** — `ANALYSIS_UNAVAILABLE` exists to prevent
  exactly this, and issue #3 is what happens when the product blurs it.
