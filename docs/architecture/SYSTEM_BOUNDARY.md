# System Boundary

Status: approved direction. Ownership lists corrected by ADR-0006.

## Component relationship

```mermaid
flowchart TD
    U["User"] --> S["KAE-Studio web"]
    S --> A["KAE-Studio API"]
    A --> P["AI provider"]
    A --> M["KAE-Memory API"]
    A --> D["Studio database"]
    M --> K["Memory database"]
    A --> O["Artifact storage"]
```

## KAE-Studio owns

- Interface state: layout, panels, preferences, unsent composer drafts.
- AI-provider selection, credentials handling, and Studio-specific prompts.
- Interview *presentation*: which type is active, how a question is phrased and shown.
- Requirements, module, architecture, plan, and health projections shown to users — caches, rebuildable from a Memory revision.
- Artifact generation, delivery-target configuration, and publication (GitHub, local workspace, S3).
- Product authentication/authorization when added.
- User-facing failure, retry, and resume behavior, including transient send buffers.

**Studio does not own the durable conversation.** Projects, sessions, and ordered messages are KAE-Memory's (ADR-0006). Studio submits messages through the Memory API and reads them back.

## KAE-Memory owns

- Projects, sessions, and ordered user and assistant messages.
- Immutable evidence accepted from clients.
- Extracted knowledge items and types.
- Knowledge versions, revisions, relationships, and status.
- Provenance from evidence to knowledge.
- Human or authorized confirmation semantics.
- Knowledge-area assignments and readiness calculation.
- Review findings and contradiction/gap detection.
- Semantic retrieval and context assembly.
- Durable memory-agent runs and their state.

## Integration rule

Studio communicates with Memory only through a versioned client/API. The client belongs in Studio, but Memory remains authoritative for memory semantics.

The boundary must support:

- idempotent evidence submission;
- asynchronous processing where needed;
- retrieval scoped by project/tenant;
- explicit memory revision identifiers;
- clear pending, succeeded, partially processed, and failed states;
- traceability references usable in artifacts;
- retry without duplicate evidence.

## Identity

Use UUIDs generated at the owning service.

Studio owns `artifact_id`, `publication_id`, and its delivery-target references. Memory owns `project_id`, `session_id`, `message_id`, `evidence_id`, `knowledge_id`, `revision_id`, and `run_id`.

Under ADR-0006 there is no separate `studio_project_id` to map: a Studio project *is* a Memory project. Studio may hold a local reference for routing and preferences, but the identity is Memory's. Client-supplied idempotency keys remain source references, not Memory primary keys.

## Current KAE-Memory UI

The existing Discovery, Knowledge, Readiness, Review, Runs, and Blueprint screens are not the intended Studio navigation.

They remain valuable as:

- memory diagnostics;
- API and persistence verification;
- provenance inspection;
- run debugging;
- readiness/review validation;
- administrator or power-user tools.

They should stay with KAE-Memory until a deliberate migration decision exists. Studio should not copy them as its starting UI.

## Deployment

For local development, both services may run on the same machine. For the hackathon deployment, both may use the same CockroachDB cluster and shared infrastructure account. These conveniences do not remove the API or ownership boundary.

