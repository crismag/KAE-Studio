# Product Vision

Status: approved direction. Supersedes the earlier "guided requirements chat" framing.

## Product statement

KAE-Studio is an AI-assisted **software definition and context-engineering platform**. It turns discussions, documents, customer inputs, technical constraints, and incomplete ideas into a complete, traceable, implementation-ready project definition, then generates module-level development context for humans and AI coding agents.

The chat is the intake mechanism. **The structured project definition is the product.**

KAE-Memory makes that definition durable, traceable, revisable, and reusable across every stage of the project's life.

## What it is for

In normal software development, the information that determines what gets built is scattered across customer discovery meetings, requirements workshops, integration discussions, architecture reviews, project-management planning, engineering conversations, emails, notes, diagrams, existing documents, vendor and API documentation, security and deployment discussions, and decisions made mid-implementation.

Summarizing that material is not the problem. The problem is that its conclusions must become:

explicit; categorized; connected; reviewed; traceable; versioned; assigned; testable; and usable by developers.

KAE-Studio converts scattered material into an **engineering definition system**.

## Positioning

> KAE-Studio helps you determine precisely what should be built, why, how the parts relate, and whether each part is ready to implement.

This is deliberately not an AI coding environment. Tools such as Kiro help a user build software inside a development environment. KAE-Studio operates **before** development begins and **continues managing decisions as the project evolves**. KAE-Memory ensures the definition survives.

## The product sequence

```text
Understand -> Define -> Decompose -> Connect -> Review -> Approve -> Package -> Develop -> Retain changes
```

Every screen, contract, and deliverable in this document set exists to serve one of those stages. Work does not end at Package: implementation produces new decisions, and those return to Memory.

## The promise

> Bring whatever you already have — an idea, a proposal, a transcript, a repository, a pile of notes. KAE-Studio interviews you the way an analyst, architect, and integration lead would, builds a structured project definition with every module fully specified and connected, shows you what is still unresolved, and publishes an implementation-ready context package to your repository, workspace, or managed storage.

## Primary users

- **The builder (user #1).** An engineer preparing their own projects for assisted implementation, who wants ambiguity closed before coding starts and consistent context supplied to coding agents.
- A consultant or architect converting discovery conversations into structured engineering deliverables.
- A product owner or business analyst gathering requirements across multiple sessions, meetings, and sources.
- A founder or domain expert with an idea and no complete specification.
- Later, a delivery team needing a shared, reviewable, traceable definition of record.

## Core jobs

1. Ingest whatever material already exists and establish an initial project understanding.
2. Conduct **typed engineering interviews** — product, integration, data, security, deployment, architecture, acceptance — not one generic requirements chat.
3. Build a structured project model: vision, stakeholders, scope, workflows, modules, interfaces, decisions, risks, phases, action items.
4. **Decompose the system into modules** and specify each one to the point where it can be implemented.
5. Maintain **relationships**, not lists: which customer requirement a functional requirement satisfies, which module implements it, what that module depends on, which tests verify it, which decision constrains it.
6. Expose gaps, contradictions, and unresolved decisions, and make them reviewable and approvable.
7. Define the application's screens before implementation where applicable.
8. Generate and publish versioned context packages — whole-project or bounded to one module — to GitHub, a local workspace, or managed storage.
9. Retain changes made during development so the definition stays true rather than becoming stale.

## Experience principles

### Conversation is the front door, not the building

The Workspace is where material arrives and discovery happens. Value accumulates in the structured views: Project Definition, Modules, Requirements, Interfaces, Architecture, Dependencies, Plan, Reviews.

### Modules are first-class

A module is not a heading in a document. It is an object with responsibilities, inputs, outputs, requirements, dependencies, business rules, failure behavior, acceptance criteria, open decisions, and per-dimension implementation readiness. See `architecture/MODULE_SPECIFICATION.md`.

### The AI proposes; the user curates

Studio proposes the module decomposition, the requirement relationships, and the specifications. The user accepts, edits, splits, merges, or rejects. Decomposition is a reviewable, versioned decision with provenance — never a silent AI assertion.

### Structure emerges visibly

Views fill as discovery progresses. Users inspect and correct conclusions conversationally without hand-filing every extracted sentence.

### Memory is trustworthy and mostly invisible

Evidence, revisions, confirmation, retrieval, and provenance support the experience and are available when trust or debugging matters. They are not the everyday workflow.

### Readiness is per-dimension and honest

"Requirements complete, interfaces incomplete, security incomplete" is useful. An unexplained percentage is not. Readiness governs whether a module is safe to hand to implementation.

### Generation is one thing; publication is another

An artifact bundle is generated once from a pinned Memory revision. The destination — GitHub branch or draft PR, an approved local workspace via an installed agent, or managed S3 storage — does not change the meaning or structure of what was generated. See `delivery/ARTIFACT_PUBLISHING.md`.

## Outputs

The deliverable is a versioned context package. Its canonical structure is defined in `delivery/CONTEXT_PACKAGE.md` and covers product, requirements, modules, architecture, interfaces, UI, planning, testing, decisions, and agent-directed context. Users can generate the whole package or a bounded package for a single module.

## Path to product

**Internal first.** KAE-Studio is initially a private development accelerator: prepare projects, force ambiguity closed before coding, supply Claude or Codex with consistent context, resume projects without reconstructing decisions, stop coding agents from inventing missing requirements, and generate module-specific implementation prompts.

That internal use is the validation path. If it consistently produces faster and better implementations, the sellable capabilities become identifiable rather than speculative.

**SaaS later** may add team workspaces, meeting ingestion, customer collaboration, review and approval workflows, requirements baselines, Jira/GitHub/Linear/Confluence integration, reusable interview templates, industry requirement packs, change-impact analysis, audit and compliance reporting, and private or on-premise deployment.

Architectural rule: build single-tenant and pragmatic now, but take no decision that makes multi-tenancy, team review, or on-premise deployment a rewrite.

## Non-goals

### Permanent non-goals

- Being an AI coding environment or IDE.
- Executing multi-agent implementation of the software being defined.
- Rebuilding KAE-Memory's engine inside Studio.
- Owning memory semantics — extraction, revision, provenance, readiness rules, and retrieval remain Memory's.

### Deferred beyond the first slice

Scope for the first demonstrable slice is set in `planning/VERTICAL_SLICE.md`, not here. Deferring is a sequencing decision; it does not remove a capability from the product.

- Meeting-recording ingestion and transcription.
- Repository ingestion and codebase analysis of an existing system.
- Generated visual wireframes and interactive prototypes (screen *specifications* are in scope earlier).
- Team accounts, roles, approvals by multiple parties, billing.
- Change-impact analysis across baselines.
- Issue-tracker synchronization.

## Success signal

**Internal:** a real project of the user's is defined in KAE-Studio, published to its repository, implemented from that context, and the resulting implementation needed materially fewer invented or re-litigated requirements than the same work done without it.

**Product:** a new user opens Studio, understands what to do without an explanation of evidence, knowledge areas, revisions, or agent runs, and after a working session recognizes the module-level project definition as their own and better than what they would have written.
