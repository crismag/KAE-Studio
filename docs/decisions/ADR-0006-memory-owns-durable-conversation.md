# ADR-0006: KAE-Memory owns durable projects, sessions, and messages

- Status: Accepted direction
- Date: 2026-08-01
- Supersedes: the conversation-ownership statements in ADR-0001, `SYSTEM_BOUNDARY.md`, and `DATA_OWNERSHIP.md`. **It does not reverse the repository separation.**

## Context

ADR-0001 assigned "conversation sessions and ordered messages" to KAE-Studio, written before anyone had audited what KAE-Memory actually contained.

The capability matrix established from code that KAE-Memory already owns all of it: `ProjectRow`, `SessionRow`, `MessageRow` with sequence numbers, actor and message types, the workspace API (`POST /projects`, `POST /projects/{id}/sessions`, `POST /sessions/{id}/messages`, `GET /sessions/{id}/messages`), and `ProvenanceLink.message_id` binding knowledge to the exact message that produced it.

Studio's documents nevertheless still proposed `kae_studio.app.projects`, `kae_studio.conversation.sessions`, and `kae_studio.conversation.messages`, and the implementation directive instructed an implementer to "add Studio-owned project/session/message persistence."

That is duplication of a verified, tested capability. Worse, it is duplication of the *provenance spine*: if Studio holds the authoritative message and Memory holds a copy as evidence, the two can diverge, and the chain from a generated statement back to what the user actually said stops being trustworthy. Traceability is the product's core claim.

The original justification was AC-03: a user's message must survive when Memory is unavailable. That is a real requirement, and it is satisfied by transient operational state — not by a second durable conversation record.

## Decision

**KAE-Memory owns the durable conversation.**

```text
KAE-Memory
├── projects
├── sessions
├── user messages
├── assistant messages
├── evidence
├── knowledge
└── revisions
```

**KAE-Studio owns interface and configuration state only.**

```text
KAE-Studio
├── unsent composer drafts
├── panel and layout state
├── interface preferences
├── provider selection
├── prompt and interview configuration
├── delivery-target configuration
└── temporary request and retry state
```

### The corrected interaction

```text
Studio
    -> submit message through the KAE-Memory API
    -> invoke the configured AI provider
    -> store the relevant assistant response through the KAE-Memory API
    -> request extraction/review
    -> retrieve the updated project projection
```

### On the outbox

An outbox or pending-send buffer may exist for reliability when Memory is unreachable. It is **temporary operational state**: it holds a message that has not yet been accepted, it is cleared once Memory acknowledges, and it is never read as project history.

**It must not become a second durable conversation record.** The test: if Studio's store were deleted after every message is acknowledged, nothing of the project's history is lost. If that is not true, the outbox has become a duplicate store and the boundary has failed.

### Interview state

Which questions were asked, answered, deferred, or superseded is **durable engineering memory** and belongs with Memory (capability-matrix section B, an identified structural gap). It is what prevents restarting the interview across sessions *and across clients* — an MCP agent must see the same discovery state Studio does.

Studio owns interview *presentation*: which type is active in this session, how a question is phrased, and how it appears in chat.

## Consequences

### Positive

- One authoritative conversation. The provenance chain from artifact statement to user utterance cannot diverge.
- Studio's persistence requirements shrink dramatically — possibly below the threshold that justifies its own database (see the revised `DATA_OWNERSHIP.md`).
- MCP agents and Studio see the same conversation and the same discovery state. Continuity across clients — MCP-M1's Demo D — becomes structural rather than something to reconcile later.
- Memory's existing, tested workspace API is used rather than reimplemented.

### Costs

- Studio depends on Memory for a core interaction. When Memory is down, Studio can accept and hold a message but cannot show history.
- AC-03 must be re-expressed against transient state rather than a durable Studio table.
- Assistant responses now round-trip through Memory, adding latency to the visible chat.
- Studio needs an explicit unavailable-state design: what the user sees, what they can still do, and how a queued message is presented without claiming it was remembered.

### Accepted risk

Availability coupling is real and deliberate. The alternative — a durable Studio conversation store — trades it for divergence risk in the provenance spine, which is the more expensive failure for this product.

## Rejected alternatives

**Studio owns durable conversation; Memory holds evidence copies.** Rejected: two records of what the user said, able to diverge, undermining traceability.

**Dual-write to both stores.** Rejected: no distributed transaction spans the services, so this guarantees divergence under partial failure.

**Memory owns messages; Studio caches them durably for offline reading.** Not rejected outright, but deferred as an optimization. A cache is acceptable if it is rebuildable and records the revision it reflects — it must never be written to first.

## Consequential edits

- `architecture/SYSTEM_BOUNDARY.md` — ownership lists corrected.
- `architecture/DATA_OWNERSHIP.md` — `conversation` schema removed; Studio's database downgraded to a deferred option.
- `planning/IMPLEMENTATION_DIRECTIVE.md` — Studio-owned project/session/message persistence removed.
- `planning/CAPABILITY_MATRIX.md` — finding 6 resolved by this ADR.
