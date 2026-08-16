# Data Ownership

Status: revised by ADR-0006. **The separate Studio database is a deferred option, not an approved decision.** Physical tables are proposed until migrations land.

## Does Studio need a database at all?

**Open question. Not yet decided.**

ADR-0006 moved durable projects, sessions, and messages to KAE-Memory. What remains Studio-owned is interface state, provider and delivery configuration, projection caches, and publication orchestration. That may not justify a CockroachDB database.

Some of it may live in AWS-managed configuration and storage; some is browser-local; some is genuinely transient. Projection caches are rebuildable by definition, and publication records are recorded in Memory (ADR-0003) with Studio holding only the in-flight operation.

**Decide this after Studio's actual persistence requirements are known — not before.** Provisioning a database first will invent durable state to fill it.

### If a Studio database is needed

The prior recommendation stands as the *deployment option*, not as an approved requirement:

| Database | Owner | Access rule |
| --- | --- | --- |
| `kae_studio` | KAE-Studio | Studio migrates and reads/writes it |
| `kae_memory` | KAE-Memory | Memory migrates and reads/writes it |

One cluster, separate logical databases, separate users. Studio's runtime role has no write grant on `kae_memory`. This keeps repository ownership matched to a database boundary while retaining one managed cluster.

The isolation rule survives regardless of where Studio's state lands: **Studio never holds credentials that can write `kae_memory`.**

## Proposed Studio schemas

Only if the question above resolves in favour of a database. Implement nothing here speculatively.

### `app`

- `app.project_settings` (provider selection, interview configuration, preferences)
- `app.users` (later)
- `app.project_members` (later)

`app.projects` and `app.project_memory_links` are **removed**: a Studio project is a Memory project (ADR-0006), so there is nothing to link.

### `conversation`

**Removed entirely by ADR-0006.** Sessions, messages, and attachments are KAE-Memory's. Interview *state* — asked, answered, deferred, superseded — is also Memory's (capability-matrix section B), because an MCP agent must see the same discovery state as Studio.

What remains is transient and need not be durable: unsent composer drafts and a pending-send buffer for when Memory is unreachable. If that buffer is persisted at all, it is cleared on acknowledgement and never read as project history.

### `projection` (only if a cache proves necessary)

- `projection.model_snapshots` (cached project-model projection, with the Memory revision it reflects)
- `projection.module_views`
- `projection.cache_invalidations`

Everything here is a cache. It must be rebuildable from Memory and must never be treated
as authoritative. In particular, Doc 17's project-state manifest is Memory-owned and is
not a Studio `projection.model_snapshots` row with a stronger name.

### `delivery`

- `delivery.artifacts`
- `delivery.artifact_versions`
- `delivery.generation_requests`
- `delivery.package_manifests`
- `delivery.exports`
- `delivery.artifact_targets` (per-project `ArtifactTarget`; references, not credentials)
- `delivery.publications` (target, version, content hash, state, actor, timestamp)
- `delivery.workspace_registrations` (local agent workspaces, by `workspaceId`)

### `operations`

- `operations.jobs`
- `operations.job_attempts`
- `operations.outbox_events`
- `operations.provider_usage`
- `operations.audit_events`

Do not create these tables merely to match the list. Implement only those needed by the first vertical slice, then add migrations incrementally.

## The project model lives in Memory

Under ADR-0002, the structured project model — objectives, stakeholders, workflows, modules, requirements, interfaces, data entities, decisions, risks, phases, action items, and the typed relationships between them — is **KAE-Memory-owned knowledge**. It is precisely what Memory provides: versioned statements, provenance to immutable evidence, confirmation status, contradiction detection, and readiness.

Studio does not keep a second authoritative copy. A user editing a requirement or accepting a proposed module decomposition does not `UPDATE` a Studio row: Studio records the edit as evidence and issues a revision request to Memory, then re-projects the view.

Studio may cache projections for display and generation. A cache must be rebuildable from a Memory revision and must record which revision it reflects.

## Ownership mapping

| Information | Authoritative owner | Notes |
| --- | --- | --- |
| Project identity and name | Memory | ADR-0006. Studio holds display preferences, not the project record |
| Session and ordered messages | Memory | ADR-0006. Studio submits through the API and reads back |
| Unsent draft, pending-send buffer | Studio | Transient. Cleared on acknowledgement; never project history |
| Uploaded document/transcript | Studio storage + Memory evidence | Studio stores the bytes; Memory holds the immutable evidence record |
| Message or document used as source | Memory evidence | Created idempotently with the Studio source reference |
| Requirement, objective, decision, risk | Memory | Versioned knowledge with provenance and status |
| Module definition and specification | Memory | A first-class knowledge node (`MOD-`), not a Studio table |
| Module decomposition choice | Memory | The user's accept/split/merge is a confirmed decision with provenance |
| Relationships between model nodes | Memory | Typed edges are knowledge, not Studio-side inference |
| Interface and data-entity ownership | Memory | Including the single-owner invariants |
| Readiness per module/dimension | Memory | Studio presents it; Studio must not recompute the rules |
| Attention, findings, conflicts, gaps | Memory | Studio renders material human work in Attention; pipeline health in diagnostics |
| Project-state manifest | Memory | Logical, versioned projection; Studio may cache it with its revision and completeness state |
| Requirements/Modules/Interfaces pages | Studio projection | Derived from a Memory revision; cacheable and rebuildable |
| Interview question state | Memory | Asked, answered, deferred, superseded — durable, and shared with MCP clients |
| Active interview type, phrasing, presentation | Studio | Interaction concern |
| Context package artifact | Studio delivery | Versioned, pinned to an exact Memory revision |
| Artifact target configuration | Studio | Per-project `ArtifactTarget`; credentials are never in project rows |
| Publication act (commit, file write, upload) | Studio delivery | Memory records that it happened, not how |
| Publication record | Memory | What was published, from which revision, where, content hash |
| Large artifact bytes | Object storage | SQL stores metadata, checksum, URI/key, status, and source revision |
| AI-provider usage | Studio operations | Provider-specific billing/telemetry for Studio calls |
| Memory run/lease state | Memory operations | Remains internal to Memory |

## Lifecycle distinctions

### Conversation

Preserve user and assistant turns as the interaction record. Messages may be edited only through explicit product semantics; source evidence must preserve what was actually submitted.

### Evidence

Evidence is immutable and traceable. A corrected later message creates new evidence; it does not erase the earlier statement.

### Knowledge

Knowledge is revisable. It can be proposed, confirmed, contradicted, superseded, or invalidated according to KAE-Memory rules.

### Artifact

Artifacts are immutable versions. Regeneration creates a new artifact version associated with the exact Memory revision and generator configuration.

## Transaction boundary

No distributed transaction spans Studio and Memory.

Under ADR-0006 the message is written **to Memory**, not to Studio. Studio holds the message in a transient send buffer only until Memory acknowledges it, submits with an idempotency key, and clears the buffer on success. Retry must be safe — which requires the idempotent-ingestion gap to be closed.

The test that the boundary is intact: **if Studio's store were deleted after every message is acknowledged, no project history is lost.**

## Example

User message:

> Ministry leaders submit monthly reports. Publication requires approval, but we have not decided who approves.

Possible records:

1. Studio submits the message through the Memory API; Memory stores one `MessageRow`.
2. Memory stores one immutable evidence record linked to that message.
3. Memory may derive a user role, a monthly-submission requirement, an approval requirement, and an open decision.
4. Studio renders those conclusions in its Requirements view.
5. A generated context artifact cites the relevant Memory revision and trace references.

## Security boundary

- Provider secrets should be stored through the deployment's secret mechanism, not plaintext project rows.
- Logs must exclude provider keys and confidential attachment contents by default.
- Every Memory request must be project/tenant scoped.
- Object-storage access should use short-lived or server-mediated access rather than permanent public links.
- Publishing credentials (GitHub tokens, AWS credentials) live in the server or installed-agent environment, never in the frontend and never in project rows.
- Local filesystem paths are never stored server-side as reachable targets; a `workspaceId` is resolved to a path by the local agent, which enforces its own approved-root restriction.
