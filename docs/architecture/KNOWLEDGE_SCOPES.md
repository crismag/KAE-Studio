# Knowledge Scopes

Status: approved direction (ADR-0005). Design record. **Implementation belongs with KAE-Memory** — captured here because it changes what Studio retrieves, presents, and curates.

## The insight

Developing KAE produced reusable software-development knowledge, not just one application's requirements. That knowledge is currently trapped in planning documents. KAE-Memory should be able to remember it.

That requires knowledge to exist at more than one scope.

```text
KAE-Memory
├── Project memory          knowledge about one project
├── Organization memory     knowledge shared across a team's projects
├── Engineering methodology how development should be defined
├── Reusable pattern library concrete solution and process patterns
└── KAE product self-memory KAE's own definition, remembered by KAE
```

## The four scopes

### Project memory

Applicable to one project. Everything KAE-Memory stores today.

> Ministry Reporting requires approval before publication.
> Approval Workflow depends on Identity Management.
> The approver role remains undecided.

### Organization memory

Applicable across a team's projects.

> The organization uses AWS for hosted application services.
> Generated artifacts normally go through draft pull requests.
> Security reviews are required before production deployment.

Organization knowledge informs new projects without being re-elicited. It is a default, not a law: a project may override it, and the override is itself knowledge worth recording.

### Engineering methodology

Knowledge about *how development should be defined* — the standard a definition must meet.

```text
An integration definition must identify:
  initiator; system of record; protocol; authentication;
  data ownership; failure behavior; retry responsibility;
  versioning; observability; acceptance criteria.
```

This is what makes the typed interviews in `../product/DISCOVERY_INTERVIEWS.md` curated rather than improvised. Today those question banks are prose in a document; as methodology knowledge they become versioned, traceable, and improvable from experience.

### Reusable pattern library

Concrete solution and development patterns with applicability conditions. See `../methodology/PATTERN_LIBRARY.md`.

### KAE product self-memory

KAE's own project definition, held in KAE.

> KAE-Studio is an intelligent client of KAE-Memory.
> KAE-Memory remains the authoritative engineering record.
> MCP exposes KAE capabilities to coding agents.
> Studio must not duplicate Memory-owned conversations or knowledge.

This is dogfooding in the strongest sense: **KAE should become the first project completely defined and continuously remembered by KAE.** It is also the honest test — if KAE cannot hold its own definition usefully, it will not hold anyone else's.

Note the bootstrapping order: this document set is the seed. Self-memory begins by ingesting these documents as evidence once ingestion exists, not by waiting for the product to be finished.

## What the code says today

Verified at commit `de37cc4`:

- **`project_id` is mandatory on every domain entity** — knowledge items, relationships, provenance links, sessions, messages, runs, area links, blockers, readiness snapshots, chunks.
- **No organization, tenant, or cross-project concept exists anywhere** in the domain or the physical schema.
- **Vector search is hard-filtered by project**: `WHERE project_id = :project_id` in `persistence/chunk_repository.py:157`.

The last point matters most. Semantic retrieval is precisely the mechanism a pattern library needs — "this problem resembles these known patterns" — and it currently cannot see beyond one project by construction.

**Consequence: knowledge scopes are a structural change touching every entity, not an additive one.** This is the largest single item in the whole plan and must be sequenced deliberately, not slipped in.

## Design constraints

**Scope is an attribute of knowledge, not a separate store.** Versioning, provenance, lifecycle, confirmation, and contradiction detection must work identically at every scope. A pattern is proposed, confirmed, contradicted, and superseded exactly as a requirement is. Building a second mechanism for methodology would duplicate the engine.

**Resolution order is project → organization → methodology.** More specific scope wins. When a project contradicts organization knowledge, that is a recorded, provenance-bearing override — not an error, and not a silent shadow.

**Cross-scope retrieval must be explicit and bounded.** An agent asking for module context must not receive the organization's entire accumulated experience. Retrieval declares which scopes it spans, and the assembly records which it used.

**Promotion is a reviewed act, never automatic.** Project knowledge does not drift upward into organization knowledge or methodology because it appeared twice. See the extraction workflow in `../methodology/PATTERN_LIBRARY.md`.

**Tenancy becomes unavoidable.** Organization scope means knowledge shared across projects but *not* across customers. Combined with ADR-0004 exposing the platform to external agents, authentication and tenancy can no longer be deferred.

## The product argument

Other AI development tools begin each project with general software knowledge. KAE begins with general intelligence **plus** the team's accumulated, traceable engineering methodology and every relevant lesson from previous projects.

The division is worth stating precisely, because it is easy to overclaim: **the AI provider supplies reasoning and language capability. KAE-Memory supplies curated engineering experience, history, project truth, and reusable patterns.** The database does not train the model. It supplies better context to it, with provenance, and lets a team's judgement accumulate instead of evaporating.

## Effect on KAE-Studio

- Retrieval and context assembly become scope-aware; Studio must say which scopes informed an answer.
- A curation surface is needed: propose, review, approve, version, and retire organization knowledge, methodology, and patterns. This is interaction and presentation, so it is Studio's.
- Interviews can cite the methodology they are following — "I'll use the integration-definition pattern" — which is both better UX and an auditable claim.
- Project Health can distinguish "undefined" from "defaulted from organization knowledge."
- Self-memory means Studio's own Reviews view will, eventually, be where KAE's development decisions get confirmed.
