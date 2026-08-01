# ADR-0005: Knowledge scopes and the reusable pattern library

- Status: Accepted direction
- Date: 2026-08-01
- Relates to: ADR-0002 (project model), ADR-0004 (MCP access layer)

## Context

Defining KAE produced reusable software-development knowledge alongside one application's requirements: engine/product separation, the conversation → evidence → knowledge → deliverable distinction, scoped readiness, publication-target abstraction, one shared agent interface, and the discovery-return loop.

That knowledge currently exists only as prose in planning documents. It is not versioned as knowledge, not traceable to the decisions that produced it, not retrievable when a later project faces the same problem, and not improvable from outcomes.

KAE-Memory stores knowledge about *one project*. Verified at commit `de37cc4`, `project_id` is mandatory on every domain entity, no organization or tenant concept exists, and vector search is hard-filtered `WHERE project_id = :project_id` (`persistence/chunk_repository.py:157`). Cross-project knowledge is not merely unimplemented — it is excluded by construction, including in the retrieval mechanism a pattern library would depend on.

## Decision

**KAE-Memory holds knowledge at multiple scopes: project, organization, engineering methodology, reusable patterns, and KAE product self-memory.**

1. **Scope is an attribute of knowledge, not a separate store.** Versioning, provenance, lifecycle, confirmation, and contradiction detection work identically at every scope. Building a second mechanism for methodology would duplicate the engine.
2. **Resolution order is project → organization → methodology**, most specific winning. A project contradicting organization knowledge is a recorded override with provenance, not an error.
3. **Patterns are structured records**, not advice: problem, context, forces, solution, applicability, consequences, failure modes, **exceptions**, related patterns, examples, evidence, confidence, status, version, superseded-by. See `../methodology/PATTERN_LIBRARY.md`.
4. **A pattern with no stated exceptions is incomplete.** KAE must record when a pattern should *not* apply, or it will recommend architecture by habit.
5. **Promotion is reviewed, never automatic.** Reusability is proposed as a candidate and approved by a human. Repetition is not evidence of generality.
6. **Outcomes feed back.** Applying a pattern records an outcome against it; confidence is revised from experience. Without this the library only accumulates opinions.
7. **Cross-scope retrieval is explicit and bounded.** Assemblies declare which scopes they span and record which they used. An agent requesting module context does not receive the organization's accumulated experience.
8. **KAE uses itself.** KAE's own definition becomes project memory in KAE, seeded by ingesting this document set as evidence.
9. **Curation is Studio's; storage is Memory's.** Proposing, reviewing, approving, versioning, and retiring patterns is interaction and presentation. The records are durable engineering knowledge.

## Consequences

### Positive

- The team's engineering judgement accumulates instead of evaporating between projects.
- Interviews become curated and auditable: KAE can name the methodology it is applying, which model recall cannot.
- New projects start with organization defaults rather than re-eliciting settled ground.
- Self-memory is the honest test — if KAE cannot usefully hold its own definition, it will not hold anyone else's.
- The product argument becomes concrete: other tools start each project with general software knowledge; KAE starts with general intelligence plus traceable accumulated methodology.

### Costs

- **This is the largest structural change in the plan.** Every domain entity, every repository query, and the retrieval path assume a mandatory `project_id`. Scoping touches all of them.
- Cross-project semantic retrieval requires changing the hard project filter in vector search — the one place where an error leaks one customer's knowledge into another's project.
- **Tenancy and authorization become blocking.** Organization scope means knowledge shared across projects but not across customers. With ADR-0004 exposing the platform to external agents, this can no longer be deferred.
- Curation is ongoing human work. An unmaintained pattern library becomes stale advice presented with false authority — worse than none.
- Real risk of over-reach: a library that recommends by habit, or an interview that forces a pattern onto a project it does not fit.

### Sequencing

Nothing here is required for a first demonstrable Studio slice, and attempting it early would destabilise work that is already well-founded. The correct order:

1. Deliver project-scoped capability (the existing capability-matrix sequence).
2. Settle tenancy and authorization — forced by ADR-0004 regardless.
3. Introduce scope as an attribute, project-scope-only at first, changing nothing observable.
4. Add organization scope and resolution order.
5. Add pattern records and curation.
6. Add cross-scope retrieval, with the project-isolation boundary explicitly tested.
7. Add outcome recording and confidence revision.

Meanwhile the seed patterns are recorded in `../methodology/PATTERN_LIBRARY.md` so they survive until storage exists.

## Rejected alternatives

**Keep patterns as prose in documentation.** Rejected: not versioned, not traceable, not retrievable at the moment of need, not improvable from outcomes. It is what this repository does today, and the reason the ADR exists.

**A separate methodology store.** Rejected: it would duplicate versioning, provenance, lifecycle, and retrieval — the whole engine — for knowledge that behaves identically.

**Automatic promotion of recurring decisions.** Rejected: recurrence is not generality. Two projects sharing a decision may share a constraint, a team habit, or a mistake.

**Storing patterns without applicability conditions.** Rejected explicitly. This is what turns a pattern library into cargo-culting, and it is the failure mode most likely to discredit the product with experienced engineers.

**Claiming the accumulated knowledge improves the model.** Rejected as a product claim. The provider supplies reasoning and language; KAE supplies curated context with provenance. Overclaiming here would be both false and unnecessary — the honest version is already the differentiator.

## Follow-up decisions

- Tenancy model, and how organization scope maps onto it.
- Whether methodology and patterns are one scope or two.
- How pattern outcomes are measured without turning delivery into surveillance.
- Whether the seed patterns are ingested as evidence or authored directly as confirmed knowledge when self-memory begins.
