# Attention — what needs you

Route: `/attention`

## Purpose

Put the few things synthesis decided are worth a person's time in front of that
person, and the model those things were drawn from beside them.

`ADR-0007` separates three layers: extracted observations, the synthesized project
model, and human attention. `/reviews` exposes the first as legacy curation — every sentence KAE read,
awaiting a decision, which on the owner's own project is 803 rows. This Room is
the other two. The whole package exists because a consumed repository became a
backlog, and a queue nobody can finish is the shape of that failure.

The governing cross-Room migration is
[`docs/architecture/EPISTEMIC_PRESENTATION_MODEL.md`](../../../../docs/architecture/EPISTEMIC_PRESENTATION_MODEL.md).

## Entry conditions

A project exists. Nothing else — an unsynthesized project is a legitimate state
and says so rather than rendering an empty list as an all-clear.

## Contextual toolbelt

**Look again** — produce the queue from the project's current unknowns
(`POST /api/projects/{id}/attention/runs`). Pressing it twice on unchanged
knowledge leaves the same queue: Memory synthesizes again and upserts by
identity key, so the **result** is stable. It does not skip the work, and the
key it is given only makes the two presses one recorded change event.

The report that run returns is shown while it is in hand: what was considered,
what was already answered elsewhere, how many themes it formed, and — under a
disclosure — the themes it deliberately **withheld**. Memory reports those for a
reason, and dropping them here would leave the first question anybody asks of a
short queue unanswerable from the interface.

## Exit conditions

The person has read what needs them. Acting on an item happens where the subject
lives — a material unknown is answered by discussing it in the Workspace, not by
a control here.

## Owns

- `AttentionRoom.tsx` — the Room, the queue, the model list and the run report.
- `attentionQueueIsNotTheProposalList.test.tsx` — the guard that keeps this Room
  reading the attention layer rather than the evidence one.

Nothing outside this folder imports either.

## Does **not** own

**Resolving an attention item.** Memory has `POST /attention/{id}/resolve` and
this Room does not call it. Which gestures an item accepts is carried on the
item itself, so a Confirm and a Reject invented here would be buttons whose
meaning the backend refuses. Turning `actions` into controls is `SYN-4`, and it
needs the card anatomy that row specifies.

**The legacy proposal queue.** `/reviews` keeps every proposed row and its Confirm and
Reject gestures, unchanged. `ADR-0007` marks that queue transitional and
`OD-SYN-3` keeps it until equivalence is shown on live data plus one working
session — restyling it into this is precisely the failure the synthesis package
was opened to avoid.

**Producing the model.** Goals, themes and their clustering are KAE-Memory's,
and this Room asks for a run without knowing how one is decided. The radius, the
linkage and the attention bound are Memory's judgement and Studio renders their
result rather than second-guessing it.

**Ranking.** Items arrive in Memory's order. Re-sorting here would put Studio's
idea of what matters above the engine that computed it (`SYN-11` owns the
ranking proper).

## Services

- `SynthesisPort.listAttention` — the queue.
- `SynthesizedObject` list via `SynthesisPort.listSynthesizedModel`.
- `SynthesisPort.runUnknownSynthesis` — the only route that produces the queue.

That last statement describes the current Studio port, not the complete Memory domain
synthesis capability.

## States

- **pending** — skeletons, per panel.
- **failed** — `QueryState` names what failed and offers a retry.
- **empty** — distinguishes *nothing is material* from *nothing has run*, which
  are different facts and only one of them is good news.
- **loaded** — the queue, the model, and the last run's report if there was one.

## Test entry points

- `attentionQueueIsNotTheProposalList.test.tsx`
- `backend/tests/test_attention_is_not_the_proposal_list.py` — the same rule one
  hop lower: the proxy reads `/attention` and never `/knowledge`, and the run
  report crosses whole.
- `src/services/portParity.test.ts` — the port ships with both adapters or not.
- `src/app/registries/registries.test.ts` — the surface has a page.
- `src/app/registries/navigability.test.ts` — why this is a sixth primary
  destination, and what has to happen for it to go back to five.
