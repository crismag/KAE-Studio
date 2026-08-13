# Definition Room

**Route:** `/definition` · **Registry id:** `definition`

`§8`'s Room: _"see what the project is, as it currently stands."_ The route keeps
its path — a rename is a behaviour change, and `D-50` forbids combining one with
a move.

## Purpose

What this project is, who it serves, where its boundaries fall — and, beside all
of it, what was actually said, what KAE assumed, and what nobody has decided.

The Room a person opens to ask _"does KAE understand my project?"_ and can
answer without trusting a number.

## User questions it answers

- What does KAE think this project is?
- Which of that did I say, and which did KAE infer?
- What is KAE standing on that nobody has agreed to?
- What is still undecided, and what has been deliberately set down?
- Why is this section empty?

## Entry conditions

None. A project with nothing in it opens here and every section states why it is
empty rather than rendering blank — `AUD-002`, and the reason `CapabilityNote`
exists.

## Data it consumes

| Port         | For                                                      |
| ------------ | -------------------------------------------------------- |
| `projection` | `definition` sections, `unavailable` reasons, `preliminary` |

## Contextual toolbelt

`§9`. This Room is almost entirely **read**, and its belt is correspondingly
short: **Discuss this** on a section, which carries the subject into a turn in
the Interview Room rather than opening an editor here.

**There is no edit control, and that is the design.** A definition is derived
from confirmed statements; editing it here would be editing a projection, and
the statement it came from would disagree the moment anybody looked. Changing
what the project believes happens in conversation and in review, where the
change is attributable.

Nothing on this belt belongs in global navigation.

## Empty, loading and degraded states

Loading · a project with nothing established · a section KAE cannot derive at
all, which names the capability and its reason inline rather than rendering
blank · a section KAE-Memory could not read this time, which is a different
sentence from one it cannot compute (`AUD-040`) · a preliminary view Memory did
not answer for, which is not the same as a project with nothing preliminary
about it (`D-18`).

## Exit conditions

None. What is here changes when a conversation or a review changes it.

## Owns

`DefinitionRoom.tsx` and `PreliminaryContextPanel.tsx`, which nothing else uses.

`preliminaryReachesTheUser.test.tsx` moves with the panel although **half of it
asserts the adapter** — `D-18` wrote it that way because `RFA-2` proved that a
conservation check stopping one layer short of a person proves nothing. Splitting
it would leave the half that failed unnoticed for weeks in a different folder
from the half that explains why they belong together (`D-51`).

## Does **not** own

- **What the definition says.** Every section is a projection of confirmed
  knowledge in KAE-Memory. This Room renders it and cannot change it.
- **Deriving the sections it cannot show.** Scope, workflows and stakeholder
  roles have no backend capability; the Room states that per section and does
  not synthesise them from what is nearby.
- **Confirming anything.** A statement's lifecycle moves in the Review Room and
  the Interview Room, where a person is making a decision rather than reading
  one.
- **The preliminary collections' meaning.** Memory keeps known, proposed,
  assumed and unknown deliberately apart; this Room renders them apart and never
  counts, merges or paraphrases them.
- **Assumptions as a register.** `assumed` here is Memory's preliminary view. The
  definition's own `assumptions` section is a different list from a different
  path, and the two are not reconciled — see `ASSUME-WRITE`.

## Transitions out

`/workspace` from any _Discuss this_ · `/reviews` for what is waiting on a
decision · `/memory` for the evidence behind a statement.

## Tests

`preliminaryReachesTheUser.test.tsx` · `rfa2CapabilityGapsAreVisible.test.tsx`
(definition sections state their gaps) · `definitionProjection.test.ts` (the
mapping this Room reads).
