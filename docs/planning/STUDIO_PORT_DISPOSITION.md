# Studio Port Disposition

Status: **historical — the queue below is worked.** This document converted
prototype service ports into an implementation queue during the first
production-contract pass. The live adapters exist and are deployed, so its
unchecked items no longer describe outstanding work; read it for the *port
boundary* it defines, which the live services still honour.

Where it says "keep visible as unavailable until first-class modules exist" or
"replace mock services route-by-route, preserving the prototype badge", that is
done. Current queue: [`PPA_TASKS.md`](PPA_TASKS.md).

## Purpose

`src/services/interfaces.ts` intentionally made the prototype easy to build by
hiding all project data behind five ports. That was useful for a product
prototype, but it is too broad for production: the mock can make unavailable
Memory, module, deliverable, and publication behavior appear finished.

This disposition freezes the ownership and next action for each port before a
real HTTP adapter is introduced.

## Production port groups

| Group | Owner | Production role |
| --- | --- | --- |
| Memory HTTP client | KAE-Memory contract, consumed by Studio | Project/session/message/evidence reads and writes, readiness, findings, revision-pinned assemblies. |
| Interview orchestrator | Studio | Chooses and phrases the next user-facing question using Memory briefing plus provider output. |
| Projection composer | Studio over Memory reads | Converts Memory-owned facts into route-specific view models without recomputing Memory rules. |
| Artifact renderer | Studio | Renders a Memory assembly into files, manifests, previews, and downloadable/publishable bundles. |
| Publisher executor | Studio backend or installed local agent | Writes an already-rendered bundle to GitHub, local workspace, or object storage; credentials never enter the browser. |

## Method-by-method disposition

| Current prototype method | Production disposition | First-slice action | Notes |
| --- | --- | --- | --- |
| `ProjectMemoryClient.listProjects()` | Memory HTTP client | **Keep.** Map to the versioned project listing/selection contract. | Required before any real Studio session can start. |
| `ProjectMemoryClient.getProject(projectId)` | Memory HTTP client | **Keep.** Return a compact project shell and current revision identity. | Do not include a whole project model until the model contract exists. |
| `ProjectMemoryClient.listMessages(projectId)` | Memory HTTP client | **Keep, bounded.** Specify paging, ordering, and resume semantics. | Conversation remains Memory-owned; Studio must not rebuild authority from local transcript state. |
| `ProjectMemoryClient.submitMessage(projectId, body, idempotencyKey)` | Memory HTTP client | **Keep, contract-critical.** Require idempotent evidence/message ingestion. | Retry safety is a Demo V1 correctness requirement. |
| `ProjectMemoryClient.getInterviewSession(projectId)` | Studio projection over Memory | **Keep as projection, not durable source.** Define it from Memory sessions/messages, briefing, unknowns, and findings. | If durable interview-question state is added, it belongs in Memory because it controls resume behavior across clients. |
| `ProjectMemoryClient.recordModuleDecision(projectId, moduleId, decision)` | Memory model/revision contract | **Defer from first HTTP slice.** Keep visible as unavailable until first-class modules, relationships, and revision semantics exist. | The prototype may keep the method for mock curation, but production must not silently mutate module-like UI state. |
| `ProjectMemoryClient.deferDecision(projectId, decisionId, deferred)` | Memory decision/finding contract | **Do not freeze yet.** Define durable meaning or remove from the production port. | Deferral affects downstream readiness and package warnings, so it cannot be browser-only state. |
| `ProjectMemoryClient.confirmFinding(projectId, findingId)` | Memory knowledge-review contract | **Replace.** Confirm/reject/propose underlying knowledge where possible; retain finding confirmation only if Memory owns finding lifecycle. | Avoid treating a UI finding row as the authoritative durable fact. |
| `InterviewProvider.describe()` | Studio | **Keep.** The UI must display actual provider and mode honestly. | Mock mode remains explicit. |
| `InterviewProvider.respondTo(projectId, userMessage)` | Studio orchestrator | **Refactor.** The provider should produce candidate assistant text from a Memory briefing; Memory still records messages/evidence. | The provider must not become a second project memory. |
| `ProjectProjectionService.getProjection(projectId)` | Studio projection composer | **Keep as an internal composition boundary.** Back it with Memory briefing, readiness, findings, and bounded knowledge reads. | Projection can cache for UX, but Memory remains authoritative. |
| `ArtifactService.listDeliverables(projectId)` | Studio plus future Memory artifact metadata | **Defer production identity.** Show planned/generated UI only when a durable deliverable or assembly identity exists. | A mock list of deliverables is not proof of deliverable lifecycle. |
| `ArtifactService.generate(projectId, deliverableId)` | Memory assembly + Studio rendering | **Split.** Ask Memory for a revision-pinned assembly, then render files in Studio. | Do not let Studio choose source knowledge by querying arbitrary lists. |
| `ArtifactPublisher.listTargets()` | Studio configuration | **Keep.** Return only configured, available targets with reasons for unavailable targets. | This is Studio-owned configuration, not Memory knowledge. |
| `ArtifactPublisher.previewPublish(deliverableId, target)` | Studio backend/local agent | **Keep.** Preview proposed changes before writes. | Must run where credentials/filesystem access are allowed. |
| `ArtifactPublisher.publish(deliverableId, target)` | Studio backend/local agent + Memory publication record | **Split.** Execute the write in Studio infrastructure, then record the publication fact in Memory when that contract exists. | Never write to a default branch or overwrite conflicts silently. |

## Frozen first integration slice

The first real Studio slice should include only the capabilities that can be
made honest without first-class modules or publisher infrastructure:

1. list or create/select a Memory project;
2. read a bounded Memory-owned conversation;
3. submit a user message as idempotent evidence;
4. display queued/running/partial/failed processing state;
5. read a compact project briefing;
6. show proposed versus confirmed knowledge and open questions;
7. read project-level readiness and findings;
8. request a revision-pinned project context assembly;
9. render that assembly as a preview/downloadable bundle in Studio;
10. keep module curation, module packages, deliverable lifecycle, and publication
    visibly unavailable until their contracts are present.

## Immediate implementation checklist

- [ ] Regenerate the capability matrix against the current KAE-Memory codebase,
      routes, tests, and migrations.
- [ ] Add a typed `KaeMemoryHttpClient` wrapper for the frozen first-slice
      operations only.
- [ ] Add runtime response validation at the client boundary.
- [ ] Add contract tests for project selection, bounded message reads,
      idempotent message submission, run/processing state, briefing, readiness,
      findings, and context assembly.
- [ ] Replace mock services route-by-route, preserving the prototype badge until
      every visible behavior on a route is backed by real services.
- [ ] Keep unsupported module, deliverable, and publication actions disabled with
      explicit reasons.
