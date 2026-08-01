# Project Model

Status: approved direction. This is the core asset of the product; every view, contract, and deliverable projects from it.

## Purpose

The project model is the structured, connected, versioned representation of what the project is. Chat transcripts, uploaded documents, and meeting notes are *inputs* to it. Generated artifacts are *projections* of it. Neither is authoritative.

## Structure

```text
Project
├── Vision and objectives
├── Stakeholders and users
├── Scope and exclusions
├── Business workflows
├── Modules
│   ├── Responsibilities
│   ├── Functional requirements
│   ├── Interfaces
│   ├── Data
│   ├── Dependencies
│   ├── Constraints
│   ├── Acceptance criteria
│   └── Open questions
├── Cross-module dependencies
├── Architecture decisions
├── Integration contracts
├── Risks and assumptions
├── Delivery phases
└── Action items
```

## Entities

Each entity has a stable identifier, a status, a human-readable label, provenance to the evidence that produced it, and a revision history.

| Entity | Identifier prefix | Description |
| --- | --- | --- |
| `Project` | — | Root scope. Maps to one Studio project and one Memory project. |
| `Objective` | `OBJ-` | A goal or measurable outcome the project exists to achieve. |
| `Stakeholder` | `STK-` | A person, role, org unit, or external party with an interest or obligation. |
| `Actor` | `ACT-` | A user role or system that interacts with the software. |
| `Workflow` | `WF-` | A business process crossing one or more modules. |
| `Module` | `MOD-` | A bounded unit of the system with its own responsibilities and interfaces. See `MODULE_SPECIFICATION.md`. |
| `CustomerRequirement` | `CR-` | A stated need from a customer, sponsor, or stakeholder, in their terms. |
| `FunctionalRequirement` | `FR-` | A testable behavior the system must exhibit. Scoped to a module. |
| `QualityRequirement` | `QR-` | Performance, availability, usability, maintainability expectations. |
| `IntegrationRequirement` | `IR-` | A requirement on an interaction with an external or internal system. |
| `SecurityRequirement` | `SR-` | Authentication, authorization, confidentiality, audit, compliance. |
| `OperationalRequirement` | `OR-` | Deployment, monitoring, backup, recovery, support expectations. |
| `Interface` | `IF-` | An API, event, file exchange, or UI boundary, with an owning module. |
| `DataEntity` | `DE-` | A durable concept the system stores, with its owning module. |
| `BusinessRule` | `BR-` | An invariant or policy constraining behavior. |
| `Constraint` | `CON-` | An imposed limit: technology, budget, timeline, regulation, legacy. |
| `Assumption` | `ASM-` | Something believed true and not yet verified. Becomes a risk if wrong. |
| `Risk` | `RSK-` | An identified threat to delivery or operation. |
| `Decision` | `ADR-` | An architecture or product decision, with alternatives and consequences. |
| `OpenDecision` | `OD-` | A decision that is required but not yet made. Blocks readiness. |
| `AcceptanceTest` | `AT-` | A verifiable condition proving a requirement is satisfied. |
| `Screen` | `SCR-` | A user interface screen specification. See `../product/UI_DEFINITION.md`. |
| `DeliveryPhase` | `PH-` | An ordered stage of implementation. |
| `WorkPackage` | `WP-` | A unit of implementable work, normally scoped to one module and phase. |
| `ActionItem` | `AI-` | A task assigned to a human, usually to resolve an open decision or gap. |

Identifiers are stable for the life of the project and appear in generated artifacts, so they can be cited in code, commits, tickets, and conversations.

## Relationships

Requirements are not a list. The model's value is in its edges.

```text
Customer requirement CR-014
    ↓ satisfied by
Functional requirements FR-APR-001 and FR-APR-002
    ↓ implemented by
Approval Module (MOD-APR)
    ↓ depends on
Identity Module and Report Module
    ↓ verified by
Acceptance tests AT-031 through AT-036
    ↓ constrained by
Security decision ADR-007
```

### Relationship types

| Edge | From → To | Meaning |
| --- | --- | --- |
| `satisfies` | FR/QR/IR/SR/OR → CR/OBJ | This requirement exists to meet that need. |
| `implemented_by` | FR → Module | This module is responsible for the behavior. |
| `depends_on` | Module → Module | Runtime or build dependency. Must be acyclic for build ordering. |
| `exposes` | Module → Interface | The module owns and publishes this interface. |
| `consumes` | Module → Interface | The module calls or subscribes to this interface. |
| `owns_data` | Module → DataEntity | Authoritative owner of the data. Exactly one owner per entity. |
| `verified_by` | FR/QR/IR/SR → AcceptanceTest | Evidence the requirement is met. |
| `constrained_by` | any → Decision/Constraint/BusinessRule | A limit on how this may be realized. |
| `blocked_by` | any → OpenDecision | Cannot be considered ready until resolved. |
| `realized_by` | Workflow → Module/Screen | Where a business process is carried out. |
| `refines` | requirement → requirement | A more specific statement of a broader one. |
| `conflicts_with` | any ↔ any | Detected contradiction requiring review. |
| `supersedes` | revision → revision | Corrective replacement, original retained. |
| `traces_to` | any → Evidence | Provenance. Every node has at least one. |
| `scheduled_in` | WorkPackage → DeliveryPhase | Delivery sequencing. |

### Graph invariants

Studio surfaces violations in the Reviews view rather than silently repairing them.

- Every `FunctionalRequirement` is `implemented_by` exactly one module.
- Every `DataEntity` has exactly one `owns_data` owner.
- Every `Interface` has exactly one `exposes` owner; consumers may be many.
- `depends_on` contains no cycles. A cycle is a finding, and it blocks dependency-ordered planning.
- Every node has at least one `traces_to` edge. A node with no evidence is an AI assertion and must be marked as such until confirmed.
- Every `CustomerRequirement` is `satisfied_by` at least one requirement, or is explicitly marked out of scope.
- Every requirement intended for delivery is `verified_by` at least one acceptance test.

## Ownership

The project model is **KAE-Memory-owned knowledge**. It is exactly what Memory exists for: versioned statements, typed relationships, provenance to immutable evidence, confirmation status, contradiction detection, and readiness computation.

KAE-Studio does not maintain a second authoritative copy. Studio owns:

- conversation, uploads, and interview state;
- projections and caches of the model for display;
- user edits, expressed as new evidence and revision requests to Memory;
- delivery — generation and publication of artifacts.

The consequence: a user editing a requirement in the Modules view does not `UPDATE` a Studio row. Studio records the edit as evidence and asks Memory to revise the knowledge with provenance. The view then re-projects. See `DATA_OWNERSHIP.md`.

## Status lifecycle

Every node carries a status:

- **proposed** — the AI derived it; no human has confirmed it.
- **confirmed** — a user accepted it.
- **contested** — a conflict or contradiction has been detected.
- **superseded** — replaced by a later revision; retained for trace.
- **rejected** — explicitly declined; retained so it is not re-proposed.
- **deferred** — intentionally postponed, with a reason.

Artifacts must render status honestly. A generated module specification built largely from `proposed` nodes is not the same deliverable as one built from `confirmed` nodes, and the package must say so.

## Readiness

Readiness is computed per dimension, per module, by Memory — not recomputed by Studio. Dimensions: requirements, interfaces, data model, security, operations, acceptance tests, UI.

A module is **implementation-ready** when its requirements are confirmed and verified, its owned interfaces and data are specified, its dependencies exist and are acyclic, no `blocked_by` open decision remains, and its acceptance criteria are testable.

## Evolution

The model is not frozen at handoff. Implementation produces new decisions, discovered constraints, and changed requirements. Those return as evidence, revise the model, and mark affected artifacts **outdated**. Retaining that loop is the difference between a definition system and a document generator.
