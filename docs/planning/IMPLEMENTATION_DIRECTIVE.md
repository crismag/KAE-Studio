# Implementation Directive for Claude

Status: execution prompt. **Resequenced by MCP-M1 and corrected by ADR-0006.**

## Objective

Establish KAE-Studio as the product-facing repository without destabilizing KAE-Memory. Begin from the intended user experience, then connect the persistent memory engine through a controlled boundary.

## Before coding

1. Inspect the current KAE-Studio repository structure, branch, status, and existing documentation.
2. Read this complete document set.
3. Inspect KAE-Memory separately and produce an evidence-backed capability matrix for the first vertical slice.
4. Distinguish implementation verified in code/tests from plans or proposed contracts.
5. Identify conflicts with existing decisions before proposing replacements.

Do not modify KAE-Memory during the initial KAE-Studio planning pass.

## Required planning output

Create or refine repository-local documents that provide:

1. Current KAE-Studio state.
2. Re-scoped first vertical-slice user journey, reflecting ADR-0002 and ADR-0003.
3. UI information architecture, Workspace behavior, and the structured views.
4. Studio component design, including the interview orchestrator, projection layer, artifact generator, and publisher abstraction.
5. Studio-owned state inventory, and whether it justifies a database at all (ADR-0006). Studio owns interface state, configuration, projections, and delivery — not conversation, and not the project model.
6. Existing KAE-Memory capability/reuse matrix, covering the project-model operations in `../architecture/API_CONTRACT.md`, not only the evidence/knowledge basics.
7. Missing KAE-Memory API contract requirements, especially typed nodes, typed edges, traversal, and per-module readiness.
8. Error, retry, idempotency, and eventual-consistency behavior.
9. Publication behavior: review, diff presentation, conflict detection, credential handling.
10. Acceptance-test plan.
11. Ordered implementation issues/milestones.

## Capability matrix format

| Needed capability | Verified Memory implementation | Existing API | Reuse decision | Gap/action | Evidence |
| --- | --- | --- | --- | --- | --- |

Evidence must cite repository paths, migrations, tests, or callable endpoints. Do not mark a feature implemented merely because a requirement or ADR describes it.

## Implementation order

**MCP-M1 and the Studio prototype are now demonstrated.** The remaining Studio implementation work starts by tightening the production contract instead of adding broader mock behavior. Do not replace mock adapters route-by-route until the required Memory HTTP operation is verified or explicitly added to the contract.

### Phase 0: MCP-M1 in KAE-Memory

Complete. The program register records KAE-Memory Phase E merged on 2026-08-04, `kae-memory-mcp doctor` passing against PostgreSQL, 13 tools, 4 resources, 1 prompt, and Claude Code connected. Keep future MCP work in KAE-Memory; Studio consumes Memory through HTTP contracts.

### Phase 1: Evaluate the demonstration

Record what worked, what the agents actually needed, and which tool responses were unhelpful or misleading. This evidence shapes every phase after it. If scoped context proves not to help an agent, the product thesis needs revisiting before Studio is built.

### Phase 2: Resolve ownership and configuration

Confirm ADR-0006 in practice. Determine what state Studio genuinely owns and whether it needs a database at all. Establish configuration boundaries and secret handling.

### Phase 3: Freeze the first Studio HTTP contract

Use `PRODUCT_CONTRACT_ALIGNMENT.md` and `STUDIO_PORT_DISPOSITION.md` to split prototype ports into Memory HTTP, Studio orchestration, Studio projection, Studio rendering, and Studio publication responsibilities. Contract-test each frozen Memory operation.

Do not implement the full project model. Keep module curation and module package behavior visibly unavailable in production mode until first-class modules, relationship write/traversal, and module-scoped readiness exist.

### Phase 4: Studio shell

Complete as a frontend prototype. Keep the existing shell and routes, but replace deterministic adapters only where the Phase 3 contract has executable proof. Workspace remains the default project view. Future or unsupported destinations stay honest about their blockers.

### Phase 5: Connect Studio to Memory and one provider

Implement the typed `kae_memory_client`. Submit messages *through Memory* — Studio persists no durable conversation. Add one AI-provider interface and adapter. Implement summary plus focused next-question behavior with durable retry and failure states.

### Phase 6: Project-definition projections

Render requirements, modules, dependencies, and readiness gaps from Memory knowledge. Surface unresolved decisions. Make provenance available on demand, not primary.

### Phase 7: Context generation and one publisher

Generate a versioned module context package pinned to an exact Memory revision. Implement **one** publisher properly, keeping the `ArtifactPublisher` interface intact for the others. Show proposed changes before writing; detect conflicts; never overwrite silently.

### Phase 8: Retain changes

Accept decisions discovered during implementation as new evidence. Mark artifacts from superseded revisions outdated. Support regeneration as a diff.

## Testing expectations

- Unit-test interview state and provider boundary behavior.
- Integration-test Studio database migrations and message/outbox durability.
- Contract-test the Memory client against the actual API schemas.
- Verify idempotent retries.
- Verify correction and provenance behavior end to end.
- Verify artifact revision pinning.
- Provide a deterministic provider fixture for tests without presenting it as the production AI experience.

## Scope note

Where this directive conflicts with `../architecture/PROJECT_MODEL.md`, `../architecture/MODULE_SPECIFICATION.md`, `../delivery/`, or ADR-0006, those govern.

## UI direction

Do not reproduce the current KAE-Memory tabs as the Studio home page. The existing screens are an engine diagnostic interface.

The Workspace should make this story obvious:

```text
Project title and phase
Conversation and next question
Current understanding/progress
Recently changed requirements
Available deliverables
```

The product should not ask users to manually assign every sentence to an area, inspect raw agent JSON, or run review agents to make normal progress.

## Database direction

- **Do not provision a Studio database before Phase 2 establishes it is needed.** ADR-0006 removed durable conversation from Studio; what remains may not justify one.
- If one is needed: add only Studio-owned migrations here, target `kae_studio`, and never create or modify `kae_memory` objects.
- A pending-send buffer is transient operational state, not a durable conversation store.
- Avoid cross-database foreign keys and transactions.
- Store stable external references returned by Memory.
- Keep large artifact bytes in object storage when introduced.

## Change-control rule

If Studio needs a KAE-Memory change:

1. Record the missing capability and desired versioned contract in Studio.
2. Verify no suitable capability already exists.
3. Make the Memory change in the KAE-Memory repository and its own document/migration/test set.
4. Release or pin a compatible API version.
5. Update the Studio client and contract tests.

Do not work around a missing endpoint with direct database access.

## Completion report

At the end of each implementation step, report:

- what now works;
- what was verified and how;
- which parts are mocked or deferred;
- database/API changes and ownership;
- documentation/ADR updates;
- remaining blockers for the vertical slice.

