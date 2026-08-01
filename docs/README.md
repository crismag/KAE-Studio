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
| `delivery/ARTIFACT_PUBLISHING.md` | Publisher abstraction and the three artifact targets |
| `decisions/ADR-0001-studio-memory-separation.md` | Repository/service separation |
| `decisions/ADR-0002-project-model-and-modules.md` | The project model is the product; modules are first-class |
| `decisions/ADR-0003-artifact-publishing-targets.md` | Generation separate from publication; three targets |
| `decisions/ADR-0004-mcp-access-layer.md` | MCP as the agent access layer, owned by KAE-Memory |
| `decisions/ADR-0005-knowledge-scopes-and-patterns.md` | Multi-scope knowledge and the reusable pattern library |
| `planning/CAPABILITY_MATRIX.md` | Evidence-based Studio-need vs. KAE-Memory analysis, with ownership per gap |
| `planning/VERTICAL_SLICE.md` | First demonstrable product flow and acceptance criteria |
| `planning/IMPLEMENTATION_DIRECTIVE.md` | Work order and instructions for Claude |
| `ui/UI_GENERATION_CONTEXT.md` | Governing brief for KAE-Studio's own interface |

Note the distinction between the two UI documents: `product/UI_DEFINITION.md` covers the interface Studio **defines for the project being specified**; `ui/UI_GENERATION_CONTEXT.md` covers **Studio's own** interface.

## Status vocabulary

- **Proposed**: discussed but not accepted.
- **Approved direction**: accepted architectural or product guidance, not necessarily implemented.
- **In progress**: implementation exists on an active branch but is incomplete.
- **Implemented**: code exists and has relevant automated verification.
- **Demonstrated**: the capability was exercised end to end in the target environment.

No document in this package claims any capability is implemented. This repository currently contains documentation only.

## Open items

- The first vertical slice has not been re-scoped since ADR-0002 widened the product. `planning/VERTICAL_SLICE.md` is stale in scope, though its boundary and durability acceptance criteria remain valid.
- The KAE-Memory capability matrix now exists (`planning/CAPABILITY_MATRIX.md`, 2026-08-01). Three structural gaps are identified: relationship write/traversal API, scoped readiness, and purpose-bounded context assembly.
- Conversation ownership (Studio vs. Memory) needs an ADR — see capability matrix finding 6.
- Application stack is undecided (ADR-0001 follow-up).
- Authentication and tenancy are now urgent, not deferrable: ADR-0004 lets external agents connect directly to the platform.
- Which repository hosts `kae-mcp` is an open follow-up (ADR-0004).
- MCP-M1 is specified in KAE-Memory (`development/tasks/TASK-010-mcp-m1-engineering-context-server.md`) and is sequenced before further Studio UI work.
- ADR-0005 (knowledge scopes) is the largest structural change identified so far and is explicitly sequenced after project-scoped capability and tenancy.
