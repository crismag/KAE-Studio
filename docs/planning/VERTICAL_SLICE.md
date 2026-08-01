# First Studio Vertical Slice

Status: approved target, rewritten 2026-08-01 against the current product definition. **Not implemented by this document.**

Sequencing: this slice begins after **MCP-M1** is demonstrated and the Memory gaps it depends on are closed. See `IMPLEMENTATION_DIRECTIVE.md`.

## Demonstration statement

> A user opens a project, answers one typed discovery interview, watches requirements and open decisions form, accepts a proposed module decomposition, curates one module, sees its dependencies and readiness gaps honestly, generates that module's context package, and publishes it to one target.

The differentiator is **one module defined well enough to implement** — not a project-wide summary. One module is enough for the first slice.

## In scope

1. Open or create a KAE-Memory project from Studio.
2. Workspace with conversation submitted through the Memory API (ADR-0006).
3. One AI-provider adapter behind an interface.
4. One typed discovery interview conducted end to end, chosen for the demonstration project.
5. Requirements and open decisions projected from Memory knowledge.
6. A proposed module decomposition the user can accept, rename, split, merge, or reject — recorded as a versioned decision with provenance.
7. One curated module showing dependencies and per-dimension readiness gaps.
8. Generation of that module's bounded context package, pinned to an exact Memory revision.
9. Publication to **one** target, with proposed changes shown before writing.
10. Resume: reopening the project continues without re-asking answered questions.

## Not in scope

- The full project model. Only what the slice needs.
- Every navigation destination polished.
- All three publishers. One, properly.
- Multiple simultaneous AI providers.
- Meeting ingestion, repository ingestion, visual wireframes.
- Knowledge scopes, organization memory, or the pattern library (ADR-0005 is explicitly later).
- Change-impact analysis.
- Team accounts, approvals by multiple parties, billing.

## Walking-skeleton sequence

**Slice A — Shell.** Workspace as default. Modules, Requirements, Deliverables, Reviews as destinations. Honest placeholders elsewhere.

**Slice B — Conversation through Memory.** Submit messages via the Memory API; render history from Memory. One provider adapter. Summary plus focused next question. Provider failure must not lose the user's message.

**Slice C — Typed interview and projections.** Run one interview type. Project requirements and open decisions from Memory knowledge. Show `proposed` versus `confirmed` honestly.

**Slice D — Modules.** Propose a decomposition with rationale. Curate it. Render one module's canonical specification, its dependencies, and its readiness by dimension.

**Slice E — Package and publish.** Generate the bounded module package from a pinned revision. Show proposed changes. Publish to one target. Detect conflict.

## Acceptance criteria

**AC-01 — Understandable entry.** A new project's Workspace asks what the user wants to build and requires no knowledge-classification vocabulary.

**AC-02 — Typed interview.** The interview asks questions specific to its type, not generic requirements prompts, and does not re-ask what the project model already answers.

**AC-03 — Durable message.** When a provider or Memory call fails, the user's message is preserved in a transient send buffer and presented as retryable. Studio never claims success it did not have. *(Re-expressed for ADR-0006: durability here means "not lost before acknowledgement", not a second durable store.)*

**AC-04 — Idempotent submission.** Retrying the same message does not create duplicate evidence in KAE-Memory.

**AC-05 — Readable projections.** Requirements and modules present project conclusions, not run payloads or database taxonomy.

**AC-06 — Correction with provenance.** A user correction revises the current projection while provenance retains both the original and the corrective evidence.

**AC-07 — Curated decomposition.** The user can accept, rename, split, merge, or reject a proposed module, and the choice is recorded as a versioned decision with provenance — not silently applied.

**AC-08 — Honest readiness.** The module's readiness is shown per dimension, and a module that is not implementation-ready says so. Open decisions appear as open. **No open decision is resolved by AI preference to make the module look complete.**

**AC-09 — Traceable package.** The generated module package records its Memory revision, and every substantive section traces to knowledge and evidence references.

**AC-10 — Reviewed publication.** Proposed changes are shown before anything is written. A changed target produces a conflict, never a silent overwrite. Publication is audited.

**AC-11 — Resume.** Reopening the project summarizes current understanding and chooses a relevant next question without restarting discovery.

**AC-12 — Boundary.** Studio's runtime credentials cannot write `kae_memory` directly; all memory work succeeds only through the Memory API.

## Demonstration scenario

The reporting example, carried forward because it exercises the module boundary cleanly:

> Ministry leaders submit monthly reports. Reports require approval before publication, but the approver role is undecided.

The interview clarifies users, submission, editability, approval, and publication. The decomposition proposes Report Management, Approval Workflow, and Publication. The user curates it. **The Approval Workflow module's package must preserve "which role approves" as an open decision, and its security readiness must show as incomplete** — that is the demonstration's most important moment, because it is where a lesser tool would invent an answer.

## Definition of done

The slice is done when it runs end to end against the target CockroachDB-backed services, with automated tests for the state transitions in AC-03, AC-04, AC-06, AC-07, and AC-10, and a repeatable demonstration script.

A mock provider may be used in tests. The provider used in the demonstration must be identified honestly.
