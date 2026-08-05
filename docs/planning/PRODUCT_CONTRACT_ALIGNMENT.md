# Focus Action — Product Contract Alignment

## Repository ownership

This task belongs to **KAE-Studio**.

KAE-Studio owns product interaction, frontend state, client adapters, interview
orchestration, artifact rendering, and publication execution. KAE-Memory owns
durable project knowledge, conversation, provenance, revisions, lifecycle
rules, readiness, and backend interfaces.

## Outcome

Replace the prototype's aspirational service ports with a deliberate consumer
contract mapped to versioned KAE-Memory HTTP operations and Studio-owned
services. Preserve useful product intent without treating mock behavior as proof
that a backend capability exists.

## Verified starting point

The prototype declares five ports in `src/services/interfaces.ts`:
`ProjectMemoryClient`, `InterviewProvider`, `ProjectProjectionService`,
`ArtifactService`, and `ArtifactPublisher`.

The mock makes all five appear complete. The real KAE-Memory HTTP API does not
currently back many of their methods, while the richer MCP surface is intended
for coding agents rather than the browser product.

The capability matrix and API contract predate major KAE-Memory work and must be
regenerated from current code, routes, tests, and the backend's new interface
readiness context.

## Port disposition

| Port or method | Studio action |
| --- | --- |
| `listProjects`, `getProject`, `submitMessage` | Map to versioned KAE-Memory HTTP contracts. |
| `listMessages(projectId)` | Specify a bounded project-conversation read; do not rebuild authority from browser state. |
| `getInterviewSession` | Define as a Studio projection over Memory sessions/messages unless new durable semantics are approved. |
| `recordModuleDecision` | Keep blocked until Memory has a first-class module/revision contract. |
| `deferDecision` | Define durable meaning with Memory or remove from the production port. |
| `confirmFinding` | Replace with confirmation of underlying knowledge, or approve durable findings before retaining it. |
| `ProjectProjectionService` | Define the consumer projection over briefing/readiness/knowledge endpoints; do not move Memory rules client-side. |
| `ArtifactService.generate` | Separate Memory assembly from Studio rendering. |
| `listDeliverables` | Block on an explicit durable-deliverable decision; assembly UUIDs are not automatically deliverable identity. |
| `ArtifactPublisher` | Keep Studio-owned; credentials and writes execute in a trusted Studio backend or installed agent, never the browser. |
| `InterviewProvider` | Keep Studio-owned and independent of KAE-Memory transport. |

## Work packages

### 1. Regenerate the consumer capability matrix

Audit current KAE-Memory application services, HTTP routes, MCP tools, and tests.
For every Studio need, classify it as available through HTTP, MCP-only and
requiring HTTP, contract-mismatched, a new Memory domain capability,
Studio-owned, or deferred/removed.

Do not infer implementation from ADRs or earlier planning documents.

### 2. Freeze a production port set

Split the prototype interfaces into Memory HTTP client operations, Studio
interview orchestration, Studio projection composition, Studio artifact
rendering, and Studio publication execution.

Remove mock-only convenience methods from the production contract unless their
durable semantics and provider endpoint are approved. Keep mocks conforming to
the frozen contract; do not let mocks define it.

### 3. Define the first integration slice

Use real HTTP for project selection/creation, durable message or document
ingestion, processing-state display, proposal review, readiness and
clarification, and revision-pinned context assembly.

Modules, listable deliverables, and publication may remain visibly blocked until
their separate contracts exist. The UI must distinguish unavailable, queued,
partial, proposed, and complete states.

### 4. Implement the typed Memory client

The client owns HTTP serialization and schema validation, authentication
headers, correlation and idempotency identifiers, bounded retries and timeouts,
pagination, safe error mapping, and API-version compatibility.

Components and hooks consume this client through the service boundary and never
call Memory tables or raw ad hoc routes.

### 5. Keep trust boundaries explicit

- No provider, GitHub, storage, database, or publication credential reaches the
  browser bundle.
- Publishing runs in a trusted Studio backend or approved local agent.
- CORS is not treated as authentication.
- The frontend displays the actual provider/adapter mode honestly.
- Mock mode remains clearly labelled and cannot be mistaken for integration.

### 6. Add consumer contract tests

Test the typed client against real or generated KAE-Memory schemas and a running
Memory service for the vertical slice. Verify idempotent retries, lifecycle and
revision handling, partial states, authentication failures, and compatibility
errors.

## Dependencies tracked separately

- modules, relationship traversal, and module-scoped readiness;
- durable deliverable metadata and staleness;
- publication records in Memory;
- publisher implementations in Studio;
- settings UI;
- non-local deployment and tenancy.

## Required documentation corrections

Update `docs/architecture/API_CONTRACT.md`,
`docs/planning/CAPABILITY_MATRIX.md`, and
`docs/planning/IMPLEMENTATION_DIRECTIVE.md` from current evidence. Remove stale
claims that MCP-M1 or the Studio shell are future prerequisites when they are
already complete.

## Acceptance criteria

- Every production port method has an owner and a real contract or is explicitly
  deferred/removed.
- The first vertical slice no longer depends on deterministic fixture behavior.
- Memory-owned rules are not duplicated in Studio.
- Publisher credentials and execution remain outside the browser.
- Consumer contract tests run against the agreed KAE-Memory HTTP surface.
- Unsupported module/deliverable/publication assumptions are visible as
  dependencies, not presented as implemented.

## First implementation instruction

Regenerate the capability matrix from current KAE-Memory, then produce a
method-by-method disposition for `src/services/interfaces.ts`. Freeze only the
ports needed for project creation through first proposal review before writing
the real HTTP adapter.

## Current disposition artifact

`STUDIO_PORT_DISPOSITION.md` is the first Studio-local disposition of the five
prototype ports. It freezes ownership and first-slice actions without claiming
that unavailable module, deliverable, or publication behavior is backed by
KAE-Memory HTTP. Treat it as the checklist for the next implementation pass,
then refresh it after the KAE-Memory capability audit is rerun against current
code.
