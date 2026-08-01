# ADR-0004: MCP is the agent access layer, and it belongs with KAE-Memory

- Status: Accepted direction
- Date: 2026-08-01
- Relates to: ADR-0001 (service separation), ADR-0002 (project model), ADR-0003 (publishing targets)

## Context

The context package (ADR-0003) delivers project definition to coding agents as generated files. That is a one-time export: the moment the definition changes, every published file is stale, and nothing carries discoveries made during implementation back into the project definition.

Coding agents — Claude Code, Cursor, VS Code, Codex — already support the Model Context Protocol, which defines three relevant concepts: **resources** (readable context), **tools** (structured operations), and **prompts** (discoverable workflow templates). Building separate integrations for each agent would mean maintaining N adapters for one capability.

One MCP service exposing KAE capabilities serves all of them.

## Decision

**Build one KAE MCP service, and treat it as a third access mode alongside Studio's UI and the published packages.**

```text
KAE-Studio      Human-led project discovery and definition
KAE MCP         Agent access to durable project context and operations
KAE-Memory      Authoritative knowledge, provenance, continuity, readiness
```

### 1. The MCP service belongs with KAE-Memory, not KAE-Studio

This is the substantive architectural point, and it follows directly from the ownership rule established when the capability matrix was written:

> Memory where the need is durable engineering knowledge; Studio where the need is interaction, presentation, configuration, or external delivery.

Every MCP tool in the proposed surface — `kae_get_module_context`, `kae_get_implementation_readiness`, `kae_submit_evidence`, `kae_record_decision`, `kae_assemble_context`, `kae_record_delivery` — reads or writes durable engineering knowledge. **None of them is interaction, presentation, or configuration.** An MCP server living in Studio would have to proxy Memory for all of it, which is a second API boundary with no owner of its own semantics.

The MCP surface must be **product-neutral**: it serves Studio, a CLI, an IDE extension, or any other agent equally. That is the same test already applied to every Memory API.

Consequence: `kae-mcp` is implemented in the KAE-Memory repository (or as a thin separate service over Memory's versioned API), and KAE-Studio is a *peer client* of the same platform — not the owner of agent access.

### 2. Surface: engineering actions, not storage operations

Expose what an engineer or agent wants to accomplish, never how Memory physically stores it.

Forbidden: `insert_knowledge_row`, `update_revision_table`, `assign_area_internal`, `run_sql`, `set_readiness_weight`. **The MCP gateway never accepts arbitrary SQL and never exposes database credentials.**

Resources are addressed as `kae://projects/{project_id}/...` — briefing, definition, requirements, modules, dependencies, architecture, interfaces, open-decisions, readiness, change-impact.

Tools start deliberately small (read: list projects, briefing, module context, search knowledge, open decisions, readiness; write: submit evidence, propose knowledge change, record decision, record action item, assemble context, record delivery) and grow only as capability lands.

Prompts package standardized workflows: `/kae.start-discovery`, `/kae.define-module`, `/kae.prepare-integration`, `/kae.review-requirements`, `/kae.prepare-implementation`, `/kae.record-development-results`, `/kae.review-change-impact`.

### 3. KAE does not become a coding agent

The coding agent owns local repository inspection, file editing, test execution, and commits. KAE owns project context, readiness, and the record of what was implemented. KAE does not reproduce filesystem, terminal, Git, or editing capability.

### 4. Agent contributions are proposals

Anything an agent submits — a discovered requirement, a contradiction found during implementation, a recorded decision — enters as **proposed** knowledge with provenance identifying the agent and the Memory revision it was working from. It is subject to the same confirmation rules as any other proposed knowledge. An agent cannot silently change the project definition.

This is the existing lifecycle model applied to a new class of author, not a new mechanism.

### 5. Two transports, one surface

**Remote** (Streamable HTTP, bearer token or OAuth) for hosted customers and remote development environments. **Local** (`kae-mcp-local`, STDIO transport) for offline work, private networks, local Memory instances, and protected environments. The local bridge calls the KAE API; it does not touch Memory tables directly.

### 6. Repository binding

A repository carries a small, **non-secret** `.kae/project.yaml` identifying the project, module, endpoint profile, context policy, and delivery-recording preferences. No tokens or provider keys. Agent instruction files (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`) express the same policy in each agent's idiom: read the binding, retrieve current context through MCP, identify blocking decisions, **do not invent missing requirements**, submit discoveries to KAE rather than changing the definition locally, and record results afterwards.

These files help agents behave consistently. They do not replace MCP.

### 7. Security

Scope tokens by user, organization, project, and operation. Separate read tools from write tools. Require approval for knowledge changes, decisions, and publication. Log tool operations with their project and revision associations.

**Treat content retrieved from repositories, uploaded files, and agent submissions as untrusted input.** MCP servers are a known prompt-injection surface: a requirement submitted by an agent, or text read out of a repository, may contain instructions aimed at the model. Such content is data to be recorded, never instruction to be followed.

## Consequences

### Positive

- One integration serves Claude Code, Cursor, VS Code, and Codex.
- Agents fetch the *current* context on demand instead of reading a stale export.
- The loop closes: discoveries and implementation results return to Memory with provenance.
- KAE-Memory's platform identity is reinforced — it becomes genuinely reusable rather than Studio's backend.
- Studio's own Memory client and the MCP surface converge on the same product-neutral operations, so the contract gets exercised twice.

### Costs

- KAE-Memory gains a second delivery surface to version, secure, and contract-test.
- Authentication and tenancy — already an open item — become urgent rather than deferrable, because external agents connect directly.
- Prompt-injection and authorization risk enter through a new door.
- Recording delivery results requires artifact and publication records, which do not exist yet.
- Distribution work: a local bridge, templates, and setup tooling to maintain.

### Sequencing consequence

The proposed Phase 1 "read-only MCP" is **not uniformly cheap**. Against the capability matrix:

- `kae_list_projects`, `kae_get_project_briefing`, `kae_search_project_knowledge`, `kae_get_open_decisions`, `kae_get_implementation_readiness` (project scope) map onto capabilities KAE-Memory **has today**.
- `kae_get_module_context` and module-scoped readiness require the three structural gaps — relationship write/traversal, scoped readiness, bounded context assembly.
- `kae_record_delivery` requires artifact and publication records, which are absent entirely.

So there is a genuine **Phase 0**: an MCP server over what Memory already provides — projects, briefing, knowledge search, findings, project readiness, trace. That is demonstrable without any structural change, and it validates the transport, auth, and tool-surface decisions before the expensive work begins.

## Rejected alternatives

**Per-agent integrations.** Rejected: N adapters for one capability, diverging over time.

**MCP server in KAE-Studio.** Rejected: every tool in the surface is durable engineering knowledge, so Studio would proxy Memory for all of it and own none of the semantics. It would also make agent access dependent on the product UI, contradicting product-neutrality.

**Exporting Markdown only.** Not rejected — retained as ADR-0003. But files alone make KAE a one-time requirements generator; MCP is what makes it a persistent engineering coordination platform. The two are complementary: packages for humans, review, and version control; MCP for live agent context.

**Exposing Memory's internal methods as tools.** Rejected: it couples every client to physical storage and produces an unusable tool surface.

**Letting agents write confirmed knowledge directly.** Rejected: an agent's conclusion is evidence, not authority.

## Follow-up decisions

- Which repository hosts `kae-mcp`, and whether it is in-process with the Memory API or a separate service.
- Authentication mechanism for the first private demonstration (PAT) and the hosted product (OAuth).
- Tenancy model — currently an open item across the whole system.
- Whether Studio's `kae_memory_client` and the MCP tool surface share a generated definition.
- Local bridge distribution: CLI, npm package, or extension.
