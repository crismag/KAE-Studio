# KAE Completion Status

**Operational tracking. Update only when a phase or gate changes, not after every commit.**

## The single register

**`KAE-Memory/docs/09_development/MCP_TARGET_CHECKLIST.md` (T1–T25) is the source of truth for KAE-Memory work.**

The G0–G7 gates below remain useful as the *product* view — they say when Studio, publication, and the end-to-end demonstration are provable. They are not a second work queue. Where the two disagree, the T-checklist is correct.

GitHub issues #37–#53 were the earlier G-scheme queue. They are **superseded and should be closed**; the current PAT lacks permission to close them.

## Completion target — Demo V1

A user defines one real project in KAE-Studio through a governed interview. KAE-Memory retains the conversation and evidence, develops confirmed project knowledge, identifies and curates modules and dependencies, calculates honest module readiness, generates one project package and one implementation-ready module package, and publishes it to a local folder or GitHub. Claude Code opens the target repository and starts implementation **without the user restating the project**.

## Where the work actually is

| Phase | Targets | Status |
| --- | --- | --- |
| **A** Token and response efficiency | T1, T1B, T2, T2B, T3 | Done — briefing cut 12,199 → 3,634 chars (71%) |
| **A** (remainder) | **T4, T5** | **Open** |
| **B** Embedding replacement | T6–T11 | **Complete** — Titan `titan-embed-text-v2:0`, 32 chunks migrated |
| **C** Knowledge review surfaces | T11B, T12–T15 | **Complete with documented limitations** |
| **D** Clarification surfaces | T16, T17, T18 | **Complete** |
| **E** Ingestion and assembly | **T19–T23** | **Open — the frontier** |
| **F** Project focus and default scope | T25.1–T25.4 | Deferred |
| **G** Observation classification | T24.1–T24.5 | Deferred, high priority |

**18 of ~25 targets delivered.**

## Pending work

### Now — Phase E, the frontier

| Target | Work | Why it matters |
| --- | --- | --- |
| **T19** | `kae_ingest_document` | Material other than chat becomes evidence |
| **T20** | Connect ingestion to observations and proposed knowledge | Ingested text has to become reviewable knowledge, not a blob |
| **T21** | `kae_assemble_context` | **The load-bearing one.** No package exists without bounded assembly |
| **T22** | Compact manifests and external artifacts | Lineage, hashes, and the files a coding agent reads |
| **T23** | End-to-end MCP workflow test | Proves the loop rather than its parts |

T21 and T22 are what the earlier G4 issues (#48–#50) described. Same work, one register.

### Next — finish Phase A

| Target | Work |
| --- | --- |
| **T4** | Pagination, limits, and detail levels on read tools, honouring ADR-0021 §Coordination |
| **T5** | Verify token reduction without losing essential context |

### Deferred, in priority order

**T24 — observation classification** (high priority): deterministic extraction of dates and identifiers, semantic classification with confidence, operational records, briefing filters by retention tier, and resolving whether `classification_hint` is honoured or removed.

**T25 — project focus**: Studio injects the active `project_id` (zero KAE change), accept `project_key` alongside `project_id`, server-side active project only if that proves insufficient, cross-project comparison as a separate tool and never a wider default.

### Not yet on the T-register — needed for Demo V1

These were the G3/G5/G6/G7 issues. They are real Demo V1 requirements with no T-number yet.

| Work | Blocks | Note |
| --- | --- | --- |
| **Modules as first-class** — kind, relationship write, traversal, module-scoped readiness | Module packages | `kae_get_module_context` still returns `capability_unavailable`, correctly |
| **Studio integration** — five mock adapters replaced | G5 | Studio prototype is complete and unconnected |
| **Publication** — one publisher, preview, conflict detection | G6 | |
| **End-to-end demonstration** | G7 | |

## Product gates

| Gate | Status | Evidence |
| --- | --- | --- |
| **G0** Baseline | Done | Suites green across three repositories |
| **G1** MCP operational | **Done** | 13 tools over STDIO; Claude Code connected |
| **G2** Governed acquisition loop | **Done** | Phases C + D — create, confirm, reject, correct, clarify, with audit trail |
| **G3** First-class module model | Open | No T-number yet |
| **G4** Package assembly | **In progress** | T21, T22 |
| **G5** Studio integration | Open | Prototype complete, adapters still mocked |
| **G6** Publish and consume | Open | |
| **G7** End-to-end demonstration | Open | T23 covers the MCP half |

**4 of 8 gates have executable proof.**

## Boundary decisions

- **Memory owns durable project knowledge** — evidence, knowledge, revisions, provenance, confirmation, relationships, readiness, findings, retrieval, assembly, lineage, and the conversation (ADR-0006).
- **Studio owns interface and configuration** — layout, preferences, provider selection, interview presentation, projections as caches, generation requests, delivery targets, publication.
- **Slim is reference-only** unless evidence changes ADR-0019.
- **Delivery renders Memory-owned context** (ADR-0020).

## Environment

**PostgreSQL + pgvector on `localhost:5432` is the default local provider** (`LOCAL_DEVELOPMENT.md`), database `kae_memory`, migrations at **0010**. CockroachDB is also supported (ADR-0022) and is *not* the default — pointing tooling at it wastes time on the wrong engine.

`KAE_DATABASE_PROVIDER` is mandatory and has no default: a URL never implies a provider.

## Deferred — Later

Multi-tenancy · billing · multiple autonomous expert agents · organization pattern marketplace (ADR-0005) · every artifact profile · production OAuth for remote MCP · simultaneous GitHub + local + S3 publishing · automated implementation · collaborative editing · importing Slim's knowledge model · full SaaS hardening.

## Progress measure

**Executable proof, not documents or commits.** 18 of ~25 T-targets; 4 of 8 product gates.

## Last verified

**2026-08-04.** KAE-Memory `ef01372` + fixes. `kae-memory-mcp doctor` against PostgreSQL: provider `postgresql`, vector `pgvector`, migrations `0010`, 3 projects, 13 tools, 4 resources, 1 prompt — **ready to serve**. Claude Code: **✓ Connected**.

Outstanding: issues #37–#53 need closing (permission); the Ministry Reporting sample sits in CockroachDB `kae_dev`, not the default PostgreSQL.
