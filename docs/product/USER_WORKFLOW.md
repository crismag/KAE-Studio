# User Workflow

Status: approved direction. Rewritten under ADR-0002 and ADR-0003.

## The sequence

```text
Understand -> Define -> Decompose -> Connect -> Review -> Approve -> Package -> Develop -> Retain changes
```

## Primary journey

### 1. Establish the project

The user begins with whatever already exists: a rough idea, a customer request, a project proposal, a meeting transcript, an existing application, a repository, a specification, an architecture diagram, an integration document, or a collection of notes.

Studio analyzes the available material and establishes an initial project understanding. Everything ingested becomes evidence; everything derived from it is `proposed` until confirmed.

The user also sets, or defers, the project output destination (GitHub, local workspace, or managed download).

### 2. Conduct structured discovery

Studio conducts typed engineering interviews — product discovery, customer requirements, stakeholders, business workflows, integration, data, security and compliance, deployment and operations, architecture decisions, constraints, testing and acceptance, delivery planning — selecting the next question from current gaps rather than a fixed script. See `DISCOVERY_INTERVIEWS.md`.

The user can answer, correct, defer with a reason, ask why a question matters, or change subject. Deferred items return when they start blocking something.

### 3. Build the project definition

The structured project model fills in as discovery progresses: objectives, stakeholders, scope, workflows, modules, requirements, interfaces, data, decisions, risks, phases, action items — with relationships between them. This structure, not the transcript, is the project asset. See `../architecture/PROJECT_MODEL.md`.

### 4. Decompose into modules

Studio proposes a module decomposition with rationale. The user accepts, renames, splits, merges, rejects, or adds modules. Each module then acquires its own specification through targeted discovery, and its own per-dimension readiness. See `../architecture/MODULE_SPECIFICATION.md`.

### 5. Connect and review

Studio maintains relationships — which requirement satisfies which customer need, which module implements it, what it depends on, which tests verify it, which decision constrains it — and surfaces what is wrong: gaps, contradictions, dependency cycles, unowned data, requirements with no tests, screens with no backing interface.

The Reviews view is where the user resolves these and confirms `proposed` knowledge.

### 6. Approve and package

The user generates a context package — whole project, or bounded to one module — pinned to an exact Memory revision. Studio shows proposed contents and changes before anything is written. See `../delivery/CONTEXT_PACKAGE.md`.

### 7. Publish

The package is published to the project's destination: a GitHub branch or draft PR, an approved local workspace via the installed agent, or S3 with controlled download. Publication is reviewed, audited, and never a silent overwrite. See `../delivery/ARTIFACT_PUBLISHING.md`.

### 8. Develop, then retain changes

Implementation proceeds from the published context. Decisions made during development, discovered constraints, and changed requirements return to Studio, revise the model with provenance, and mark affected artifacts **outdated**. The definition stays true rather than becoming stale.

### 9. Resume

On return, Studio retrieves a compact project briefing and continues from unresolved or newly relevant work. It must not restart discovery or re-ask answered questions without explaining why the answer must be revisited.

## Navigation

| Screen | User question it answers |
| --- | --- |
| Workspace | "What are we discussing, and what should I answer next?" |
| Project Definition | "What is this project — vision, stakeholders, scope, workflows?" |
| Modules | "What are the parts, and is each one ready to build?" |
| Requirements | "What must be true — functional, integration, quality, security, operational?" |
| Interfaces | "How do the parts and external systems talk, and who owns what?" |
| Architecture | "How is this designed, and which decisions were made and why?" |
| Dependencies | "What depends on what, and in what order can this be built?" |
| Plan | "What are the phases, work packages, milestones, and action items?" |
| Deliverables | "What can I generate, what is published, and what is now outdated?" |
| Reviews | "What is missing, conflicting, unresolved, or awaiting my approval?" |
| Memory | "Why does the system believe this, and what changed?" |

Workspace remains the default screen and the place conversation happens. Value accumulates in the structured views.

Which of these are functional versus honest placeholders in the first slice is decided in `../planning/VERTICAL_SLICE.md`, not here.

## Corrections

The user should be able to say:

> That is wrong. Only ministry leaders submit reports; staff members can view them.

Studio records the new message, asks Memory to revise the affected knowledge with provenance, and re-projects the affected views. The original statement is retained as evidence; nothing is silently overwritten. Artifacts generated from the superseded revision become outdated.

## Failure behavior

- If the AI provider is unavailable, keep the user's message and offer a safe retry.
- If Memory is temporarily unavailable, preserve the conversation and mark memory synchronization as pending. Do not claim it was remembered.
- If extraction is uncertain, present the conclusion as tentative or ask a clarification.
- If artifact generation fails, preserve the requested source revision so the same generation can be retried deterministically.
- If publication fails or the target has changed, report a conflict with the specific files affected. Never resolve it by overwriting.
