# KAE Completion Status

> **Superseded, 2026-08-07. Read the registers named below instead.**
>
> This page pointed at `KAE-Memory/docs/09_development/MCP_TARGET_CHECKLIST.md`
> as "the source of truth" for four days after that file stopped existing there
> — the documentation reset moved KAE-Memory's development history into
> KAE-Ecosystem, and this reference was not carried with it. Everything below
> the line is preserved as of **2026-08-04** and is wrong in specifics: it says
> Studio's adapters are still mocked, migrations are at `0010`, there are 13 MCP
> tools and 792 tests. Studio is connected and deployed, the head is `0021`,
> there are 30 tools and 1,728 tests.
>
> **Where to look now:**
>
> | For | Read |
> |---|---|
> | KAE-Memory targets | `KAE-Ecosystem/development-context/KAE-Memory/docs/09_development/MCP_TARGET_CHECKLIST.md` |
> | KAE-Memory defects and gaps | `KAE-Memory/specifications/FINDINGS_REGISTER.md` |
> | Deployment and integration | `KAE-Ecosystem/roadmap/ECOSYSTEM_ROADMAP.md` |
> | Studio's UI targets | [`../product/REQUIREMENTS_PAGE_TARGETS.md`](../product/REQUIREMENTS_PAGE_TARGETS.md) |
>
> It is kept rather than deleted because the G0–G7 framing and the Demo V1
> definition are still the clearest statement of what "finished" means, and
> because a status page that quietly vanishes teaches nobody why it went wrong.
> **A register nobody updates does not become neutral — it becomes confidently
> false**, and this one was cited by its own first sentence.

---

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
| **E** Ingestion and assembly | T19–T23 | **Complete** — Demo V1 scenario passes end to end |
| **F** Project focus and default scope | T25.1–T25.4 | Deferred |
| **G** Observation classification | T24.1–T24.5 | Deferred, high priority |

**23 of ~25 targets delivered.**

## Pending work

### Now — finish Phase A

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
| **G4** Package assembly | **Done** | Bounded assembly pinned to a revision, hashed, with a deterministic package description |
| **G5** Studio integration | Open | Prototype complete, adapters still mocked |
| **G6** Publish and consume | Open | |
| **G7** End-to-end demonstration | Open | T23 covers the MCP half |

**5 of 8 gates have executable proof.**

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

**Executable proof, not documents or commits.** 23 of ~25 T-targets; 5 of 8 product gates.

## Phase E — what it delivered

`kae_ingest_document` and `kae_assemble_context` on the MCP surface, plus a
deterministic package description and the Demo V1 acceptance scenario.

The application services already existed and were tested; what was missing was
the surface. The work was wiring, and the value is in what each response
refuses to claim:

- Ingestion keeps three facts apart — text recorded, extraction **queued**,
  knowledge unchanged. An unread remainder is stated rather than dropped.
- Draining the queue yields **candidates**, each tracing to the stored span it
  came from. A document cannot confirm its own contents.
- Assembly is bounded by purpose, pinned to a revision, and hashed. The
  manifest always carries the confirmation split and every unresolved gap.
- Candidates get their own `unconfirmed` artifact rather than being mixed into
  a confirmed area, so the boundary is a file boundary.

**792 tests, 92% coverage on PostgreSQL**, ruff + format + mypy clean.

## Last verified

**2026-08-04.** KAE-Memory `3efe6e1` (Phase E merged). `kae-memory-mcp doctor` against PostgreSQL: provider `postgresql`, vector `pgvector`, migrations `0010`, 3 projects, 13 tools, 4 resources, 1 prompt — **ready to serve**. Claude Code: **✓ Connected**.

Outstanding: issues #37–#53 need closing (permission); the Ministry Reporting sample sits in CockroachDB `kae_dev`, not the default PostgreSQL.
