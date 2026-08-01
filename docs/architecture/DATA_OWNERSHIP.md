# Data Ownership

Status: approved direction; physical tables are proposed until migrations land.

## Database recommendation

Use one CockroachDB cluster with two logical databases:

| Database | Owner | Access rule |
| --- | --- | --- |
| `kae_studio` | KAE-Studio | Studio migrates and reads/writes it |
| `kae_memory` | KAE-Memory | Memory migrates and reads/writes it |

Use separate database users/roles. Studio's runtime role has no write grant on `kae_memory`. KAE-Memory does not query Studio conversation tables.

This is preferable to renaming existing KAE-Memory tables into new schemas during the product split. It gives repository ownership a matching database boundary while retaining one managed cluster for cost and operations.

## Proposed Studio schemas

### `app`

- `app.projects`
- `app.project_memory_links`
- `app.project_settings`
- `app.users` (later)
- `app.project_members` (later)

### `conversation`

- `conversation.sessions`
- `conversation.messages`
- `conversation.attachments`
- `conversation.interview_states`
- `conversation.pending_actions`

### `projection`

- `projection.model_snapshots` (cached project-model projection, with the Memory revision it reflects)
- `projection.module_views`
- `projection.cache_invalidations`

Everything here is a cache. It must be rebuildable from Memory and must never be treated as authoritative.

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
| Project display name | Studio | Memory may receive descriptive metadata but does not own product presentation |
| Chat message | Studio | Ordered user/assistant interaction record |
| Uploaded document/transcript | Studio storage + Memory evidence | Studio stores the file; Memory holds the immutable evidence record |
| Message or document used as source | Memory evidence | Created idempotently with the Studio source reference |
| Requirement, objective, decision, risk | Memory | Versioned knowledge with provenance and status |
| Module definition and specification | Memory | A first-class knowledge node (`MOD-`), not a Studio table |
| Module decomposition choice | Memory | The user's accept/split/merge is a confirmed decision with provenance |
| Relationships between model nodes | Memory | Typed edges are knowledge, not Studio-side inference |
| Interface and data-entity ownership | Memory | Including the single-owner invariants |
| Readiness per module/dimension | Memory | Studio presents it; Studio must not recompute the rules |
| Findings, conflicts, gaps | Memory | Studio renders them in the Reviews view |
| Requirements/Modules/Interfaces pages | Studio projection | Derived from a Memory revision; cacheable and rebuildable |
| Interview type and question state | Studio | Asked, answered, deferred, superseded; which interview is active |
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

Studio writes the message and an outbox/pending synchronization record in one Studio transaction. A worker or application operation submits it to Memory with an idempotency key, then records the returned evidence/run references. Retry must be safe.

## Example

User message:

> Ministry leaders submit monthly reports. Publication requires approval, but we have not decided who approves.

Possible records:

1. Studio stores one `conversation.messages` row.
2. Memory stores one immutable evidence record linked to the Studio message source reference.
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

