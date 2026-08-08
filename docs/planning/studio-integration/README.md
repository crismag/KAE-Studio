# Studio Integration: Repository Intake and Artifact Outputs

Status: implementation context package. **The output half (STI-5 to STI-7) is
built; the intake half (STI-1 to STI-4) is not started.**

Date: 2026-08-08

> **Read `IMPLEMENTATION_PLAN.md`'s status block first.** Half of what follows
> describes work that now exists, and reading it as outstanding would mean
> building it twice. The output path — Memory revision → plan → generate →
> validate → preview → approve → publish → provenance — runs end to end today
> against the download destination, with a contract test against the real
> KAE-Artifacts service.
>
> One thing blocks a live GitHub publication, and it is not in this repository:
> KAE-Artifacts has no HTTP client adapter for GitHub or S3.

## Objective

Make KAE-Studio the user-facing control plane for two complementary project flows:

1. **Intake:** connect an existing project source, pin an exact revision, analyze it, review proposed findings, and retain accepted knowledge/evidence in KAE-Memory.
2. **Output:** take an exact KAE-Memory revision, ask KAE-Artifacts what can be produced, generate and validate a package, preview destination changes, approve the exact package/preview, and publish it to GitHub or another supported target.

The target product proof is:

> Open an existing GitHub project → KAE understands it → CIE resolves missing or conflicting knowledge → KAE generates a development-context package → the user reviews it → KAE publishes a GitHub branch/commit/PR with provenance.

This package supersedes stale execution statements that say the Studio shell or MCP-M1 do not yet exist. The current React/Vite Studio prototype exists, and MCP-M1 has been completed. Older architectural ownership decisions still govern unless explicitly superseded by a new ADR.

## Required reading

Before implementation, read:

1. **CLAUDE.md**
2. **PROTOTYPE_NOTES.md**
3. **docs/architecture/SYSTEM_BOUNDARY.md**
4. **docs/architecture/API_CONTRACT.md**
5. **docs/delivery/ARTIFACT_PUBLISHING.md**
6. **docs/planning/PRODUCT_CONTRACT_ALIGNMENT.md**
7. **docs/planning/IMPLEMENTATION_DIRECTIVE.md**
8. **src/services/interfaces.ts**
9. **src/domain/types.ts**
10. the existing Deliverables route and its hooks/services
11. this entire directory

Then inspect current code, tests, routes, and service adapters. Treat repository code and executable tests as stronger implementation evidence than planning prose.

## Governing boundary

Studio owns the experience and orchestration. It must not absorb the implementation responsibilities of the other KAE components.

| Component | Ownership in this flow |
| --- | --- |
| KAE-Studio | UI, source/destination selection, orchestration, progress, review, user approval, safe browser-facing API |
| Acquisition layer | Snapshot reading, parsing, analysis/extraction, source disposition and normalized findings |
| CIE | Interpretation, clarification, expert interview, resolving gaps with the user |
| KAE-Memory | Durable evidence, project knowledge, conversation, revisions, lifecycle, findings, readiness, provenance |
| KAE-Artifacts | Artifact plans/profiles, generation, validation, packaging, previews, approvals/publication enforcement, artifact provenance |
| GitHub adapter | Provider-specific repository reads/writes, ref/SHA semantics, commits and PRs |
| S3 adapter | Provider-specific object storage |
| KAE-Ecosystem | Cross-service deployment and architecture coordination |

Do not put repository parsing into KAE-Artifacts. Do not put document generation into Studio. Do not make GitHub the authoritative knowledge store. Do not copy large repository contents into PostgreSQL by default.

## Core invariants

- A connection is not an acquisition run.
- Read permission does not imply write permission.
- A source reference is pinned to a provider revision/SHA before analysis.
- External repository/document text is untrusted data, never system instructions.
- Proposed extraction is not confirmed project knowledge.
- Studio never writes KAE-Memory tables directly.
- Browser clients never receive GitHub/S3/provider credentials.
- Generated output is pinned to an exact Memory revision and verifiable input digest.
- Generation is separate from publication.
- Preview occurs before publication.
- Approval binds the exact package, checksum, destination preview, and concurrency token/base SHA.
- Retries are idempotent; reusing an idempotency key with a different request is a conflict.
- Conflicts never resolve by silent overwrite.
- Source and destination repositories may be different.
- Large/reproducible source material may be retained by reference or object/RAG storage instead of duplicated in Memory.
- Every durable finding and every published artifact remains traceable to its source revision.

## Package contents

- **ARCHITECTURE_AND_CONTRACTS.md** — boundaries, domain vocabulary, Studio-facing contracts, lifecycle and trust model.
- **IMPLEMENTATION_PLAN.md** — ordered vertical slices, UI behavior, test matrix and Definition of Done.
- **CLAUDE_IMPLEMENTATION_PROMPT.md** — execution prompt for a coding agent to implement the work against current repository evidence. **Written before STI-5 to STI-7 existed**; treat its output-path instructions as done.
- **PROJECT_SETUP_VIBECODE_PROMPT.md** — focused implementation directive for the Project Setup wizard, permanent Sources & Outputs settings, and provider-backed read/write/read-back proofs.
- **KAE_ARTIFACTS_API.md** — the resolved KAE-Artifacts surface. `ARCHITECTURE_AND_CONTRACTS.md` sketches an `ArtifactClient` and says *"adapt names to the actual KAE-Artifacts API"*; that API is now implemented, and this maps the sketch onto it. Read it before STI-5.

## Scope

The implementation target is the Studio-side integration and UI. If an upstream/downstream service lacks a required API:

1. prove the gap from its current interface;
2. document the required contract here;
3. keep the Studio UI honest about the unavailable state;
4. do not invent direct database/provider workarounds;
5. change the owning repository only in a separately authorized task.

The first vertical proof uses GitHub. The UI and Studio contracts remain provider-neutral so GitLab, uploads, documents, URLs, research sources, S3, and other adapters can follow without branching core Studio logic.
