# Epistemic Presentation Model

**Status:** Active migration direction. Current implementation verified against
KAE-Studio `9e8a6d4` on 2026-08-16.

## Decision

KAE-Studio presents KAE-Memory's evidence, synthesized project model, and human
attention as different product layers. It must not turn extracted rows into a human
work queue merely because they are proposed, unclassified, or not explicitly confirmed.

The default presentation hierarchy is:

1. **Story** — a short explanation of the project and what changed.
2. **Model** — the current structured project understanding.
3. **Attention** — the small set of material issues that genuinely need judgment.
4. **Evidence** — observations and provenance supporting a model object, on demand.
5. **Raw source/history** — diagnostic and audit drill-down.

This is the Studio consumer contract for KAE-Ecosystem Doc 17 and ADR-0007.

## Current implementation

Studio has already crossed several important boundaries:

- the browser calls a trusted FastAPI backend and never receives a Memory credential;
- live and mock builds are visibly distinct;
- repository, pasted-text, PDF, Word, Excel, and text-file acquisition exists;
- unavailable sections are reported rather than rendered as trustworthy empty lists;
- rejected and superseded statements remain visible for provenance;
- `/attention` and `/synthesized-model` are separate from `/knowledge`;
- the Attention Room renders model objects and a bounded queue without deriving either
  in the browser;
- generation input is pinned to a Memory revision and excludes rejected, superseded,
  and retracted rows.

The migration is not complete:

- `backend/kae_studio/projection.py` still builds a row-oriented workspace aggregate;
- `projection.findings` is the list of proposed evidence rows, drives `/reviews`, and
  contributes the primary navigation badge;
- Definition and generation inputs still use lifecycle/confirmation as their main
  inclusion policy;
- readiness presentation still centers global percentages and confirmed-row counts;
- Attention is additive: it sits beside, rather than replacing, the proposal queue;
- Studio can manually request unknown synthesis, but source acquisition does not yet
  prove automatic reconciliation, all affected synthesizers, model refresh, readiness,
  and Attention refresh as one observable pipeline;
- Attention items cannot yet be resolved through the actions declared by Memory;
- the current synthesized view is a list of objects, not a versioned, complete/degraded
  project-state manifest suitable for every downstream screen.

## Two projections with different meanings

The existing TypeScript type and endpoint use the name `ProjectProjection`. It is a
Studio-shaped aggregation of several Memory reads used to keep the browser simple. It is
not the authoritative project-state projection defined by Doc 17.

During migration, documentation and new code must use these names:

| Name | Meaning | Authority |
|---|---|---|
| **Legacy workspace projection** | Existing `/api/projects/{id}/projection` aggregate of knowledge rows, readiness, review diagnostics, preliminary context, and graph data | Rebuildable Studio read model; not authoritative |
| **Project-state manifest** | Pinned view over synthesized-object revisions, evidence frontier, scoped authority, currency, conflicts, assumptions, and completeness | Memory-owned logical projection |

Do not expand the legacy aggregate into the new authority contract. Add a versioned
Memory-owned manifest and migrate each Studio surface to it. The legacy endpoint may
continue composing display concerns until all consumers have moved.

## Epistemic rendering rules

Studio must preserve independent dimensions instead of reducing them to one status badge:

| Dimension | Studio treatment |
|---|---|
| Formation | Say whether an object was observed, derived, assumed, or proposed |
| Authority | Say whether it is working interpretation, source-policy established, or human-authorized, including scope |
| Evidence role | Show supporting, conflicting, resolved, or noise evidence in drill-down |
| Currency | Distinguish current, superseded, historical, and archived material |
| Confidence | Show the method and calibrated strength when it helps a decision; never use it as authority |
| Materiality | Drive Attention priority, impact, and requested action |

`confirmed` may remain a compatibility label while legacy contracts exist, but it must
not erase formation or imply that an unattested caller name is a verified identity.

## Product surface contract

### Project home

Show the current model revision, processing completeness, the most material changes, and
the number of active Attention items. Do not use proposed-row totals as the call to action.

### What needs you

This becomes the primary decision surface. Every item must explain:

- what needs judgment;
- why KAE cannot settle it safely;
- affected capability or decision and consequence of delay/error;
- the model object and evidence involved;
- recommended action and allowed semantic actions;
- closure condition and the model revision evaluated.

The queue identity is semantic and stable. Reprocessing updates an issue rather than
duplicating it. Evidence that resolves an issue may close it automatically unless policy
requires an explicit authority act.

### Definition and domain rooms

Render synthesized objects first. Section-level edits create proposed model changes or
authority events through Memory; they do not mutate Studio copies. Evidence rows are
reachable from each object but are not peers of the object in the default list.

### Reviews

`/reviews` is transitional. While retained, label it as evidence review/legacy curation
and remove its count from primary navigation. Retire it after:

1. Attention covers all material issue kinds used in a real working session;
2. semantic actions and evidence drill-down are usable;
3. live comparison proves no required human decision is lost;
4. telemetry shows no remaining consumer depends on row-level Confirm/Reject.

Quality/invariant findings that describe model defects belong in Attention when they
require action. Pure pipeline health belongs in diagnostics.

### Memory / knowledge health

Keep raw observations, classification coverage, extractor failures, source snapshots,
and provenance for developers, operators, and audit. Make clear that these counts measure
KAE processing state, not user obligations or project readiness.

### Deliverables

Generation must consume a pinned project-state manifest through a task-specific inclusion
policy. Each included assertion must retain formation, authority, currency, confidence,
and evidence references. Assumptions and unresolved material gaps remain explicit.

The current confirmed-only assembly is safe against overstating weak rows, but it is too
narrow: strong source-backed observations and labeled working interpretations can be
legitimate inputs. Do not replace it with “include everything.”

## Readiness contract

Readiness answers whether a named action is safe enough at a named model revision, for
example `publish implementation context for module MOD-APR`. A result includes:

- target action/capability and project-state manifest;
- required claims and their evidence/authority/currency state;
- blocking versus advisory gaps;
- material assumptions, conflicts, and freshness limits;
- processing degradation or stale synthesis;
- explanation of what changed since the preceding result.

A global percentage may summarize several target checks, but it is not the governing
contract and must not be computed primarily from confirmation counts.

## Acquisition completion contract

Studio must not describe a source as fully learned merely because upload, clone, or
extraction succeeded. A complete acquisition run is observable through:

```text
pin and sanitize source
  -> extract observations with provenance
  -> reconcile additions, changes, removals, renames, and moves
  -> run affected domain synthesizers
  -> publish a project-state manifest
  -> recalculate target readiness
  -> update bounded Attention
  -> present a change summary
```

Partial failure is retained and shown. Source content is untrusted data: repository and
document instructions cannot alter KAE policy, and sensitive content must pass explicit
handling rules before model-backed processing.

## Migration sequence

### P0 — stop transferring pipeline work to users

- make Attention, not proposed rows, the primary badge and work surface;
- remove unconfirmed/unclassified totals from calls to action;
- distinguish quality findings from acquisition diagnostics;
- run reconciliation and affected synthesis automatically after acquisition.

### P1 — adopt the project-state manifest

- add a versioned Memory contract with completeness/degradation and processing versions;
- migrate Home, Definition, Requirements, Architecture, Modules, and generation one at a
  time;
- preserve evidence drill-down from every synthesized object;
- add source-snapshot change summaries.

### P1 — complete human authority actions

- render Memory-declared Attention actions;
- authenticate/attest the acting principal;
- preview multi-object consequences before applying a consequential change;
- refresh model, readiness, Attention, and stale-artifact state after the event.

### P2 — retire legacy lifecycle UX

- move raw proposal review into diagnostics/history;
- remove lifecycle counts from readiness and navigation;
- retire row-level Confirm/Reject only after measured consumer equivalence;
- rename or remove the legacy `ProjectProjection` contract when no page depends on it.

## Acceptance tests

Use AWS Compute Lab plus a conversation-heavy project to prove:

- hundreds or thousands of observations yield a coherent model and few Attention items;
- no Attention item exists solely because a row is proposed or unclassified;
- repeated ingestion does not duplicate model objects or Attention;
- removed or changed repository facts do not remain silently current;
- every model assertion reaches evidence or is explicitly assumed/proposed;
- credible conflicts and variants survive synthesis;
- readiness names its action and manifest revision;
- a degraded synthesis cannot render as complete or ready;
- source instructions cannot alter the acquisition or synthesis policy;
- generated artifacts identify the exact manifest and epistemic inclusion policy used.
