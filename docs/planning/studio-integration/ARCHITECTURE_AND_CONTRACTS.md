# Repository Intake and Artifact Output Architecture

Status: target contract for KAE-Studio integration implementation.

## Product loop

~~~mermaid
flowchart TD
    SRC["Source connection"] --> SNAP["Pinned source snapshot"]
    SNAP --> ACQ["Acquisition run"]
    ACQ --> REV["Review proposed findings"]
    REV --> MEM["KAE-Memory revision"]
    MEM --> CIE["CIE clarification"]
    CIE --> MEM
    MEM --> PLAN["Artifact plan"]
    PLAN --> GEN["Generate + validate package"]
    GEN --> PRE["Destination preview"]
    PRE --> APP["Approve exact change"]
    APP --> PUB["Publish"]
    PUB --> PROV["Publication provenance"]
~~~

Studio orchestrates the loop; it is not the system of record for knowledge and is not the artifact generator.

## Studio surfaces

### Sources

A first-class project area for connected inputs.

Initial source kind: GitHub repository.

Future-compatible kinds:

- GitLab repository
- uploaded documents
- requirements/context packages
- configuration files
- integration specifications
- URL/documentation
- research results
- registered object/reference stores

The UI should be typed around SourceKind and provider capabilities rather than a GitHub-only page.

### Outputs / Deliverables

Extend the existing Deliverables experience. Keep existing revision pinning, generated/outdated states, content preview, open-decision warnings, and publisher separation.

Add real KAE-Artifacts planning, generation, validation, destination-aware preview, approval, publication result, and provenance.

## Connection versus source

A **Connection** is an authorization/configuration reference managed in a trusted backend. It can expose capabilities such as repository discovery or publishing.

A **Source** is a project-scoped declaration that says what to analyze.

Example neutral shape:

~~~json
{
  "source_id": "src_...",
  "project_id": "memory-project-id",
  "kind": "repository",
  "provider": "github",
  "connection_ref": "conn_...",
  "repository": "crismag/example",
  "ref": "main",
  "scope": {
    "include": ["src/**", "docs/**", "README.md"],
    "exclude": ["vendor/**", "node_modules/**", "dist/**"]
  }
}
~~~

Do not persist provider tokens in this record.

## Pinned source snapshot

Never analyze a moving branch name as though it were a stable input. Resolve the selected ref to an immutable revision before acquisition.

Required snapshot identity:

- provider
- repository/source identity
- requested ref
- resolved commit/revision SHA
- acquisition scope
- canonical request digest
- timestamp
- connection reference
- actor/tenant/project authorization context

The immutable source revision participates in all finding provenance.

## Acquisition run

The acquisition boundary performs source reading and analysis. Studio needs a neutral client contract even if the first provider is GitHub.

Suggested service interface:

~~~ts
interface AcquisitionService {
  listSources(projectId: string): Promise<ProjectSource[]>
  createSource(input: CreateSourceInput, idempotencyKey: string): Promise<ProjectSource>
  previewSource(sourceId: string): Promise<SourcePreview>
  startAcquisition(input: StartAcquisitionInput, idempotencyKey: string): Promise<AcquisitionRun>
  getAcquisitionRun(runId: string): Promise<AcquisitionRun>
  listFindings(runId: string, cursor?: string): Promise<Page<AcquisitionFinding>>
  acceptFindings(input: AcceptFindingsInput, idempotencyKey: string): Promise<AcceptanceResult>
}
~~~

Do not assume this service must live in the browser or in KAE-Memory. The trusted runtime may orchestrate provider access, parsers and model-backed analysis. Ownership should be finalized from existing services before implementation.

### Run states

At minimum:

- accepted
- resolving_source
- reading
- analyzing
- awaiting_review
- partially_succeeded
- succeeded
- failed
- cancelled

Progress must report meaningful stages/counts, not fabricated percentages.

### Proposed finding

A finding is not automatically authoritative knowledge.

~~~ts
interface AcquisitionFinding {
  id: string
  runId: string
  area: string
  kind: string
  statement: string
  status: 'proposed' | 'accepted' | 'rejected' | 'superseded'
  confidence?: number
  evidence: SourceEvidenceRef[]
  relatedFindingIds: string[]
  conflict?: {
    withKnowledgeIds: string[]
    explanation: string
  }
}
~~~

Every substantive finding must point to source evidence including repository revision plus path/range or another stable locator.

## Source disposition

Do not treat every input byte as Memory knowledge.

An acquisition result may declare a disposition:

| Disposition | Meaning |
| --- | --- |
| MEMORY | Structured durable project knowledge/evidence appropriate for Memory |
| RAG | Large searchable content retained in a retrieval/index layer |
| REFERENCE | Retain stable URI/revision/hash and fetch again when needed |
| ARTIFACT | Durable file/object handled by artifact/content storage |
| EPHEMERAL | Processing input that need not persist after policy/retention window |

Memory retains the references and provenance needed to understand derived knowledge. A future storage implementation can vary without changing the Studio UI contract.

## Review and acceptance

Studio must allow:

- select all/individual findings;
- inspect evidence and source location;
- see conflicts with existing project knowledge;
- accept selected findings;
- reject or defer;
- send ambiguous/conflicting items to CIE;
- distinguish accepted evidence from confirmed knowledge when Memory lifecycle semantics require an additional confirmation step.

Bulk acceptance must be bounded and auditable. A model confidence score is not permission to confirm knowledge.

## CIE handoff

After acquisition, Studio should surface a natural handoff such as:

> I analyzed commit 3a217c9. I found 47 usable project facts, 3 conflicts with existing decisions, and 8 questions I could not resolve from the repository. Let’s resolve the high-impact items first.

CIE receives a bounded briefing/retrieval context. It does not consume an entire repository dump in the prompt.

## Artifact planning

Studio does not decide file contents or duplicate KAE-Artifacts profile logic.

Conceptual flow:

1. request/pin the current KAE-Memory revision;
2. assemble normalized generation input through the approved boundary;
3. request available profiles/artifact plans from KAE-Artifacts;
4. render ready / needs-review / blocked plan items;
5. allow supported plan edits without losing logical paths;
6. start a generation run using idempotency;
7. display validation and package provenance.

Studio-facing Artifact client should evolve from the prototype convenience port toward explicit resources:

~~~ts
interface ArtifactClient {
  listProfiles(): Promise<ArtifactProfile[]>
  createPlan(input: CreateArtifactPlanInput): Promise<ArtifactPlan>
  startGeneration(input: StartGenerationInput, idempotencyKey: string): Promise<GenerationRun>
  getGenerationRun(runId: string): Promise<GenerationRun>
  getPackage(packageId: string): Promise<ArtifactPackage>
  previewPublication(input: PreviewPublicationInput): Promise<PublicationPreview>
  approvePublication(input: ApprovalInput, idempotencyKey: string): Promise<Approval>
  publish(input: PublishInput, idempotencyKey: string): Promise<Publication>
  getPublication(publicationId: string): Promise<Publication>
}
~~~

Adapt names to the actual KAE-Artifacts API. Do not create duplicate Studio endpoints simply to preserve this sketch.

## Publication preview

The current prototype lists proposed file changes. The real preview must be destination-aware.

For GitHub it should expose:

- repository
- base branch
- resolved base SHA
- target directory
- files added/modified/deleted where deletion is permitted
- per-file diff/summary where safe
- package ID and package checksum
- preview ID/digest
- warnings and conflicts
- whether credentials/authorization allow the intended action
- intended mode: branch/commit/draft PR

Preview is read-only.

## Approval and publication

A boolean approved flag is not sufficient.

Approval should bind:

- actor
- project
- package ID
- package checksum
- preview ID/digest
- destination identity
- base revision/SHA or equivalent concurrency token
- publication mode
- timestamp/expiry where supported
- approval policy/version

Authorization and approval are separate. A user may approve a change they are not authorized to publish; the system must reject the write safely.

On publication, revalidate preview concurrency. If the base SHA or destination state changed, return a stale-preview/conflict state and require a new preview/approval rather than silently rebasing.

## Source and destination independence

A project may read from repository A and publish to repository B. Treat these as distinct configuration and permission decisions.

~~~text
Source
  connection: github-read-1
  repo: org/legacy-app
  ref: main

Output
  connection: github-write-2
  repo: org/project-context
  base: main
  directory: docs/kae/
  mode: draft-pr
~~~

Never infer write authority from a successful intake.

## Browser/trusted-runtime boundary

The browser may receive:

- connection display metadata
- repository names it is authorized to select
- capability/status data
- source/run/finding descriptors
- safe previews/diffs
- artifact metadata
- publication results

The browser must not receive:

- GitHub access tokens
- AWS secret keys
- raw provider credentials
- database credentials
- secret-manager values
- unrestricted filesystem paths
- internal exception dumps

Provider operations occur in a trusted backend or approved local companion.

## Security and prompt-injection boundary

Repository and document content is untrusted. Files may contain text such as instructions to ignore policies, reveal credentials, or publish changes. The acquisition system must treat that content strictly as data.

Required controls:

- explicit system separation between source data and agent instructions;
- no tool/write authority granted merely because source text requests it;
- path traversal protection;
- repository/ref/path authorization;
- size/count/decompression limits;
- binary/media policies;
- secret detection and redaction policy;
- safe log/error handling;
- allowlisted destination operations;
- audit correlation IDs;
- model output remains proposed until lifecycle policy permits acceptance.

## Idempotency and failure behavior

Side effects use idempotency keys bound to canonical request fingerprints.

Reusing a key:

- same canonical request → return the original resource/result;
- different canonical request → return an idempotency conflict.

Retryable failures must be distinguished from permanent validation, authorization, approval, or provider conflicts.

The UI should render:

- queued/running
- partial
- retryable failure
- authorization required
- stale revision
- stale publication preview
- validation blocked
- approval required
- provider conflict/rate limit
- success

Never collapse partial or awaiting-review states into success.

## Provenance chain

The intended trace is:

~~~text
GitHub repo/ref
  -> resolved source SHA
  -> acquisition run + evidence
  -> accepted/confirmed Memory knowledge
  -> Memory revision
  -> Artifact generation run/input digest
  -> package ID/checksum
  -> destination preview/base SHA
  -> approval ID
  -> publication
  -> GitHub commit/PR or S3 version
~~~

A user inspecting an output should be able to walk backward through this chain without storing every source byte in PostgreSQL.
