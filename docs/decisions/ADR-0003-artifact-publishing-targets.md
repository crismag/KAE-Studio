# ADR-0003: Generation is separate from publication; three artifact targets

- Status: Accepted direction
- Date: 2026-08-01

## Context

The context package is the product's output. It must be usable in three materially different situations:

- the user has a GitHub repository for the project;
- the user works locally and wants files written into their workspace (the primary internal use case);
- the user has neither connected, and simply needs the package.

A browser frontend cannot write to arbitrary local directories, and a hosted service cannot reach a developer's filesystem. Meanwhile the artifact itself should be identical regardless of where it lands — otherwise the product acquires three divergent generation paths and three definitions of "the deliverable."

## Decision

**Generate once; publish through a selected target.**

```text
Project memory -> Context assembler -> Artifact generator -> Artifact bundle -> Selected publisher
```

1. One `ArtifactPublisher` interface with `GitHubPublisher`, `LocalWorkspacePublisher`, and `S3Publisher` implementations. The destination does not change the meaning or structure of the artifact.
2. Each project configures an `ArtifactTarget` (see `delivery/ARTIFACT_PUBLISHING.md`). Default proposal: GitHub if connected, else local workspace if an agent is connected, else S3 with controlled download.
3. **GitHub**: propose changes, user reviews, create branch, commit, optionally open a draft PR. Not the default branch without explicit per-project opt-in.
4. **Local**: performed by an installed agent, CLI, IDE extension, MCP tool, or desktop companion — never the browser. The agent restricts writes to an approved root, previews changes, preserves unrelated files, detects existing Git changes, patches rather than overwrites, and reports conflicts.
5. **S3**: stores bytes; CockroachDB stores artifact metadata including content hash, storage target and reference, and source Memory revision. S3 may stage all artifacts but is not authoritative when a repository target is designated.
6. Targets are referenced indirectly: `workspaceId` resolved by the local agent, `bucketAlias` resolved server-side. No raw local paths stored as if the server could reach them.
7. Credentials live in AWS or the installed agent environment, never the frontend.
8. Review precedes publication. Deliverable states are Generated, Reviewed, Published, Outdated, Conflict.
9. Memory records what was generated, from which revision, where it was published, its content hash, and its supporting requirements and evidence — but performs no commits, filesystem writes, or object transfers.

## Consequences

### Positive

- One product model serves both hosted SaaS and installed development agent.
- The internal use case (write into my workspace) and the product use case (open a PR) are the same feature.
- Artifact identity, hashing, and staleness detection are uniform across destinations.
- The security boundary is explicit: the frontend never holds publishing credentials or touches a filesystem.

### Costs

- A local companion agent must be built and distributed for the local target; the browser alone cannot deliver it.
- Update semantics — patching, conflict detection, preserving hand edits — are real work per publisher.
- Three credential and connection flows to design and secure.
- The first slice must choose one target to implement properly rather than all three shallowly.

## Rejected alternatives

**Generate differently per destination.** Rejected: three divergent outputs and no single definition of the deliverable.

**Have the frontend write local files.** Rejected: not possible safely, and would place credentials in the browser.

**Commit directly to the default branch.** Rejected as default: publication is outward-facing and must be reviewable. Available only as explicit per-project opt-in.

**Treat S3 as the authoritative copy always.** Rejected: when a repository is the designated target, the repository is where the project's context actually lives and is consumed.

## Follow-up decisions

- Which publisher the first vertical slice implements.
- Local agent form factor: CLI, MCP server, IDE extension, or desktop companion.
- GitHub connection method: OAuth app, GitHub App, or PAT for internal use.
- Merge and conflict policy when a published file has been edited by hand at the target.
