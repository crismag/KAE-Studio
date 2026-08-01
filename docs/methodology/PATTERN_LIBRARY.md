# Reusable Pattern Library

Status: approved direction (ADR-0005). Design record plus the seed entries produced by KAE's own planning. **Storage belongs with KAE-Memory; curation is Studio's.**

## Why patterns need structure

Unstructured advice does not survive contact with a new project. "Separate the engine from the product" is useless without the conditions under which it is wrong.

A pattern record therefore carries: **ID · name · problem · context · forces and trade-offs · recommended solution · applicability conditions · consequences · failure modes · exceptions · related patterns · examples · evidence/source · confidence · approval status · version · superseded-by.**

```yaml
id: PAT-SERVICE-001
name: Product interface over reusable domain engine
problem: >
  Internal domain operations are becoming the primary user workflow.
context:
  - Domain engine supports multiple clients.
  - End users should not manage internal taxonomy.
solution: >
  Keep the engine authoritative and expose it through a versioned
  service contract. Build the product interface as an intelligent client.
consequences:
  positive:
    - independent reuse
    - clearer product experience
    - reduced data duplication
  negative:
    - API maintenance
    - eventual consistency
    - additional deployment boundary
applies_to:
  - KAE-Studio
  - multi-client platforms
evidence:
  - KAE-Memory UI evaluation
  - KAE-Studio boundary decision
status: confirmed
```

## Patterns are not universal laws

The most important field is the one that says when **not** to apply the pattern.

"Use separate logical databases for Studio and Memory" is right for KAE. It is not automatically right for a small indivisible application. A library that records only the conclusion, and not the circumstances that justified it, will recommend architecture by habit — producing exactly the cargo-culting that makes senior engineers distrust pattern catalogues.

Every pattern must therefore record: why the decision was made; what circumstances made it appropriate; which alternatives were considered; what disadvantages were accepted; and when it should not be applied.

**A pattern with no stated exceptions is incomplete, not universal.**

## Extraction workflow

An agent or user may propose: *"This decision appears reusable across projects."*

It enters as a **candidate**, never as approved methodology.

```text
Project decision
    -> candidate pattern (proposed, with evidence from the originating project)
    -> human review: is it reusable, and under what conditions?
    -> approved pattern at organization or methodology scope
    -> applied in later projects
    -> outcomes recorded against the pattern
    -> confidence revised, or the pattern superseded
```

The loop back matters as much as the promotion. A pattern that has been applied three times with poor outcomes should lose confidence, and KAE should be able to say so. Without outcome recording, the library only accumulates opinions.

This is the same lifecycle KAE-Memory already applies to knowledge — proposed, confirmed, contradicted, superseded — at a different scope. It is not a new mechanism.

## Using patterns during discovery

Retrieval is semantic, then filtered relationally: vector search finds candidates, and the relational structure decides which versions are approved, applicable, superseded, or organization-specific.

```text
Current problem:
  "Two systems exchange approval status asynchronously."

Candidate patterns:
  asynchronous integration contract
  idempotent consumer
  outbox delivery
  retry ownership
  status reconciliation
```

The resulting interview is materially better:

> **User:** We need Salesforce to send customer updates to our internal system.
>
> **KAE:** I'll use the integration-definition pattern.
>
> 1. Which system owns the authoritative customer record?
> 2. Is the update synchronous or queued?
> 3. What happens when the receiving system is unavailable?
> 4. Which system owns retry and duplicate detection?
> 5. How will contract versions be managed?

KAE is no longer relying on a general model to happen to remember good engineering questions. It is applying a curated, versioned, traceable methodology — and it can say which pattern it used, which is auditable in a way that model recall is not.

## Storage

CockroachDB holds pattern metadata, versions, applicability relationships, evidence and provenance, project-to-pattern usage, outcomes, confirmation status, embeddings for semantic retrieval, and relationships among patterns, requirements, modules, and decisions.

Note the dependency: cross-project semantic retrieval does not exist today — vector search is hard-filtered by `project_id`. See `../architecture/KNOWLEDGE_SCOPES.md`.

---

# Seed patterns

The eight patterns below emerged from KAE's own planning. They are the library's first candidates and are recorded here so they are not lost before storage exists. Each needs its exceptions field completed through review; the drafts below are a starting point, not an approved methodology.

## PAT-KNOW-001 — Conversation is not knowledge

```text
Conversation -> provides evidence -> extraction proposes knowledge -> review establishes current understanding
```

A user message must never automatically become an authoritative requirement.

**Avoid when:** the interaction is a transient command with no durable claim, where an evidence record adds ceremony without value.

## PAT-KNOW-002 — Knowledge is not a deliverable

```text
Evidence -> knowledge and relationships -> versioned context assembly -> rendered deliverable
```

Requirements documents and context packages are generated views of current knowledge, not the place knowledge lives.

**Avoid when:** the document genuinely *is* the artifact of record and no downstream system consumes its content structurally.

## PAT-SERVICE-001 — Product interface over reusable domain engine

Studio owns interaction; Memory owns durable engineering knowledge. The interface must not reproduce the engine's domain and persistence behavior.

**Avoid when:** the application is a small, indivisible system, or the service boundary adds no independent reuse or ownership. The boundary costs an API, eventual consistency, and a deployment surface — it must buy something.

## PAT-CONTEXT-001 — Agents consume scoped context

```text
Project memory -> task and module scope -> purpose-specific context assembly -> coding agent
```

Do not send complete project history to every agent. An agent implementing approval does not need every unrelated discussion.

**Avoid when:** the project is small enough that scoping costs more than it saves, or when narrowing scope would hide a genuinely cross-cutting constraint. Under-scoping is a real failure mode: an agent that never sees the security decision will violate it.

## PAT-LOOP-001 — Development discoveries return to memory

```text
Approved context -> implementation -> newly discovered constraint -> proposed memory update -> review -> revised context
```

Implementation is also a requirements-discovery activity. Development must not be a one-way export.

**Avoid when:** there is no review capacity — an unreviewed return path degrades the definition faster than no return path at all.

## PAT-READY-001 — Readiness is scoped

```text
Project readiness  ≠ module readiness
Module readiness   ≠ integration readiness
Requirements readiness ≠ implementation readiness
```

A module may be implementation-ready while the project remains substantially undefined.

**Avoid when:** a single scope genuinely describes the work, where multiple readiness figures would only obscure one honest number.

## PAT-DELIVERY-001 — Publication target abstraction

```text
Generated artifact -> GitHub | local workspace | S3
```

Generation and publication are separate operations. The destination does not determine artifact semantics.

**Avoid when:** there is exactly one destination and no prospect of another — the abstraction is then indirection without benefit.

## PAT-AGENT-001 — One shared agent interface

```text
Claude · Cursor · Codex · VS Code  ->  KAE MCP  ->  KAE-Memory
```

Do not build separate domain integrations when one standard interface serves several clients.

**Avoid when:** only one client will ever exist, or when a client's requirements diverge so far that the shared surface becomes a lowest common denominator serving no one well.

---

## Self-referential note

These patterns were extracted from KAE's own development. Under `KNOWLEDGE_SCOPES.md`, KAE's project definition and this library are both meant to live *in* KAE.

The honest sequence: these documents are the seed. Self-memory begins by ingesting them as evidence once ingestion exists — not by waiting for the product to be finished, and not by hand-maintaining a parallel copy in Markdown forever.
