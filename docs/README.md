# KAE-Studio Documentation Set

Status: approved direction for planning; implementation status must be tracked separately.

This set defines KAE-Studio as an AI-assisted software definition and context-engineering platform, built above KAE-Memory as a separate product-facing repository. It corrects two things: the original product inversion in which internal memory concepts became the main user interface, and the narrower "guided requirements chat" framing that preceded ADR-0002.

## Document map

| Document | Purpose |
| --- | --- |
| `../CLAUDE.md` | Short governing context for every Claude session |
| `product/PRODUCT_VISION.md` | Product promise, positioning, users, scope, and non-goals |
| `product/USER_WORKFLOW.md` | End-to-end journey, navigation, corrections, failure behavior |
| `product/DISCOVERY_INTERVIEWS.md` | Typed engineering interviews and question banks |
| `product/UI_DEFINITION.md` | Screen specification as a generated output |
| `architecture/PROJECT_MODEL.md` | The structured project model: nodes, edges, invariants, status |
| `architecture/MODULE_SPECIFICATION.md` | Canonical module shape, decomposition, readiness |
| `architecture/KNOWLEDGE_SCOPES.md` | Project, organization, methodology, pattern, and self-memory scopes |
| `methodology/PATTERN_LIBRARY.md` | Pattern record structure, extraction workflow, and eight seed patterns |
| `architecture/MCP_SERVICE.md` | Agent access layer design; implementation belongs with KAE-Memory |
| `architecture/SYSTEM_BOUNDARY.md` | Ownership split and runtime relationship |
| `architecture/DATA_OWNERSHIP.md` | Database, table, storage, and lifecycle ownership |
| `architecture/API_CONTRACT.md` | Studio-to-Memory service contract, including model operations |
| `delivery/CONTEXT_PACKAGE.md` | The generated package structure and honesty requirements |
| `delivery/ARTIFACT_PUBLISHING.md` | Publisher abstraction and the three artifact targets — **the subsystem now lives in KAE-Artifacts** |
| `decisions/ADR-0001-studio-memory-separation.md` | Repository/service separation |
| `decisions/ADR-0002-project-model-and-modules.md` | The project model is the product; modules are first-class |
| `decisions/ADR-0003-artifact-publishing-targets.md` | Generation separate from publication; three targets |
| `decisions/ADR-0004-mcp-access-layer.md` | MCP as the agent access layer, owned by KAE-Memory |
| `decisions/ADR-0005-knowledge-scopes-and-patterns.md` | Multi-scope knowledge and the reusable pattern library |
| `decisions/ADR-0006-memory-owns-durable-conversation.md` | KAE-Memory owns durable projects, sessions, and messages |
| `planning/CAPABILITY_MATRIX.md` | Historical evidence-based Studio-need vs. KAE-Memory analysis; regenerate before implementation |
| `planning/PRODUCT_CONTRACT_ALIGNMENT.md` | Current task context for reconciling prototype ports with real Memory HTTP contracts |
| `planning/studio-integration/` | Current repository-intake + KAE-Artifacts output integration context, contracts, implementation plan, Claude execution prompt, and the resolved KAE-Artifacts API |
| `planning/VERTICAL_SLICE.md` | First demonstrable product flow and acceptance criteria |
| `planning/IMPLEMENTATION_DIRECTIVE.md` | Work order and instructions for Claude |
| `planning/STUDIO_UX_ARCHITECTURE_IMPLEMENTATION_DIRECTIVE.md` | Execution/review sequence for Dashboard, Rooms, focused intake, Settings separation, work routing, and frontend locality refactor |
| `ui/UI_GENERATION_CONTEXT.md` | Governing brief for KAE-Studio's own interface |
| `ui/WORKSPACE_VISUAL_DESIGN_PROPOSAL.md` | Workspace review and proposal for visual navigation, graphical state, themes, responsive views, and truthful content |
| `ui/PROJECT_DEFINITION_PRODUCTION_DESIGN_PROPOSAL.md` | Production-grade Project Definition page: charter, coverage, refinement, provenance, graphical intelligence, and downstream gates |
| `ui/MODULES_PAGE_PRODUCTION_DESIGN_PROPOSAL.md` | Repository-grounded Modules page: activation, N12 contract boundary, decomposition curation, readiness portfolio, system maps, and production criteria |
| `ui/STUDIO_UX_ARCHITECTURE_PACKAGE.md` | Unifying Studio information architecture: Dashboard, workflow/work management, progressive project intake, Rooms and contextual toolbelts, design inspirations, Settings boundaries, Source Manifest, and page/Room-oriented frontend organization |

Note the distinction between the two UI documents: `product/UI_DEFINITION.md` covers the interface Studio **defines for the project being specified**; `ui/UI_GENERATION_CONTEXT.md` covers **Studio's own** interface.

## Status vocabulary

- **Proposed**: discussed but not accepted.
- **Approved direction**: accepted architectural or product guidance, not necessarily implemented.
- **In progress**: implementation exists on an active branch but is incomplete.
- **Implemented**: code exists and has relevant automated verification.
- **Demonstrated**: the capability was exercised end to end in the target environment.

Implementation status must be verified independently. The repository now includes a frontend experience prototype backed by deterministic mock adapters; it is not a demonstrated KAE-Memory integration.

## Open items

- Whether KAE-Studio needs its own database. ADR-0006 removed durable conversation from it; decide after Studio's real persistence requirements are known.
- Demo date, which would let the first Studio slice be sized against a deadline rather than a capability boundary.
- `planning/CAPABILITY_MATRIX.md` is a 2026-08-01 snapshot and predates major KAE-Memory MCP work. Regenerate it from current Memory code and interfaces using `planning/PRODUCT_CONTRACT_ALIGNMENT.md`.
- The frontend prototype uses React, TypeScript, and Vite; the trusted backend/runtime architecture for provider orchestration and publication remains undecided.
- Authentication and tenancy are now urgent, not deferrable: ADR-0004 lets external agents connect directly to the platform.
- Which repository hosts `kae-mcp` is an open follow-up (ADR-0004).
- MCP-M1 and the Studio experience prototype now exist. The next boundary is real HTTP contract alignment; Studio must not consume MCP as its browser transport.
- ADR-0005 (knowledge scopes) is the largest structural change identified so far and is explicitly sequenced after project-scoped capability and tenancy.
