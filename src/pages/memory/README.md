# Memory

**Route:** `/memory` · **Registry id:** `memory`

Not a Room, and **not in `§13`'s target tree at all.** That tree names
`dashboard/`, `setup/`, `rooms/` and `settings/`; this page is none of them.

Placing it in `pages/memory/` is an extension of the specified shape rather than
an application of it, and `D-54` says so rather than implying the package asked
for it. The reasoning: this page is nobody's subflow and every Room's evidence —
it answers _why does KAE believe this?_ about statements that belong to all of
them — so a folder of its own is the only placement that does not attach it to
one Room arbitrarily.

## Purpose

Why the system believes what it believes. KAE-Memory is authoritative for all of
it; this page only displays it.

## User questions it answers

- Where did this statement come from?
- What exactly was said, and by whom?
- Which revision is this project at?
- Has anything been derived that nobody agreed to?

## Entry conditions

None. A project with no knowledge opens here and is told nothing has been
derived to trace — which is a fact about the project, not a failure to read it.

## Data it consumes

| Port         | For                                                  |
| ------------ | ---------------------------------------------------- |
| `projection` | the records, their lifecycle, the project's revision |
| `memory`     | `GET /knowledge/{id}/trace` — provenance, on demand  |

## Contextual toolbelt

`§9`, and shorter than any other surface's: **Where this came from**, per
record, which fetches that record's trace when somebody asks for it.

Lazily, and that is the design. A project holds hundreds of records and reading
provenance for all of them on load would trade one dishonesty for a slow page —
the previous version filtered to records with an inline trace, and since the
adapter set `trace: []` on every one, the page whose whole job is provenance
rendered a heading, a badge reading `0`, and an empty list (`AUD-004`).

**Agent activity is named and empty on purpose.** The panel states that the
capability is not implemented rather than rendering an empty list, because an
empty list reads as _nothing happened_. It lives here and was described by the
Settings contract for a while, which rendered no such panel (`D-61`).

Nothing else. There is no editing here, and no confirming: this page is a
window.

## Empty, loading and degraded states

Loading · a project with no records at all · a record whose trace KAE-Memory
could not return, which says so rather than rendering as a record with no
evidence · a revision that could not be read, shown as `—` rather than `0`,
because zero is a real revision meaning nothing has been written.

## Exit conditions

None. Nothing is completed here.

## Owns

`MemoryPage.tsx`, and `RecordProvenance` within it — the on-demand trace reader,
which nothing else uses. Its three panels — _Knowledge and its evidence_, _What
Studio currently remembers_ and _Agent activity_ — are all this page's.

## Does **not** own

- **Any of the content.** Every record, every quote and every revision belongs
  to KAE-Memory. This page cannot change one and offers no gesture that would.
- **What a lifecycle means.** `validated`, `proposed`, `rejected`, `superseded`
  are Memory's vocabulary; this page renders the word it is given (`D-34`).
- **Deciding anything.** Confirmation lives in the Review and Interview Rooms,
  where somebody is making a decision rather than reading one.
- **Judging evidence.** A quote is shown verbatim with its source and time. If a
  statement rests on something thin, that is visible here and resolved
  elsewhere.

## Transitions out

`/requirements` and `/definition` for what the project holds · `/reviews` for
what is still waiting on a person.

## Tests

Covered through `routes.test.tsx` (Memory section). It has no test of its own,
which is worth stating rather than leaving to be discovered — the trace fetch is
exercised only through the Requirements subflow's provenance disclosure.
