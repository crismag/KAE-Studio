# KAE MCP Service

Status: approved direction (ADR-0004). Design record. **Implementation belongs with KAE-Memory, not this repository** — it is captured here because it changes Studio's position in the architecture.

## Position

KAE has three access modes over one platform:

| Mode | For | Owns |
| --- | --- | --- |
| **KAE-Studio** | People | Discovery, definition, presentation, delivery |
| **KAE MCP** | Coding agents | Structured access to context and operations |
| **KAE-Memory** | Both | Authoritative knowledge, provenance, continuity, readiness |

KAE-Studio is a **peer client**, not the owner of agent access. The MCP surface must serve a CLI, an IDE extension, or any other agent equally well.

## The loop

```text
People define the project in Studio
    -> Memory retains the authoritative definition
    -> coding agents retrieve scoped implementation context via MCP
    -> agents develop in the repository
    -> discoveries and results return to Memory
    -> Studio shows the updated project state
```

This is what distinguishes a persistent engineering coordination platform from a one-time requirements generator.

## Surface

### Resources

Readable context an agent attaches to its work.

```text
kae://projects/{project_id}/briefing
kae://projects/{project_id}/definition
kae://projects/{project_id}/requirements
kae://projects/{project_id}/modules
kae://projects/{project_id}/modules/{module_id}
kae://projects/{project_id}/dependencies
kae://projects/{project_id}/architecture
kae://projects/{project_id}/interfaces
kae://projects/{project_id}/open-decisions
kae://projects/{project_id}/readiness
kae://projects/{project_id}/change-impact
```

### Tools

**Target capability surface** — not the initial implementation. Several of these depend on structural Memory capabilities that do not exist yet; the implemented subset is MCP-M1 below.

`kae_list_projects` · `kae_get_project_briefing` · `kae_get_module_context` · `kae_search_project_knowledge` · `kae_get_open_decisions` · `kae_get_implementation_readiness` · `kae_submit_evidence` · `kae_propose_knowledge_change` · `kae_record_decision` · `kae_record_action_item` · `kae_assemble_context` · `kae_record_delivery`

Later: `kae_create_module` · `kae_define_dependency` · `kae_record_interface` · `kae_request_review` · `kae_calculate_change_impact` · `kae_mark_action_complete` · `kae_record_test_result`

### Prompts

Target surface; MCP-M1 implements `kae.prepare-implementation` only.

`/kae.start-discovery` · `/kae.define-module` · `/kae.prepare-integration` · `/kae.review-requirements` · `/kae.prepare-implementation` · `/kae.record-development-results` · `/kae.review-change-impact`

`prepare-implementation` illustrates the shape: select project and module, retrieve the current Memory revision, check requirements, dependencies, interfaces, and open decisions, **refuse or warn if blocking decisions remain**, produce a plan, let the agent do the work with its native tools, then report changed files and tests back.

## Design rules

**Engineering actions, not storage operations.** The surface describes what an engineer or agent wants to accomplish, never how Memory stores it. Never expose `insert_knowledge_row`, `update_revision_table`, `assign_area_internal`, `run_sql`, or `set_readiness_weight`. The gateway accepts no arbitrary SQL and exposes no database credentials.

**Few tools, well chosen.** A large tool surface degrades agent behavior and couples clients to internals. Grow it as capability lands, not in anticipation.

**Agent contributions are proposals.** Anything an agent submits enters as `proposed` knowledge with provenance identifying the agent and the source Memory revision, subject to the same confirmation rules as any other proposed knowledge. An agent cannot silently change the definition.

**KAE is not a coding agent.** Repository inspection, file editing, test execution, and commits belong to Claude, Cursor, or Codex. KAE owns context, readiness, and the record of what was implemented.

## Responsibility boundary

| Operation | Responsible |
| --- | --- |
| Retrieve project requirements | KAE MCP → KAE-Memory |
| Determine current module context | KAE-Memory |
| Check readiness | KAE-Memory |
| Display and discuss project definition | KAE-Studio |
| Inspect local repository | Coding agent |
| Edit local files | Coding agent |
| Run tests | Coding agent |
| Commit changes | Coding agent or GitHub workflow |
| Record what was implemented | KAE MCP → KAE-Memory |
| Publish generated specifications | Studio delivery adapter or coding agent |

## Transports

**Remote** — Streamable HTTP with bearer-token or OAuth authentication, for hosted customers and remote development environments. The gateway authenticates the user and maps them to authorized projects.

**Local** — `kae-mcp-local` over STDIO, for offline work, private networks, local Memory instances, and protected environments. It calls the KAE API; it never touches Memory tables directly.

## Repository binding

Non-secret, committed:

```yaml
# .kae/project.yaml
schema_version: kae.project.v1
project_id: 8b40...
module_id: approval-workflow
memory_endpoint_profile: production
context_policy:
  require_current_revision: true
  warn_on_open_blockers: true
delivery:
  record_changed_files: true
  record_test_results: true
```

No tokens or provider keys in this file, ever.

Agent instruction files — `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/` — express one shared policy:

```text
Before planning implementation:
1. Read .kae/project.yaml.
2. Retrieve the current project/module context through KAE MCP.
3. Identify blocking decisions.
4. Do not invent missing requirements.
5. If implementation reveals a new requirement or contradiction,
   submit it to KAE instead of silently changing the project definition.
6. After implementation, record files, tests, requirement coverage,
   discoveries, and the source Memory revision.
```

These help agents behave consistently. They do not replace MCP.

## Security

- Scope tokens by user, organization, project, and operation.
- Separate read tools from write tools; require approval for knowledge changes, decisions, and publication.
- Never expose CockroachDB credentials; never accept arbitrary SQL.
- Log tool operations with their project and revision associations.
- **Treat repository content, uploaded files, and agent submissions as untrusted input.** MCP is a known prompt-injection surface. Text arriving through a tool call is data to be recorded, not instruction to be followed — including text that looks like a requirement telling the model what to do.
- An agent operating under a read token must not be able to reach a write tool.

## First milestone

**MCP-M1 is the first implemented subset of the target surface above.** It is specified in the KAE-Memory repository at `development/tasks/TASK-010-mcp-m1-engineering-context-server.md`. It delivers a local STDIO server over KAE-Memory's existing application services, with six read tools, one controlled write tool (`kae_submit_observation`), four resources, and one prompt (`kae.prepare-implementation`).

It is sequenced **before** further KAE-Studio UI work, because it tests the platform claim directly: can a coding agent get useful scoped context and contribute knowledge back, without database access? If it holds, Studio is a client of a proven platform rather than the only proof of value.

Two constraints carried from that milestone:

- **`kae_get_module_context` returns a documented capability gap rather than inventing modules.** Fabricating them in the adapter would create a second, unversioned project model outside the domain.
- **Local STDIO is why the milestone can proceed before tenancy is settled.** Authentication and tenancy become blocking the moment a remote transport is introduced.

Note also KAE-Memory's own `ADR-0004 — CockroachDB MCP is inspection-only`. The two are consistent and the shared number is coincidental: that ADR bars agents from raw SQL, and the KAE MCP server is the sanctioned path it implies.

## Phasing against actual capability

Sequencing is governed by `../planning/CAPABILITY_MATRIX.md`. The proposed "read-only first" phase is not uniformly cheap.

### Phase 0 — available on today's KAE-Memory

`kae_list_projects`, `kae_get_project_briefing`, `kae_search_project_knowledge`, `kae_get_open_decisions`, `kae_get_implementation_readiness` (project scope), plus knowledge trace. All map onto capabilities that exist and are tested.

This validates transport, authentication, tool-surface design, and agent ergonomics **before** any structural Memory work. It is the cheapest useful thing in the whole plan.

### Phase 1 — needs the structural gaps

`kae_get_module_context` and module-scoped readiness require relationship write and traversal, scoped readiness, and bounded context assembly.

### Phase 2 — controlled contribution

`kae_submit_evidence` (needs idempotent ingestion), `kae_propose_knowledge_change`, `kae_record_decision`, `kae_record_action_item`.

### Phase 3 — purpose-bounded context

Module implementation, integration, UI, testing, and change-impact assemblies.

### Phase 4 — delivery recording and distribution

`kae_record_delivery` (needs artifact and publication records), then the installed developer package: MCP configuration, `AGENTS.md` / `CLAUDE.md` templates, Cursor rules, `.kae/project.yaml`, workflow prompts, and a setup/diagnostic command. CLI and editor extensions follow; MCP comes first because it is the shared foundation.

## Effect on KAE-Studio

- Studio is one client among several. Its Memory client and the MCP tool surface should converge on the same product-neutral operations.
- The published context package (ADR-0003) remains valuable and is not replaced: files serve humans, review, and version control; MCP serves live agent context.
- The `agents/` directory in the package should reference the MCP binding rather than pretending to be the only context source.
- Studio must expect knowledge authored by agents, not only by users. The Reviews view becomes the place where agent-proposed discoveries are confirmed or rejected.
