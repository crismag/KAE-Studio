# ADR-0001: Separate KAE-Studio from KAE-Memory

- Status: Accepted direction
- Date: 2026-07-31

## Context

KAE-Memory currently demonstrates evidence capture, extraction, knowledge confirmation, area assignment, readiness, review, run inspection, and blueprint generation. Its local UI exposes these engine concepts directly.

That interface is useful for verifying and debugging the memory engine, but it does not clearly guide an end user through software discovery and definition. The domain model began driving the product workflow instead of supporting it.

The intended end product is a conversational engineering workspace. A user should be able to describe an idea, answer guided questions, inspect an evolving project definition, and export implementation-ready context without managing memory taxonomy.

## Decision

Create KAE-Studio as a separate repository and product-facing application.

- KAE-Studio owns the conversational workspace, interview workflow, visible project models, provider integration, and deliverables.
- KAE-Memory remains an independently testable persistent engineering-memory service.
- Studio consumes Memory through a versioned API/client boundary.
- The existing KAE-Memory UI remains diagnostics/admin tooling unless later product research justifies exposing selected capabilities.
- The initial deployment may use one CockroachDB cluster, but Studio and Memory use separate logical databases, migration ownership, users, and credentials.

## Consequences

### Positive

- Product design can begin from the user outcome.
- KAE-Memory retains a focused and reusable platform identity.
- UI changes do not force changes to memory persistence.
- Separate database ownership reduces accidental coupling.
- The hackathon story becomes clearer: Studio demonstrates value; Memory and CockroachDB demonstrate durable agentic continuity.

### Costs

- A service contract and client must be maintained.
- Local development must start two components or provide a controlled stub.
- Eventual consistency must be handled explicitly.
- Cross-repository work requires disciplined capability/status tracking.

## Rejected alternatives

### Keep the end-user product inside KAE-Memory

Rejected because product interaction, provider workflow, deliverables, authentication, and future workspace concerns would steadily expand the engine's responsibility.

### Copy Memory domain code into Studio

Rejected because it creates two sources of truth and makes future behavior inconsistent.

### Let both repositories write the same tables

Rejected because the repository split would be cosmetic and physical schema changes would break the product boundary.

### Create separate CockroachDB clusters now

Deferred because one cluster is simpler and cheaper for development and the hackathon. Separate logical databases and roles provide sufficient initial isolation.

## Follow-up decisions

- Studio application stack and repository scaffold.
- Authentication between Studio and Memory.
- Exact API reuse/gap analysis against current KAE-Memory.
- AI-provider abstraction and first supported provider.
- Artifact storage choice and retention policy.

