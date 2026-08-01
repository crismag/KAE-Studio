# Joint Capability Matrix: Studio Needs vs. KAE-Memory Today

Status: **evidence-based analysis of KAE-Memory at commit `de37cc4` (branch `feat/local-development-and-enablement`), 2026-08-01.** No implementation is proposed or authorized by this document.

## Method

Every row below was established by reading KAE-Memory's **code, migrations, API routes, and tests** — not its planning documents. Evidence cites repository paths in `/mnt/ai/workspaces/KAE-Memory`. Where a capability could not be found, the row says absent rather than assuming it exists elsewhere.

Ownership follows the rule: **Memory where the need is durable engineering knowledge; Studio where the need is interaction, presentation, configuration, or external delivery.**

## What KAE-Memory verifiably has today

| Capability | Evidence |
| --- | --- |
| Projects, sessions, ordered messages | `domain/workspace.py`, `persistence/tables.py` (`ProjectRow`, `SessionRow`, `MessageRow`), `api/routers/workspace.py` |
| Knowledge items with immutable, contiguous versions | `domain/models.py:109` `KnowledgeItem`, `KnowledgeVersion` |
| Lifecycle states with guarded transitions | `domain/lifecycle.py`, `ensure_transition` |
| Typed relationships between knowledge items | `domain/models.py:154` `RelationshipType`, `KnowledgeRelationshipRow` |
| Provenance links (knowledge → run, → message) | `domain/models.py:186` `ProvenanceLinkType`, `ProvenanceLinkRow` |
| Agent runs with leases, resume, idempotency keys | `domain/execution.py:153`, `agents/roles.py`, `tests/application/test_run_lifecycle.py` |
| Knowledge areas + weighted readiness scoring | `domain/readiness.py` (`SOFTWARE_TEMPLATE`, 10 areas), `application/readiness_service.py:334` |
| Append-only readiness snapshots with staleness detection | `domain/readiness.py:249` `ReadinessSnapshot.is_stale_against` |
| Blockers and contradiction recording/resolution | `application/readiness_service.py:241-325`, `api/routers/readiness.py` |
| Review findings (7 kinds) | `application/review_service.py:43` `FindingKind` |
| Blueprint generation + Markdown rendering | `application/blueprint_service.py`, `render_markdown` |
| Full chain-of-custody trace for a knowledge item | `application/blueprint_service.py:271` `trace`, `GET /knowledge/{item_id}/trace` |
| Semantic retrieval: chunking, embedding, vector search | `application/retrieval_service.py`, migration `0004_add_knowledge_chunks_and_vector_index.py` |
| Monotonic per-project knowledge revision counter | `application/readiness_service.py:425` `knowledge_revision` |

This is a substantial, well-tested engineering-memory platform. The gaps below are extensions to it, not a rewrite.

## The matrix

Gap severity: **None** (usable as-is) · **Additive** (extend an existing vocabulary or expose an existing capability) · **Structural** (new domain concepts, storage, or computation).

### A. Project structure and modules

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| Store a module and its responsibilities | None. `KnowledgeKind` has 8 values: actor, goal, rule, constraint, requirement, decision, unknown, assumption. No module. | `domain/models.py:91-106` | **Additive for the label; structural for the capability** | Memory | Extending `KnowledgeKind` is a one-line additive change, but **it does not deliver first-class modules.** Identity, lifecycle, relationship operations, traversal, scoped readiness, decomposition decisions, split/merge semantics, invariant findings, and bounded assembly are all required. See the minimum module capability contract in `../architecture/MODULE_SPECIFICATION.md`. |
| Store stakeholders, workflows, interfaces, data entities, risks, acceptance criteria, action items, deliverables | Same vocabulary limit. `actor` covers stakeholders partially. | `domain/models.py:91` | **Additive** | Memory | Extend `KnowledgeKind`. Decide per concept whether it is a typed knowledge item or warrants its own structure — choose on operations and invariants, not UI sections. |
| Module → depends on → Module | `RelationshipType` has supports, contradicts, derives_from, implements, validates, supersedes, blocks. No `depends_on`. | `domain/models.py:154-170` | **Additive** | Memory | Extend `RelationshipType`. Also a plain string column per its docstring. |
| owns / exposes / consumes / uses / satisfies / verified_by / affected_by / blocked_by | `implements`, `validates`, `blocks` are near-matches; the rest absent. | `domain/models.py:154` | **Additive** | Memory | Extend the vocabulary. Prefer reusing `implements`/`validates`/`blocks` over inventing synonyms. |
| Create a relationship through the API | **No general relationship write path.** The only exposed creation is `record_contradiction`. | `application/readiness_service.py:241`, `api/routers/readiness.py:170`; no relationship route in the route inventory | **Structural** | Memory | A first-class relationship API: create, delete, query by source/target/type. Today edges can only be born as contradictions. |
| Traverse the graph (transitive dependencies, impact, blocked-by chains) | **Absent.** No traversal in any service or repository. | `application/`, `persistence/` — no recursive query or traversal method | **Structural** | Memory | Traversal operations. Studio must not paginate nodes and rebuild the graph client-side. |
| Graph invariants: acyclic dependencies, one data owner, one interface owner | **Absent.** `Relationship.__post_init__` enforces only that endpoints differ. | `domain/models.py:172-184` | **Structural** | Memory | Invariant checking, surfaced as findings rather than enforced at write time. |
| Draw the dependency graph; collapsible module sidebar | Absent by design | — | New | **Studio** | Route, components, projection |

### B. Discovery and interview state

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| Remember an open question | `KnowledgeKind.UNKNOWN` + `FindingKind.OPEN_QUESTION` | `domain/models.py:105`, `application/review_service.py:50` | **None** | Memory | Usable as-is |
| Remember which question was asked, answered, deferred, or became irrelevant | **Absent.** Messages are stored, but no question state. `Blocker` has open/resolved only. | `domain/workspace.py`, `domain/readiness.py:80` | **Structural** | Memory | Discovery-state tracking. This is durable engineering memory, not UI state — it is what prevents restarting interviews across sessions and tools. |
| Know why a question is being asked again | Absent | — | **Structural** | Memory | Depends on the above plus supersession |
| Which discovery topics are discussed vs. blocked | Partial: area coverage gives topic-level state; blockers give obstruction | `domain/readiness.py` `AreaState`, `Blocker` | **Additive** | Memory | Extend to interview-topic granularity |
| Interview type selection, question phrasing, chat presentation | Absent by design | — | New | **Studio** | Interview orchestrator |
| Provider selection (Claude / OpenAI / Bedrock) | Absent by design | — | New | **Studio** | Configuration |

### C. Readiness

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| Project readiness with explanation | Weighted areas, per-area state, snapshots, blockers, staleness | `domain/readiness.py`, `application/readiness_service.py:334` | **None** | Memory | Strong; reuse unchanged |
| **Module readiness** | **Absent — readiness is project-wide only.** `ReadinessSnapshot` is keyed by `project_id`; area links attach knowledge to an area, not to a module. | `domain/readiness.py:249-268`, `KnowledgeAreaLinkRow` | **Structural** | Memory | Scope-aware readiness. Confirms the hypothesis: a project may be 55% defined while one module is implementation-ready. |
| Integration / architecture / implementation-package readiness | Absent; same root cause | same | **Structural** | Memory | Scope + template variants |
| Per-dimension module readiness (requirements, interfaces, data, security, ops, tests, UI) | The 10-area template is close in spirit — it already includes `interfaces_and_integrations`, `domain_model_and_data`, `acceptance_criteria`, `delivery_and_operations` | `domain/readiness.py` `SOFTWARE_TEMPLATE` | **Additive** once scoping exists | Memory | Reuse the template mechanism at module scope; do not invent a second scoring model |
| Present readiness as understandable project health | Absent by design | — | New | **Studio** | Presentation |

### D. Context assembly

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| A project blueprint from confirmed knowledge, with labels and limits | `BlueprintService.generate`, sectioned by area, statements labelled by provenance authority | `application/blueprint_service.py:155-236` | **None** for project discovery briefing | Memory | Reuse |
| Bounded assembly by **scope** (one module) | **Absent.** Blueprint is project-wide and area-sectioned. | `application/blueprint_service.py:171` | **Structural** | Memory | Scope parameter |
| Bounded assembly by **purpose** (implementation, integration, UI, review, test-generation, customer review, change-impact) | **Absent.** One generic blueprint shape. | same | **Structural** | Memory | Purpose + include-list, returning a versioned traceable assembly |
| Traceability from assembled statements to evidence | `trace` returns the full chain: project → session → message → run → knowledge → versions | `application/blueprint_service.py:271` | **None** | Memory | Reuse; excellent fit for package honesty requirements |
| Rendering, packaging, file layout | `render_markdown` exists but is one fixed rendering | `application/blueprint_service.py:347` | New | **Studio** | Package generation is Studio delivery; Memory returns the assembly, Studio decides presentation |

### E. Evidence ingestion

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| Submit a conversational message as evidence | `POST /sessions/{session_id}/messages`; `MessageRow`; knowledge links back via `derived_from_message` | `api/routers/workspace.py:85`, `domain/models.py:186` | **None** | Memory | Reuse |
| **Idempotent** evidence submission keyed by a Studio message ID | **Absent.** Idempotency keys exist for *agent runs*, not for message ingestion; messages are identified by session + sequence number. | `domain/execution.py:153`, `application/memory_service.py:169` | **Structural** | Memory | Idempotency on ingestion keyed by external source reference. Required by VERTICAL_SLICE AC-04; retry currently risks duplicate evidence. |
| Trigger extraction | `POST /projects/{id}/runs` (enqueue) with idempotency key, plus durable run state and SSE events | `api/routers/workspace.py:150`, `api/events.py` | **None** | Memory | Reuse |
| Ingest documents, transcripts, diagrams as evidence | Messages are text-only; no attachment concept | `domain/workspace.py:79` `Message` | **Structural** | Memory (evidence record) + **Studio** (file storage) | Attachment evidence with content reference |

### F. Artifacts and publication

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| Record that an artifact was generated, from which revision, covering which requirements | **Absent entirely.** No artifact concept in domain, tables, or migrations. | `grep -i artifact src/kae_memory` → no domain hits; `migrations/versions/` has 5 migrations, none artifact-related | **Structural** | Memory | Artifact generation record with source revision, checksum, coverage |
| Know whether an artifact is still current | Absent for artifacts; the *mechanism* exists — `is_stale_against(current_revision)` already does exactly this for readiness snapshots | `domain/readiness.py:302` | **Additive** given the artifact record | Memory | Apply the existing staleness pattern |
| Record publication outcome, target, and conflict | Absent | — | **Structural** | Memory | Publication recording API |
| Perform the GitHub commit / local file write / S3 upload | Absent by design | — | New | **Studio** | Delivery adapters (ADR-0003) |
| Artifact target configuration, credentials, review UI | Absent by design | — | New | **Studio** | Configuration + delivery |

### G. Change impact

| Studio need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| When a requirement changes: affected modules, dependent requirements, invalidated decisions, interfaces needing review, outdated artifacts, reopened action items | **Absent.** Requires relationships (B), traversal (A), and artifact records (F) first. | — | **Structural** | Memory | Change-impact analysis — dependent on every other structural gap |

## Findings

**1. The foundation is strong and the gaps are consistent.** Versioned knowledge, provenance, lifecycle, runs, readiness explanation, findings, trace, and retrieval all exist and are tested. Nothing in the analysis suggests rework of what is built.

**2. Two gaps are cheap and unblock most of the model.** `KnowledgeKind` and `RelationshipType` are plain string columns validated against enums, and both docstrings explicitly anticipate additive extension without migration. Modules, interfaces, data entities, and the `depends_on` / `owns` / `satisfies` / `verified_by` edges are vocabulary extensions, not schema work.

**3. Three gaps are genuinely structural and should be sequenced deliberately:**

- **Relationship write + traversal API.** Today an edge can only be created as a contradiction, and nothing traverses the graph. This blocks modules, dependency ordering, and change impact simultaneously. **Highest-value single change.**
- **Scoped readiness.** Readiness is project-wide by construction. Module-level implementation readiness — the product's central claim — cannot be expressed today.
- **Purpose- and scope-bounded context assembly.** One generic blueprint exists; bounded module implementation context does not.

**4. Idempotent evidence ingestion is a correctness gap, not a feature gap.** AC-04 requires that retrying a message submission does not duplicate evidence. Run enqueueing is idempotent; message recording is not. This is small and should be fixed early.

**5. Artifact and publication records are entirely absent** — expected, since ADR-0003 is a day old. The staleness mechanism to make them useful already exists and should be reused rather than reinvented.

**6. RESOLVED by ADR-0006 — KAE-Memory owns the durable conversation.** The analysis below stands as the reasoning that produced the decision.

**Original finding: who owns the conversation?** KAE-Memory already stores sessions and ordered messages, and `ProvenanceLink.message_id` binds knowledge to them. Studio's `DATA_OWNERSHIP.md` also assigns conversation to Studio, justified by AC-03 (the user's message must survive when Memory is unavailable). Both can be true — Studio's conversation record is the durable interaction log and retry buffer; Memory's message is the evidence record — but the duplication must be a recorded decision, not an accident. **Resolved: ADR-0006 assigns durable projects, sessions, and messages to KAE-Memory. Studio holds only a transient send buffer.** The duplication is removed rather than justified — a second durable record of what the user said would let the provenance spine diverge.

## Recommended sequence

1. ~~Record the conversation-ownership decision~~ — done, ADR-0006.
2. Fix idempotent evidence ingestion (finding 4) — small, and a stated acceptance criterion.
3. Extend `KnowledgeKind` and `RelationshipType` (finding 2) — cheap, additive, unblocks the model.
4. Build the relationship write + traversal API with contract tests (finding 3a) — the highest-leverage change.
5. Scope readiness to modules (finding 3b).
6. Add purpose/scope-bounded context assembly (finding 3c).
7. Add artifact and publication records, reusing the staleness pattern (finding 5).
8. Change-impact analysis last — it depends on everything above.

Under ADR-0004, a **Phase 0 read-only MCP server** can proceed in parallel with steps 1–4, since it needs nothing that does not already exist. Authentication and tenancy must be settled before it is exposed outside a trusted network.

Steps 1–4 are plausibly sufficient for a first demonstrable Studio slice. Steps 5–8 are what make the product complete.

## Effect of ADR-0004 (MCP access layer)

ADR-0004 adds coding agents as direct clients of KAE-Memory through an MCP service. It does not change any gap above, but it changes their sequencing value and adds two rows:

| Studio/agent need | Existing Memory capability | Evidence | Gap | Owner | Required change |
| --- | --- | --- | --- | --- | --- |
| MCP resources, tools, and prompts over existing capability | Absent — no MCP surface exists | no MCP module in `src/kae_memory/` | **Structural, but cheap** | Memory | A Phase 0 read-only server over projects, briefing, search, findings, project readiness, and trace — all of which exist today |
| Record what an agent implemented (files, tests, coverage, revision, discoveries) | Absent — same gap as artifact/publication records | see section F | **Structural** | Memory | Delivery recording; depends on section F |
| Authentication, tenancy, per-operation scoping | **Not examined; likely absent** | not analysed | **Structural** | Memory | Becomes urgent under ADR-0004: external agents connect directly, so this can no longer be deferred behind a trusted-network assumption |

The important sequencing consequence: **a Phase 0 MCP server is buildable on today's KAE-Memory** and validates transport, auth, and tool-surface design before any structural work begins. `kae_get_module_context` and `kae_record_delivery`, by contrast, sit behind the structural gaps in sections A, C, and F.

## Constraint on all Memory changes

Every capability above must be exposed as a **product-neutral API** that serves Studio, a CLI, an IDE extension, or another agent equally. Nothing Studio-specific enters KAE-Memory: no view models, screen or panel configuration, theme or provider settings, GitHub workflow, file-picker behavior, deployment logic, or form state.

The test to apply before any Memory change: *would a different client, with a different interface, need this same durable fact or operation?* If not, it belongs in Studio.

## Open items this analysis could not settle

- **Authentication and tenancy** between Studio and Memory were not examined; `SYSTEM_BOUNDARY.md` requires project/tenant scoping on every request.
- Whether the existing `frontend/` in KAE-Memory continues as diagnostics or is retired — out of scope here, and ADR-0001 already says it stays with Memory for now.
- Effort sizing per gap; this analysis establishes existence, not cost.
