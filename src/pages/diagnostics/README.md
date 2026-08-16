# Knowledge health

**Route:** `/diagnostics` · **Registry id:** `diagnostics`

Not a Room. Doc 17 rules that Studio must not present extraction and
classification counts as a person's work, and allows those same numbers to
remain available in an advanced **Knowledge Health / Diagnostics** view for
developers and operators. This is that view (`EPI-7`, `D-156`).

## Purpose

Show the pipeline's raw counts to somebody who wants the pipeline's raw counts,
in a place where they are explicitly not a to-do list and explicitly not a
measure of how the project is going.

## User questions it answers

- How many statements did extraction actually produce, and in what states?
- How many findings did a review produce, as opposed to proposed statements?
- How much of the sources was read, and how much was abandoned?
- Which classification engine read them, and was it degraded?

## Entry conditions

None. A project with nothing extracted opens here and reads zeroes, which are
real zeroes.

## Data it consumes

| Port         | For                                                                  |
| ------------ | -------------------------------------------------------------------- |
| `projection` | the pipeline counts, extraction coverage and classification state |

## Contextual toolbelt

Empty, and that is the contract rather than an omission: this surface performs
no action on the project. Nothing here confirms, rejects, re-runs or resolves.
A gesture on this page would make these numbers work again, which is the exact
thing `EPI-7` exists to stop.

## Empty, loading and degraded states

Loading · a projection carrying no extraction coverage, which is reported as
**unreported** rather than as nothing abandoned · a projection carrying no
classification state, reported the same way · an engine reported as degraded,
which says so alongside Memory's own sentence about its limits, unrewritten.

## Exit conditions

None. Nothing is completed here.

## Owns

`DiagnosticsPage.tsx`, and the `Figures` grid within it — nothing else imports
either. Its four panels — _Extracted statements_, _What a review found_,
_Reading the sources_ and _Classification_ — are all this page's.

## Does **not** own

- **The counts themselves.** They are `projectCounts()` over the projection, the
  same function the primary surfaces use. This page adds no arithmetic of its
  own and derives no figure — no score, no percentage, no ratio.
- **Removing those counts from anywhere else.** They still appear on Reviews,
  Requirements, Sources and the Dashboard. Which of them move here, and what
  each surface says in their place, is the second half of `EPI-7` and is
  deliberately not done by the existence of this page.
- **Memory's sentence about its own limits.** `classification.note` is rendered
  verbatim, never paraphrased on the way through.
- **Any judgement about health.** The title is doc 17's word for the view. The
  page states counts and never grades them.

## Transitions out

`/attention` for what synthesis decided is worth a person's time · `/reviews`
for the statements these counts are counting.

## Tests

`diagnosticsIsWhereRawCountsBelong.test.tsx` — that the page says these numbers
are not work, that findings stay distinct from proposed statements (`D-96`),
that absent coverage reads as unreported rather than as zero, and that no figure
on the page is one the projection did not carry.
