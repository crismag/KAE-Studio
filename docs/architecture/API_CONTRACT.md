# KAE-Studio to KAE-Memory API Contract

Status: minimum required contract; verify against existing KAE-Memory APIs before implementation.

This document has two parts. **Minimum first-slice operations** are the evidence/knowledge/readiness basics. **Project-model operations** are required by ADR-0002 and are substantially more demanding — treat them as proposed until the capability matrix proves what KAE-Memory already provides.

## Contract principles

- Version endpoints and response schemas.
- Treat KAE-Memory as the authority for memory semantics.
- Use idempotency keys on commands that can be retried.
- Return stable resource identifiers and explicit processing states.
- Support asynchronous completion; do not require browser ownership of an agent run.
- Never make Studio depend on Memory table names.

## Capability inventory required first

Before adding endpoints, inspect KAE-Memory and classify each capability as:

- reusable unchanged;
- present but missing required API exposure;
- present with a contract mismatch;
- not implemented;
- intentionally deferred.

Do not infer capability from planning documents alone. Verify code, migrations, and tests.

## Minimum first-slice operations

### Create or link a memory project

```http
POST /v1/projects
```

Studio supplies a stable external project reference and basic metadata. The command must be idempotent for that external reference.

### Submit message evidence

```http
POST /v1/projects/{memory_project_id}/evidence
Idempotency-Key: studio-message:{message_id}
```

Payload includes source type, source reference, actor/role, timestamp, content, and optional attachment metadata. The response returns `evidence_id` and processing/run state.

### Start or request knowledge extraction

```http
POST /v1/projects/{memory_project_id}/extractions
```

The request identifies one or more evidence records. If existing Memory behavior combines evidence ingestion and extraction, document that instead of inventing a duplicate operation.

### Read run state

```http
GET /v1/runs/{run_id}
```

Return queued/running/succeeded/failed/cancelled state, attempt, safe error information, and result references.

### Retrieve current project briefing

```http
GET /v1/projects/{memory_project_id}/briefing
```

Return a compact, current, project-scoped context suitable for choosing the next interview question. It should include revision identity, confirmed/proposed knowledge as policy permits, important unknowns, and relevant findings.

### Retrieve requirements projection source

```http
GET /v1/projects/{memory_project_id}/knowledge?area=...
```

Return structured knowledge and provenance references. Pagination and filtering are required once results can grow.

### Retrieve readiness/findings

```http
GET /v1/projects/{memory_project_id}/readiness
GET /v1/projects/{memory_project_id}/findings
```

Studio translates these into user-facing Project Health. Studio must not recompute Memory-owned readiness rules independently.

### Assemble export context

```http
POST /v1/projects/{memory_project_id}/context-assemblies
```

Request a bounded context for an initial project definition. The response must identify the exact Memory revision and trace references used.

## Project-model operations

Required by ADR-0002. The project model — typed nodes, typed relationships, module readiness — is Memory-owned knowledge, so these are Memory contracts, not Studio-side inference.

**Status of this section: proposed contract, unverified.** KAE-Memory today is known to cover evidence, extraction, knowledge, areas, readiness, review/findings, retrieval, and runs (through M10). Whether it supports typed model nodes, typed edges, graph traversal, and per-module readiness is **unknown and must be established by the capability matrix before any of this is implemented**. Where Memory already expresses these concepts under different names, adopt Memory's naming rather than inventing a parallel vocabulary.

### Read model nodes

```http
GET /v1/projects/{memory_project_id}/model/nodes?type=module&status=confirmed
```

Returns typed nodes with stable keys (`MOD-APR`, `FR-APR-001`), status, provenance references, and the revision they belong to. Pagination and filtering by type, status, and module scope are required.

### Read relationships

```http
GET /v1/projects/{memory_project_id}/model/edges?from=MOD-APR&type=depends_on
```

Returns typed edges. Must support querying by source, target, and edge type.

### Traverse

```http
POST /v1/projects/{memory_project_id}/model/traversals
```

Answers the questions the product is built on: what does this module depend on transitively; what verifies this requirement; what is blocked by this open decision; what does changing this node affect. Studio must not reimplement traversal client-side over paginated node lists.

### Propose and revise model nodes

```http
POST /v1/projects/{memory_project_id}/model/revisions
Idempotency-Key: studio-edit:{edit_id}
```

Carries a user edit — confirm, correct, split a module, merge modules, reject, defer — as evidence plus a revision request. The response identifies the new revision and the affected nodes. Studio never mutates knowledge by any other route.

### Module readiness

```http
GET /v1/projects/{memory_project_id}/modules/{module_key}/readiness
```

Per-dimension readiness (requirements, interfaces, data model, security, operations, acceptance tests, UI). Studio presents this; Studio must not recompute the rules.

### Graph invariant findings

```http
GET /v1/projects/{memory_project_id}/findings?kind=invariant
```

Dependency cycles, data entities with no or multiple owners, requirements with no verifying test, unowned interfaces, orphaned nodes with no evidence. These drive the Reviews view.

### Assemble a bounded module context

```http
POST /v1/projects/{memory_project_id}/context-assemblies
```

Extends the existing operation with a module-bounded scope: the module and everything needed to implement it, per `MODULE_SPECIFICATION.md`. The response must pin the exact revision and return trace references.

### Record a publication

```http
POST /v1/projects/{memory_project_id}/publications
```

Records that an artifact was published: artifact identity, source revision, content hash, target descriptor, and supporting requirement/evidence references. Memory records the fact; it performs no commits, filesystem writes, or object transfers.

## Error semantics

At minimum distinguish:

- invalid input;
- project not found or unauthorized;
- idempotency conflict;
- accepted/processing;
- provider or agent failure;
- transient dependency failure;
- completed with partial results.

Studio should not expose raw internal exceptions to the browser.

## Compatibility

The first Studio client can live in a package/module named `kae_memory_client`. It owns HTTP serialization, authentication, retries, timeouts, correlation IDs, and response validation. Application code calls this client interface rather than raw endpoints.

