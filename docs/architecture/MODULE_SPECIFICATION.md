# Module Specification

Status: approved direction. Defines the canonical shape of a module — the unit a developer or coding agent implements from.

## Why modules are first-class

The purpose of KAE-Studio is to reach a state where implementation can begin on any part of the system without the implementer inventing missing requirements. That is only achievable if the system is decomposed and each part is specified to a defined completeness standard.

A module is therefore an object in the project model (`MOD-`), not a heading in a document.

## Decomposition

**Studio proposes; the user curates.**

Studio derives a candidate decomposition from workflows, actors, data ownership, and integration boundaries, and presents it with rationale. The user may accept, rename, split, merge, reject, or add modules. Every such action is recorded as a decision with provenance, so the decomposition is reviewable and versioned like any other knowledge.

Decomposition heuristics Studio should apply and be able to explain:

- one authoritative owner per data entity;
- a boundary where a business workflow crosses responsibility or system ownership;
- a boundary at an external integration;
- a boundary where security or compliance obligations differ;
- cohesion of responsibilities over minimal module count;
- avoidance of `depends_on` cycles.

The user may also declare a module directly at any time; Studio then conducts discovery to complete it.

## Canonical module specification

Every module resolves to this shape. Sections with no content are rendered as explicit gaps, never omitted silently.

### Identity

`module_id`, stable key (`MOD-APR`), name, one-line purpose, owning delivery phase, status, readiness by dimension.

### Purpose

One paragraph stating why the module exists in business terms.

### Responsibilities

What the module is accountable for. Also **non-responsibilities** where confusion is likely, naming the module that does own them.

### Inputs and outputs

The information the module receives and produces, in domain terms, before protocol detail.

### Functional requirements

Identified (`FR-APR-001`), testable, each `satisfies` at least one customer requirement or objective, each `verified_by` at least one acceptance test.

### Interfaces

Exposed and consumed, each with an owner, protocol, synchronicity, authentication, payload shape, error semantics, versioning guarantee, and volume expectation. Detailed contract shape is defined in `../product/DISCOVERY_INTERVIEWS.md` (integration interview) and rendered in `interfaces/` in the package.

### Data

Entities owned, entities read from other modules, retention and privacy classification.

### Dependencies

Other modules and external systems, each with the reason and the nature of the dependency (runtime, build, data, operational).

### Business rules

Invariants and policies, stated so they can be tested.

### Failure behavior

What happens when a dependency is unavailable, a call times out, or authorization cannot be verified. Which failures are safe to retry, who owns retry, and what remains valid when a downstream step fails.

### Security and permissions

Who may perform each operation, what is audited, what is confidential.

### Acceptance criteria

Verifiable conditions (`AT-`), including negative cases.

### Open decisions

Unresolved questions (`OD-`) that block readiness, each with why it matters and who should decide.

### Implementation readiness

Per dimension: requirements, interfaces, data model, security, operations, acceptance tests, UI. Values: complete, draft, incomplete, blocked, not applicable.

## Worked example

The normative example for this repository. A generated module document should read like this.

```text
Module: Report Approval   (MOD-APR)

Purpose
    Ensure submitted reports are reviewed and approved before publication.

Responsibilities
    Receive submitted reports.
    Determine the authorized approver.
    Record approval or rejection.
    Prevent premature publication.
    Preserve the approval history.

Non-responsibilities
    Report authoring and versioning        -> MOD-RPT (Report Management)
    Delivering notifications               -> MOD-NTF (Notification Service)
    Making a report publicly visible       -> MOD-PUB (Publication)

Inputs
    Submitted report ID
    Submitter identity
    Organization / ministry
    Current report version

Outputs
    Approval decision
    Review comments
    Approval timestamp
    Publication eligibility

Functional requirements
    FR-APR-001  Only authorized approvers may approve reports.
    FR-APR-002  Reports cannot be published before approval.
    FR-APR-003  Rejected reports return to the submitter for revision.

Dependencies
    MOD-IAM  Identity and Access Management   (approver authorization)
    MOD-RPT  Report Management                (report state and versions)
    MOD-NTF  Notification Service             (decision notification)
    MOD-PUB  Publication                      (eligibility gate)
    MOD-AUD  Audit Service                    (approval history)

Business rules
    BR-APR-01  The submitter cannot approve their own report.
    BR-APR-02  Approval applies to a specific report version.
    BR-APR-03  Editing an approved report invalidates the prior approval.

Failure behavior
    If notification fails, the decision remains valid and notification is retried.
    If authorization cannot be verified, approval is rejected safely.

Acceptance criteria
    AT-031  Unauthorized users cannot approve a report.
    AT-032  Publication remains blocked while approval is pending.
    AT-033  Approval history identifies the approver, time, and report version.

Open decisions
    OD-011  Which role initially acts as approver?
    OD-012  Is one approval sufficient?
    OD-013  Can administrators override rejection?

Implementation readiness
    Requirements      complete
    Interfaces        incomplete
    Data model        complete
    Security          incomplete
    Acceptance tests  draft
```

Note what the example demonstrates and what a generated specification must preserve:

- open decisions are **retained as open**, not resolved by AI guess;
- readiness is honest and per-dimension, so the module is visibly not yet safe to implement;
- dependencies name the reason, not just the module;
- failure behavior distinguishes what stays valid from what fails safe.

## Minimum module capability contract

**Adding `module` to `KnowledgeKind` does not make modules first-class.** A kind value gives a module a label and nothing else — no identity guarantees, no edges, no readiness, no decomposition history. Treating the enum extension as "module support" would ship a module concept that cannot answer any of the questions the product exists to answer.

KAE-Memory should not consider module support complete until all of the following hold. This is the contract to agree *before* implementation, not to discover during it.

| # | Capability | Why it is required |
| --- | --- | --- |
| 1 | **Stable module identity** | `MOD-APR` appears in packages, commits, tickets, and agent context. It must survive revision, rename, and supersession. |
| 2 | **Module lifecycle** | Proposed, confirmed, contested, superseded, rejected, deferred — as for any knowledge. |
| 3 | **Project membership** | A module belongs to exactly one project, and that is queryable. |
| 4 | **Relationship operations** | Create, delete, and query `depends_on`, `owns`, `exposes`, `consumes`, `satisfies`, `verified_by`. Without a write path, modules have no structure. |
| 5 | **Traversal** | Transitive dependencies, dependents, and blocked-by chains. Build order is otherwise underivable. |
| 6 | **Readiness at module scope** | Per-dimension. The product's central claim — one module ready inside an incomplete project — is unexpressible without it. |
| 7 | **Decomposition decisions** | Accept, rename, split, merge, reject recorded as versioned decisions with provenance, so the boundary choice is reviewable. |
| 8 | **Split and merge semantics** | What happens to requirements, edges, and readiness when a module divides or combines. Undefined here means silent data loss. |
| 9 | **Invariant findings** | Dependency cycles, unowned or multiply-owned data, requirements with no verifying test — reported, not silently repaired. |
| 10 | **Bounded context assembly** | Scoped to one module, pinned to a revision, with trace references. |

Items 4, 5, 6, and 10 are the structural gaps in `../planning/CAPABILITY_MATRIX.md`. Items 7 and 8 are additional and were not previously identified — decomposition is a *decision*, and split/merge is where an unspecified implementation quietly destroys requirements.

A useful intermediate state exists: items 1–5 give modules with structure but no readiness, enough to render the Modules view and derive build order. That is a legitimate milestone. It is not "module support complete."

## Bounded module context

A user can request a package scoped to one module. It contains the module specification plus everything needed to implement it without reading the whole project: the objectives and customer requirements it satisfies, the interfaces it exposes and consumes with their contracts, the data entities it owns and reads, its screens, its acceptance tests, the decisions and constraints that bind it, and stub summaries of the modules it depends on.

It must also carry its unresolved open decisions and its readiness, so an agent given the package cannot mistake an unknown for a settled fact.

## Guardrails

- Never fabricate an open decision into a resolved one to make a module look ready.
- Never emit a module specification without its readiness block.
- Never let a module own data another module also owns.
- A dependency cycle is reported, not quietly broken.
- A module whose requirements are largely `proposed` rather than `confirmed` must say so in its generated document.
