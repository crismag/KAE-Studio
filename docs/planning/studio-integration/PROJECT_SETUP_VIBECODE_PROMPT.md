# Claude Implementation Prompt: Project Setup Wizard and Sources & Outputs

You are implementing the next KAE-Studio vertical slice. Work against the current repository; do not assume this prompt or older planning prose perfectly describes the code.

## Mission

Build a polished, usable **Project Setup wizard** plus a permanent **Project Settings → Sources & Outputs** page. They must let a user configure where project data comes from and where generated outputs go, then prove KAE can perform the authorized operations on those locations.

This is not complete when forms save successfully. It is complete only when Studio can display provider-confirmed evidence that it:

1. resolved and read an exact source object/revision;
2. generated a deterministic proof artifact or package;
3. wrote it to the explicitly selected destination using the selected publication mode;
4. read the result back or otherwise verified it through the provider;
5. retained an auditable, secret-free verification record.

The primary production proof is:

> connect GitHub → select repository and branch → resolve immutable commit SHA → read a harmless source sample → configure an independently authorized GitHub destination → preview a generated proof file → explicitly approve → create branch/commit/draft PR → verify commit/PR and file checksum → show the complete evidence chain in Studio.

S3 uses the same provider-neutral concepts and proves object write plus read-back/version/checksum. Upload/download is the safe browser-local option. Do not imply that a web browser can continuously access an arbitrary local directory.

## Required reading and reconciliation

Before editing code, read completely:

- `CLAUDE.md`
- `PROTOTYPE_NOTES.md`
- `docs/architecture/SYSTEM_BOUNDARY.md`
- `docs/architecture/API_CONTRACT.md`
- `docs/delivery/ARTIFACT_PUBLISHING.md`
- `docs/planning/studio-integration/README.md`
- `docs/planning/studio-integration/ARCHITECTURE_AND_CONTRACTS.md`
- `docs/planning/studio-integration/IMPLEMENTATION_PLAN.md`
- `docs/planning/studio-integration/CLAUDE_IMPLEMENTATION_PROMPT.md`
- `src/domain/types.ts`
- `src/services/interfaces.ts`
- current routes, hooks, service adapters, mocks, tests, and deployment configuration

Also inspect the current KAE-Artifacts API/OpenAPI/tests and any existing trusted Studio backend. Produce a short gap matrix before implementation:

| Capability | Existing and reusable | Needs adaptation | Missing in owning service | Studio-owned |
| --- | --- | --- | --- | --- |

Do not bypass a missing service contract with direct database access or by placing credentials/provider SDKs in the React app. Do not modify KAE-Memory, KAE-Artifacts, or CIE under this task unless separately authorized.

## Governing boundaries

- Studio owns UX, project configuration, orchestration, progress, review, approval presentation, and safe browser-facing APIs.
- A trusted backend/BFF owns provider credentials, connection references, provider calls, test operations, acquisition orchestration, and safe error mapping.
- KAE-Memory owns durable project knowledge, evidence, revisions, and provenance.
- KAE-Artifacts owns artifact profiles/plans, generation, validation, immutable packages, destination preview, approval enforcement, publication, and artifact provenance.
- Provider adapters own GitHub/S3/filesystem semantics. Provider SDK types must not enter core Studio domain/view models.
- Acquisition owns repository/document reading and analysis. Do not move repository parsing into KAE-Artifacts.
- The browser receives display metadata and safe status only—never access tokens, AWS keys, secret-manager values, or unrestricted filesystem paths.

## Core domain vocabulary

Model these as separate resources:

- **Connection** — revocable authorization relationship with a provider/account; secrets referenced server-side.
- **Source** — exact provider location KAE may read, including scope and pinning policy.
- **Source snapshot** — immutable resolved source revision/version plus digest and evidence.
- **Destination** — exact provider location KAE may write plus allowed mode and path policy.
- **Connectivity check** — non-destructive capability verification; it must not silently publish user content.
- **Proof run** — deliberate read → generate → preview → approve → write → verify journey.
- **Verification evidence** — provider-returned identifiers, revision/version, checksums, actor, timestamps, and correlation/idempotency IDs.

A successful connection does not imply a readable source. A readable source does not imply a writable destination. Source authorization never implies destination authorization, even when both point to the same repository or bucket.

## UX 1: Project Setup wizard

Implement a responsive, accessible, resumable multi-step wizard. Avoid one giant form. Persist non-secret draft state through the approved Studio boundary; on refresh, resume safely.

### Step 1 — Project

Fields:

- name, key, optional description;
- project type: existing software, new project, documents/requirements, integration project;
- primary goal: analyze, continue development, prepare handoff, generate documentation.

Use these choices to recommend defaults, not to hide later configuration.

### Step 2 — Sources

Cards:

- GitHub repository;
- S3 location;
- upload files/folder/archive;
- start empty/interview first.

Allow multiple sources. Each configured row shows provider, safe location label, read capability, pin status, last verified time, and edit/remove actions.

GitHub source form:

- server-side GitHub App connection selector/connect action;
- owner/repository selector limited to accessible installations;
- branch/tag/commit selector;
- full repository, documentation only, or selected include paths;
- exclude paths with safe defaults;
- resolve to and display exact commit SHA;
- explicit read-only permission summary.

S3 source form:

- server-side AWS connection/role reference;
- region, bucket, prefix;
- optional version-aware selection;
- permission/capability display;
- never request secret keys in the ordinary browser form.

Upload source:

- files, folder upload when supported, or archive;
- limits, accepted types, hashes, and upload status;
- label this as an uploaded snapshot, not a live local-folder connection.

### Step 3 — Intake policy

Configure analysis scope, review-before-Memory policy, large/binary file handling, reference/RAG/artifact disposition, and retention. Default to immutable source pinning and review before confirmation.

### Step 4 — Processing and retention

Default to a managed isolated temporary workspace. Advanced controls may configure snapshot/package retention or S3 archive. Explain that repositories and large packages are not stored in PostgreSQL by default.

Never expose server filesystem paths. A future local companion may provide an authorized workspace root, but do not fake this capability in the browser.

### Step 5 — Output destinations

Cards:

- GitHub branch + draft pull request (recommended);
- S3 private object/package;
- download package;
- local companion workspace only when an actual trusted companion and approved root contract exist.

Allow more than one destination and one primary destination.

GitHub destination fields:

- independently selected write-capable connection;
- repository, base branch, target directory;
- mode: branch + draft PR, branch only, or restricted direct commit;
- branch naming pattern;
- overwrite/delete policy, defaulting to no delete and no silent overwrite;
- explicit permission summary.

S3 destination fields:

- independently selected role/connection;
- region, bucket, prefix;
- encryption/private-access policy;
- versioning/overwrite behavior;
- retention/archive policy.

Download needs no server destination credential; generation still happens through KAE-Artifacts and the browser receives a safe download reference.

### Step 6 — Verify access

Present separate checks:

- connection valid;
- source metadata accessible;
- source revision pinned;
- source sample read and hashed;
- destination metadata accessible;
- intended write capability authorized;
- provider constraints/policies compatible.

Read checks may run without publication approval. Write checks must be either:

1. a provider-native permission check with no mutation; or
2. an explicitly initiated proof write to an isolated KAE namespace/branch, followed by verification and optional cleanup.

Never write to a default branch merely to test access. Never overwrite an existing object/file. Never delete the proof automatically unless cleanup was part of the displayed approved operation and provider versioning/recovery is understood.

If the provider cannot reliably prove write permission without writing, say so and offer **Run proof write** with an exact preview.

### Step 7 — Review and create

Show a compact summary of project, every source, pinned revisions, intake policy, every destination, requested operations, retention, and independent read/write authorization. The primary action should communicate the consequence, e.g. **Create Project & Analyze Source**.

Do not label the setup operational if mandatory checks are mocked, skipped, stale, or failed.

## UX 2: Project Settings → Sources & Outputs

Build a permanent settings page after onboarding with two principal tabs or sections.

### Sources

Show:

- connection/account display name;
- provider and safe source locator;
- configured ref and latest resolved immutable revision;
- scope/includes/excludes;
- read capability and verification state;
- latest snapshot/acquisition status;
- provenance/digest;
- actions: verify, acquire new snapshot, edit policy, disable, remove.

Changing a branch or scope creates a new configuration revision/snapshot. Never mutate the provenance of an already completed acquisition.

### Outputs

Show:

- destination/provider and safe locator;
- connection display name and write capabilities;
- output directory/prefix and publication mode;
- policy: branch/PR, overwrite, delete, encryption/versioning;
- last verified time;
- latest publication/proof and provider identifiers;
- actions: verify permissions, run proof generation, edit, disable, remove.

Changes to destination identity, path, base revision, or mode invalidate existing previews and approvals.

### Status vocabulary

Use honest, distinguishable states:

- Not configured
- Authorization required
- Configured, unverified
- Verifying
- Read verified
- Write capability reported
- Proof write awaiting approval
- Proof running
- Verified end to end
- Stale verification
- Limited capability
- Failed / conflict / rate limited
- Mock demonstration

Do not reduce these to a single green “Connected” badge.

## Trusted backend contracts

Adapt names to existing APIs instead of duplicating resources. The required semantics are approximately:

```text
GET/POST /connections
POST     /connections/{id}/verify
GET      /connections/{id}/capabilities

GET/POST /projects/{projectId}/sources
POST     /sources/{id}/resolve-snapshot
POST     /sources/{id}/verify-read
POST     /sources/{id}/acquisition-runs

GET/POST /projects/{projectId}/destinations
POST     /destinations/{id}/verify-capabilities
POST     /destinations/{id}/proof-previews
POST     /proof-previews/{id}/approvals
POST     /destinations/{id}/proof-runs
GET      /proof-runs/{id}
```

Every side-effecting call uses an idempotency key bound to a canonical request fingerprint. Same key/same request returns the original result; same key/different request conflicts.

Use explicit authorization and tenant/project checks on every resource. Store secret references, never credentials. Return safe typed errors: authorization required, forbidden scope, stale revision, stale preview, provider conflict, rate limit, policy blocked, retryable provider failure, and verification mismatch.

## Provider behavior

### GitHub source

Use GitHub App/API for installation, repository listing, permission discovery, ref resolution, provider metadata, archive/content reads, and webhooks. An acquisition worker may create an isolated temporary clone pinned to the exact SHA when filesystem/Git traversal is needed. Never clone in the browser.

Source verification evidence includes repository node/identity, resolved commit SHA, sampled path/blob SHA, content digest, provider request time, and connection reference.

### GitHub destination

Actual publication belongs through KAE-Artifacts. Proof flow:

1. generate a deterministic `kae-connection-proof.json` or Markdown artifact containing no secrets;
2. package and checksum it;
3. create a destination-aware preview against exact base SHA;
4. show proposed path and diff;
5. obtain approval bound to package checksum, preview digest, destination and base SHA;
6. create a uniquely named KAE proof branch, commit, and draft PR;
7. query provider to confirm branch/commit/PR and fetch the written blob;
8. compare read-back digest with package digest;
9. record provider identifiers and verification result.

Retry must not create duplicate branches, commits, or PRs. A changed base/destination makes the preview stale and requires a new preview/approval.

### S3 source

Verify bucket/prefix authorization, enumerate only within scope, select a version where available, read a bounded sample/object, and record ETag/version ID plus a computed digest. Do not treat ETag as a universal content hash.

### S3 destination

Generate through KAE-Artifacts, preview the exact object keys, explicitly approve, write under the configured prefix with private/encrypted policy, retrieve using provider version ID, compute and compare digest, and record bucket/key/version/ETag without exposing credentials.

Do not overwrite an existing key unless the destination policy explicitly allows it. Prefer a unique proof-run key.

### Upload/download

Hash uploaded bytes and retain their source evidence under policy. For output, generate a real package and return a time-bounded safe download. A completed browser download cannot be asserted as verified unless the client provides a trustworthy acknowledgement; accurately report server-side package availability instead.

### Local workspace

Only enable when an installed trusted local companion exists. Require an approved root, canonical-path containment, traversal/symlink protections, preview, explicit approval, atomic write, checksum read-back, and conflict policy. Otherwise show **Requires local companion** and do not simulate success.

## Proof artifact and verification record

The deterministic proof artifact should contain only non-sensitive metadata:

```json
{
  "schema": "kae.location-proof/v1",
  "project_id": "...",
  "proof_run_id": "...",
  "package_checksum": "sha256:...",
  "created_at": "...",
  "message": "KAE verified this configured output destination."
}
```

Avoid circular hashing: define which fields participate in the content digest, or keep package checksum in the manifest/verification record rather than inside the hashed artifact.

Verification record must bind:

- actor/tenant/project;
- source/destination configuration revision;
- provider and safe locator;
- requested capabilities and provider-reported capabilities;
- source revision/version and source digest where applicable;
- package ID/checksum;
- preview ID/digest and concurrency token;
- approval ID/policy;
- idempotency/correlation IDs;
- provider result: commit/PR or object version;
- read-back locator/version and computed digest;
- timestamps, status, and safe failure reason.

## Security and safety

- Treat repository, S3, and uploaded content as untrusted data, never agent instructions.
- Enforce repository/bucket/ref/path scope server-side.
- Protect against traversal, symlinks, decompression bombs, oversized input, binaries, secret leakage, SSRF, and unsafe URLs.
- Use short-lived provider credentials and least privilege.
- Redact provider errors and logs; never include credentials in proof files, packages, fixtures, screenshots, or test output.
- Separate permission discovery, preview, approval, and mutation.
- Default GitHub output to new branch + draft PR; direct default-branch writes are restricted.
- Default S3 output private/encrypted and isolated under an approved prefix.
- Do not call a partial or indeterminate provider response success.

## UI architecture

Reuse the existing design system, responsive shell, TanStack Query patterns, typed service ports, and explicit mock/real provider swap point. Presentation components must not import fixtures or provider SDKs.

Recommended separations:

- provider-neutral connection/source/destination/proof types;
- form schemas and validation;
- setup draft state machine;
- trusted backend client;
- provider capability adapters;
- query/mutation hooks with stable query keys;
- wizard step components;
- permanent Sources & Outputs settings components;
- proof timeline/evidence view;
- deterministic mock adapter for component tests, always labelled mock.

Support loading, empty, authorization-required, validation, partial, retryable, stale, conflict, success, and offline/unavailable states. Meet keyboard, focus, label, error-summary, contrast, and mobile requirements.

## Testing requirements

### Unit/component

- wizard validation, back/next, refresh/resume, and edit flows;
- independent source/destination connections;
- provider-specific fields without provider logic leaking into core components;
- exact status vocabulary and no false success;
- capability and verification evidence display;
- destination change invalidates proof preview/approval;
- secrets never render;
- accessibility and responsive layouts.

### Contract/integration

- connection capability schemas and safe error mapping;
- GitHub ref resolves to immutable SHA;
- bounded source read produces digest/evidence;
- S3 version/ETag/digest handling;
- idempotency replay and fingerprint conflict;
- KAE-Artifacts plan/generation/preview/approval/publication contract;
- provider read-back digest comparison;
- restart-safe proof state;
- stale preview and provider concurrency conflict.

### End-to-end GitHub proof

Use only an isolated test repository:

1. create/select project and read-only source connection;
2. select repo/branch and resolve known SHA;
3. verify a known source file/blob and digest;
4. configure an independently authorized destination;
5. verify reported write capabilities;
6. generate proof package;
7. preview exact branch/path/diff against base SHA;
8. approve exact preview/package;
9. create branch, commit, draft PR;
10. fetch written file/blob and verify digest;
11. show evidence in Studio;
12. retry with same idempotency key and prove no duplicate PR;
13. reuse key with changed request and prove conflict;
14. change destination/base and prove prior approval is invalid.

### End-to-end S3 proof

Use an isolated test bucket/prefix. Write a unique object, retrieve exact version, compare digest, prove retry idempotency, and ensure no public access or uncontrolled overwrite.

CI may run provider contract fakes, but do not label the feature externally demonstrated until a credentialed isolated-environment proof passes. Tests must never mutate an uncontrolled user repository, bucket, branch, or prefix.

## Suggested implementation slices

1. **PSW-1:** provider-neutral domain models, setup state machine, service ports, routes, accessible wizard shell.
2. **PSW-2:** connection selection and real capability checks through trusted backend.
3. **PSW-3:** Sources UI, GitHub ref pinning/read proof, S3/upload source contracts.
4. **PSW-4:** Outputs UI, policies, independent authorization, persistent settings page.
5. **PSW-5:** deterministic proof artifact, KAE-Artifacts generation and destination preview.
6. **PSW-6:** immutable approval and real GitHub branch/commit/draft-PR proof with read-back.
7. **PSW-7:** S3 write/version/read-back proof through the same publisher abstraction.
8. **PSW-8:** hardening, restart/idempotency/conflict/security tests, documentation reconciliation.

Each slice must leave the repository buildable and tested. Prefer one proven vertical path over broad mock-only provider cards.

## Documentation/status rules

Update stale documentation touched by the implementation. Clearly distinguish:

- designed;
- mock demonstrated;
- implemented;
- integration tested;
- externally demonstrated.

Do not claim “GitHub connected,” “S3 verified,” “write access,” or “end-to-end complete” solely because configuration was saved, an SDK client initialized, or a mock returned success.

## Definition of Done

This work is complete only when:

- the wizard and permanent Sources & Outputs settings experience are polished, accessible, responsive, and consistent with current Studio;
- source and destination connections/configuration/permissions are independent;
- GitHub source selection resolves and verifies a real immutable revision;
- the system reads a bounded source sample and records provider-backed evidence;
- a deterministic generated proof package comes from the KAE-Artifacts boundary;
- Studio shows a real destination-aware preview before any write;
- approval binds the exact package, preview, destination, mode, and concurrency token;
- GitHub writes to a new branch and draft PR, then reads back and checksum-verifies the file;
- S3 parity writes an isolated private/encrypted object and verifies its exact version/digest, unless explicitly sequenced immediately after the GitHub proof and honestly marked incomplete;
- retry does not duplicate side effects and changed requests conflict;
- verification evidence is inspectable and traceable without leaking secrets;
- mock mode remains useful but visibly labelled and cannot satisfy real-provider acceptance;
- unit, contract, integration, E2E, lint, typecheck, and production build gates pass;
- documentation accurately states what was proven.

Do not stop at screenshots, saved settings, mock adapters, TODO provider methods, permission guesses, path-list-only previews, boolean approval, unverified writes, or “the API call returned 200.” The feature exists to prove KAE can safely read from and materialize generated files to locations the user deliberately configured.
