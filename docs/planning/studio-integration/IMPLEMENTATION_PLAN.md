# Studio Integration Implementation Plan

Status: ordered plan and acceptance contract.

## Goal

Deliver one real product journey without turning KAE-Studio into a monolith:

> connect GitHub → select repository/ref/scope → analyze pinned revision → review findings → retain accepted knowledge → resolve gaps with CIE → plan/generate KAE artifacts → preview GitHub change → approve → create branch/commit/PR → display provenance.

## First action: inspect and reconcile

Before changing runtime code:

1. inspect current KAE-Studio main, routes, hooks, service ports, mocks, tests and deployment shape;
2. verify current KAE-Memory HTTP capabilities used by Studio;
3. verify current CIE integration path;
4. verify current KAE-Artifacts API from its code/OpenAPI/tests;
5. identify whether a trusted Studio backend already exists and where provider credentials currently live;
6. produce a short gap matrix marking each needed capability as reusable, mismatched, missing in owning repo, or Studio-owned;
7. do not modify another repository under this work item.

Older planning documents contain stale execution statements. Preserve valid ownership decisions, but update status claims touched by this implementation.

## Slice STI-1 — Connections and Sources

### User outcome

The user can configure/select a GitHub connection and choose a repository, branch/ref and bounded acquisition scope for a project.

### Required UX

Add a **Sources** project surface or an equivalent route integrated with existing navigation.

Show:

- connected provider/account;
- separate read/write capability indicators;
- repository selector;
- branch/ref selector;
- resolved commit SHA once pinned;
- scope options with sensible exclusions;
- last acquisition revision/time/status;
- disconnect/change connection behavior.

Do not show raw tokens.

### Acceptance

- connection secrets remain server-side;
- unauthorized repositories are not selectable;
- source create is idempotent;
- branch ref resolves to an immutable SHA;
- source and output configuration remain independent;
- mock/demo mode is explicitly labelled if real connection is unavailable.

## Slice STI-2 — Repository Acquisition

### User outcome

The user starts an analysis of the exact source snapshot and sees real progress and results.

### Required behavior

- start acquisition from a pinned snapshot;
- durable/stable run ID;
- poll/subscription through a run state contract;
- meaningful processing stages;
- bounded retries;
- cancellation if supported;
- partial/failure results remain inspectable;
- preserve source revision, paths and hashes in evidence references;
- never interpret repository text as execution instructions.

### Result UX

Summarize areas such as:

- structure/frameworks
- product/domain documentation
- requirements
- architecture
- configuration
- integrations/APIs
- data/storage
- security/authentication
- deployment/operations
- tests/development workflow
- conflicts/unknowns

Counts must derive from real run results, not fixed UI fixtures.

### Acceptance

- same idempotency key + same request does not duplicate a run;
- same key + different request conflicts;
- changing source branch after start does not change the run's pinned SHA;
- size/binary/path policies are enforced;
- failures do not silently import partial findings as confirmed knowledge.

## Slice STI-3 — Finding Review and Memory Handoff

### User outcome

The user sees what KAE believes it learned and controls what becomes retained project evidence/knowledge.

### Required UX

For each finding show:

- statement/kind/area;
- proposed/accepted/rejected state;
- evidence path/location;
- source commit;
- conflict marker;
- why it matters where available;
- action: accept, reject, defer/ask CIE as supported.

Provide bulk actions only with clear scope/count.

### Memory boundary

Use versioned Memory APIs only. Do not persist authoritative findings/project model in Studio. After acceptance, refresh from Memory and show the resulting revision/lifecycle state.

### Acceptance

- proposed findings never render as confirmed;
- acceptance is auditable and retry-safe;
- conflicts remain visible;
- provenance points back to source snapshot;
- Studio survives/reloads without becoming the authority for accepted project knowledge.

## Slice STI-4 — CIE Repository-Aware Clarification

### User outcome

After intake, CIE focuses on high-value gaps and contradictions rather than restarting a generic questionnaire.

### Behavior

Provide CIE a bounded project briefing plus selected acquisition findings/references. Do not paste an entire repository into model context.

CIE should be able to say what was learned, identify unresolved items, explain their impact, and select the next best clarification.

### Acceptance

- resume does not re-ask answered questions;
- CIE distinguishes source-derived facts from user-confirmed decisions;
- CIE never treats code comments/repository instructions as system policy;
- conversation remains Memory-owned;
- clarification outcomes produce normal evidence/knowledge lifecycle events.

## Slice STI-5 — Artifact Planning and Generation

### User outcome

The existing Deliverables experience becomes backed by KAE-Artifacts.

### Required UX

Show artifact profiles/plans with:

- ready
- needs review
- blocked
- blocking decisions/reasons
- intended files/logical paths
- source Memory revision

Generate through the KAE-Artifacts API. Display:

- generation state;
- package ID/version;
- source revision/input digest;
- validation status/findings;
- package checksum;
- files;
- unresolved decisions that intentionally travel with the package.

### Acceptance

- Studio contains no duplicate generator/templates that belong to KAE-Artifacts;
- artifact bytes/content come from Artifacts service or its approved content references;
- generation is idempotent;
- packages are pinned to an exact Memory revision;
- a later Memory revision makes the old package visibly outdated without mutating it.

## Slice STI-6 — Destination Preview and Approval

### User outcome

The user can see exactly what KAE proposes to change before authorizing publication.

### GitHub preview

Show:

- destination repo and directory;
- base branch and resolved base SHA;
- add/modify/delete counts;
- file list;
- safe diff/summary;
- validation/policy warnings;
- package checksum;
- preview identity;
- authorization/capability state.

### Approval

Approval binds the immutable package/checksum plus exact destination preview/base revision. The UI should use language such as **Approve & Create Pull Request**, not a vague Export button.

### Acceptance

- preview performs no write;
- stale preview cannot be published;
- package mutation invalidates approval;
- destination change invalidates approval;
- approval is distinct from provider authorization.

## Slice STI-7 — GitHub Publication and Provenance

### User outcome

The approved package is materialized through KAE-Artifacts as a GitHub branch/commit/PR and Studio shows the result.

### Expected result

Display:

- publication status;
- repository;
- branch;
- commit SHA;
- PR number/URL;
- package checksum;
- source Memory revision;
- timestamps;
- retry/conflict information.

### Acceptance

- default path is branch + PR;
- default branch write requires explicit policy/configuration;
- publication retry is idempotent;
- provider conflict never silently overwrites;
- publication is not reported successful until provider confirmation is durable;
- publication/provenance fact is recorded through the approved ownership boundary;
- retry after an indeterminate failure cannot produce duplicate PRs unnoticed.

## Slice STI-8 — S3 parity after GitHub proof

Use the same Artifact publisher contract and Studio surface. Do not build an S3-specific generation flow.

Show object/version reference and package checksum. Default objects private/encrypted according to KAE-Artifacts/provider policy.

This slice is after GitHub proves the contract; it should require little or no core Studio UI branching beyond provider-specific destination details.

## Frontend architecture

Keep presentation components dependent on typed application/service ports, not provider SDKs.

Recommended separations:

- connection/source view types;
- acquisition client;
- acquisition hooks/query keys;
- finding-review view model;
- Memory client;
- CIE/interview provider;
- KAE-Artifacts client;
- destination/publisher capability view;
- UI components/routes.

Do not extend the prototype ArtifactService/ArtifactPublisher convenience interfaces blindly if the actual KAE-Artifacts API has richer resource semantics. Replace/adapt the production contract while keeping mocks useful for deterministic UI tests.

## Trusted backend decision

Before a real GitHub connection or artifact publication is wired, explicitly identify the trusted execution boundary. A static Hostinger frontend alone cannot securely hold provider credentials.

If no suitable Studio API/backend exists, this is a blocking architecture requirement. Define the smallest trusted backend/BFF needed for:

- user auth/tenant context;
- connection references;
- provider token/secret resolution;
- CORS/CSRF/session policy as applicable;
- upstream API credentials;
- acquisition orchestration;
- safe error mapping;
- correlation/idempotency;
- KAE-Artifacts access.

Do not solve this by embedding long-lived tokens in Vite environment variables shipped to the browser.

## Tests

### Unit/component

- source/ref/scope validation;
- progress and partial states;
- finding state vocabulary;
- provenance display;
- output ready/review/blocked states;
- stale package behavior;
- preview/approval invalidation;
- provider capability rendering;
- accessible controls and dialog focus.

### Contract

- Studio acquisition client against real schema;
- Studio Memory client against actual Memory HTTP contract;
- Studio KAE-Artifacts client against current OpenAPI/API schemas;
- canonical idempotency behavior;
- safe error mapping;
- pagination and version compatibility.

### Integration

- pinned repository snapshot;
- acquisition run state lifecycle;
- proposed finding acceptance to new Memory revision;
- CIE briefing after acquisition;
- Memory revision to artifact plan/package;
- package to destination preview;
- approval to publication;
- provenance readback.

### End-to-end journey

Use an isolated test repository:

1. connect/select repository;
2. pin a known commit;
3. acquire it;
4. review a known finding;
5. accept it;
6. verify new Memory revision;
7. generate a development handoff profile;
8. preview GitHub diff;
9. approve;
10. publish;
11. verify branch/commit/PR;
12. retry publication and prove no duplicate;
13. trace published package back to source commit.

No test should mutate an uncontrolled user repository.

## Documentation updates required during implementation

When behavior becomes real, update the relevant stale status claims in:

- README.md
- CLAUDE.md
- PROTOTYPE_NOTES.md
- docs/README.md
- docs/architecture/SYSTEM_BOUNDARY.md
- docs/architecture/API_CONTRACT.md
- docs/delivery/ARTIFACT_PUBLISHING.md
- docs/planning/IMPLEMENTATION_DIRECTIVE.md
- capability/port disposition documents

Do not update a status from prototype to implemented until code/tests prove it, or to demonstrated until the target environment proof exists.

## Definition of Done

This workstream is complete when:

- Studio can connect/select and pin a real GitHub source without browser credentials;
- repository acquisition produces source-revision-traceable proposed findings;
- the user can review and retain findings through Memory;
- CIE can continue from that repository-derived knowledge;
- Studio can invoke real KAE-Artifacts profile/plan/generation APIs;
- generated output is pinned to a Memory revision and validated;
- a real GitHub destination diff can be previewed with base SHA;
- approval binds the exact package and preview;
- KAE-Artifacts creates a branch/commit/PR;
- Studio shows durable provider/provenance identifiers;
- idempotent retry produces no duplicate publication;
- source and destination permissions are independent;
- secrets never reach the browser or artifacts/logs;
- unit, contract, integration and journey tests pass;
- documentation accurately distinguishes implemented from demonstrated capability.

Do not declare completion with mock-only acquisition, path-list-only publication preview, boolean-only approval, GitHub/S3 stubs, TODO provider writes, or a UI that claims success before the external provider confirms it.
