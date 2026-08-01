# ADR-0002: The project model is the product, and modules are first-class

- Status: Accepted direction
- Date: 2026-08-01
- Supersedes: the first-slice scope framing in ADR-0001 and the original `PRODUCT_VISION.md`

## Context

ADR-0001 separated KAE-Studio from KAE-Memory and framed Studio as a conversational workspace that produces "an initial project context document." The original vision listed detailed module, epic, and task generation as non-goals.

Actual intent is broader and more specific: the product exists to produce a **complete engineering definition before development begins**, of the kind normally reached through customer discovery, requirements workshops, integration discussions, architecture reviews, and PM planning. The value is not a summary document. It is a decomposed, connected, traceable definition in which every module is specified well enough to implement, with dependencies explicit.

A single Markdown export does not carry that. Neither does a flat requirements list — the relationships between customer needs, requirements, modules, dependencies, tests, and decisions are the substance.

## Decision

The **structured project model is the product**. Chat is intake; artifacts are projections.

1. Adopt the project model in `architecture/PROJECT_MODEL.md`: typed nodes with stable identifiers, typed relationships, provenance, status, and revision.
2. Make **modules first-class objects** with a canonical specification and per-dimension implementation readiness (`architecture/MODULE_SPECIFICATION.md`).
3. **Studio proposes decomposition; the user curates.** Decomposition is a versioned, reviewable decision with provenance, not a silent AI assertion. The user may also declare modules directly.
4. Discovery is conducted as **typed engineering interviews** rather than one generic requirements chat (`product/DISCOVERY_INTERVIEWS.md`).
5. **Screen specifications are an output** of the definition, connected to the model (`product/UI_DEFINITION.md`).
6. The project model is **Memory-owned knowledge**. Studio holds projections, conversation, interview state, and delivery. User edits become evidence plus revision requests, never direct writes.
7. Requirement **relationships are part of the contract** with Memory, not a Studio-side inference.

## Consequences

### Positive

- The output is implementable rather than merely readable.
- Traceability is native: any generated statement leads back to evidence and forward to tests.
- Readiness becomes meaningful and per-dimension, so handoff decisions are informed.
- Coding agents receive bounded, honest context, including what is explicitly still unknown.
- KAE-Memory's provenance and revision capabilities become load-bearing rather than incidental.

### Costs

- The Memory API surface grows substantially: typed nodes, typed edges, graph traversal, module readiness. Much of this may not exist in KAE-Memory today and must be verified before implementation.
- More UI surface: Modules, Interfaces, Dependencies, Reviews.
- Graph invariants require detection and presentation of violations rather than silent repair.
- The first vertical slice is larger than the one originally recorded, and must be re-scoped.

## Rejected alternatives

**Keep modules as document sections.** Rejected: without identity, status, dependencies, and readiness, a module cannot be assessed for implementation-readiness or packaged independently.

**Store the project model in Studio.** Rejected: it would duplicate provenance, revision, contradiction detection, and confirmation semantics that KAE-Memory exists to provide, and would create two sources of truth — the outcome ADR-0001 rejected.

**Let the AI decide the decomposition unilaterally.** Rejected: module boundaries are the highest-consequence judgment in the definition. The user must own them, with AI proposal and rationale.

**Resolve open decisions by AI preference to produce complete-looking output.** Rejected: it destroys the product's core claim. An unresolved decision presented as settled is worse than no output.

## Follow-up decisions

- KAE-Memory capability matrix for typed nodes, edges, and traversal (required before implementation).
- Whether module readiness is computed in Memory or requested as a Memory capability addition.
- Identifier allocation scheme and stability guarantees across revisions.
- Conflict presentation and resolution UX in the Reviews view.
