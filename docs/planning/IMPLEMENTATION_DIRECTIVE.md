# Implementation Directive for Claude

Status: execution prompt.

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
5. Studio-owned physical schema proposal (Studio owns conversation, projections, delivery — not the project model).
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

### Phase 0: Baseline

- Record current state and existing constraints.
- Define local run contract for Studio plus Memory.
- Establish configuration boundaries and secret handling.

### Phase 1: Studio shell

- Scaffold only what the chosen stack needs.
- Make Workspace the default project view.
- Add Requirements, Deliverables, and Project Health destinations.
- Mark future destinations honestly.

### Phase 2: Conversation

- Add Studio-owned project/session/message persistence.
- Add one AI-provider interface and adapter.
- Implement summary plus focused next-question behavior.
- Add durable retry/failure states.

### Phase 3: Memory client

- Implement a typed/versioned KAE-Memory client.
- Create/link projects.
- Submit evidence idempotently.
- Poll or consume durable run completion.
- Retrieve project briefing, knowledge, readiness, and findings.

### Phase 4: Projection and health

- Render evolving requirements in human-readable sections.
- Surface unresolved decisions and meaningful gaps.
- Make provenance accessible on demand, not primary.

### Phase 4b: Modules

- Propose a module decomposition with rationale; let the user accept, split, merge, rename, or reject.
- Record every curation action as a versioned decision with provenance.
- Render the canonical module specification and per-dimension readiness.
- Surface graph invariant violations (cycles, unowned data, untested requirements) in Reviews.

### Phase 5: Artifact and resume

- Generate a versioned context package tied to an exact Memory revision, whole-project or bounded to one module.
- Implement one publisher properly rather than three shallowly; keep the `ArtifactPublisher` interface intact for the others.
- Show proposed changes before writing; detect conflicts; never overwrite silently.
- Store artifact and publication metadata, including content hash and source revision.
- Resume from retained project context without repeating answered questions.

### Phase 6: Retain changes

- Accept decisions and changes discovered during implementation as new evidence.
- Mark artifacts generated from superseded revisions as outdated.
- Support regeneration as a diff against what is already published.

## Testing expectations

- Unit-test interview state and provider boundary behavior.
- Integration-test Studio database migrations and message/outbox durability.
- Contract-test the Memory client against the actual API schemas.
- Verify idempotent retries.
- Verify correction and provenance behavior end to end.
- Verify artifact revision pinning.
- Provide a deterministic provider fixture for tests without presenting it as the production AI experience.

## Scope note

This directive predates ADR-0002 and ADR-0003 in places. Where it conflicts with `../architecture/PROJECT_MODEL.md`, `../architecture/MODULE_SPECIFICATION.md`, or `../delivery/`, those documents govern. `VERTICAL_SLICE.md` requires re-scoping before Phase 1 begins.

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

- Add only Studio-owned migrations to this repository.
- Target `kae_studio`; do not create or modify `kae_memory` objects here.
- Use an outbox/pending-action pattern for message-to-evidence synchronization.
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

