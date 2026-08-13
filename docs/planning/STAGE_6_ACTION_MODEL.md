# Stage 6 — the action and work model, as it actually stands

The directive asks for this before a board exists:

> Before adding a board, establish a shared action/work model. At minimum
> evaluate: recommended action; blocker; review item; open question; decision;
> gap; implementation task/work item. **Do not collapse these into one
> vocabulary if their semantics differ.**

This is that evaluation. It is a record of what the product already has, not a
proposal — six of the seven entities reach a person today, each built separately
and each kept deliberately apart from its neighbours. The model was enforced
case by case and never written down, which is how a later reader comes to
collapse it.

**Nothing is built on this document.** Stage 6 gates Gate F and a board, and
`§19` is explicit: *add a board when Studio has meaningful work items to manage.*
One of the seven does not exist. See [what is missing](#what-is-missing).

---

## The seven, and why none of them is another

| Entity | What it is | Who decides it | Where a person meets it |
|---|---|---|---|
| **Recommended action** | What KAE advises doing next. Reasoned per turn, never a priority table | CIE (`ADR-0002`) | Dashboard `NextAction`; the Interview Room's recommendation card |
| **Blocker** | A gap **somebody owns and must close**. Carries severity, an owner, a resolution note | a person, recorded in Memory | Dashboard *Blocked on someone*; named on the area it sits in |
| **Review item** | A quality finding **derived from state**, not stored. Disappears when the state changes | KAE-Memory computes it | `/reviews`, *What a review of this project found* |
| **Open question** | Something nobody has decided. `open` means nobody was asked; anything else means somebody was and did not decide | a person answers it | `/definition`'s *nobody has decided*; the Interview Room's decisions panel |
| **Decision** | A question somebody settled. Distinct from a conclusion KAE drew on its own account | a person | The Interview Room; `/definition` |
| **Gap** | Coverage a project does not have — an area below its threshold | Memory's readiness model | Coverage panel; the assembly manifest's `unresolved_critical_gaps` |
| **Implementation task** | Work to be done to build the software | — | **nowhere. Nothing produces one.** |

### The distinctions that were expensive to establish

Each of these was a separate increment, and each was a defect first:

- **A severity is not a reason** (`D-17`). A field named *why this matters*
  carried a grade. The label promised what the content could not keep.
- **A blocker is not knowledge** (`D-29`). *"An `unknown` knowledge item is a gap
  in what we know; a blocker is a gap someone owns and must close."* Memory's
  words. A critical one already changes what a package claims about itself.
- **A review item is not a proposal** (`D-30`). The proposal list is a gesture
  surface — agree or refuse and a statement moves. A review finding is a
  diagnostic, and *"this area has nothing in it"* is not something to click yes
  on. They sit on one page and are never merged.
- **A review item has no identity** (`ADR-0015`, `D-30`). Derived from state on
  every read, so there is nothing stable to address. **This is the reason a
  board cannot simply list them**: a card you can drag implies a thing that
  persists.
- **Not-asked is not deferred** (`N36`, `D-18`). An open question nobody has put
  to anybody differs from one somebody set down.
- **Three area vocabularies exist and none governs** (`D-31`). The contract's
  seven states, Memory's four, Studio's five. Open as `AREA-STATES`.

The instruction *"do not collapse these if their semantics differ"* has been the
operative rule of this whole run. It is worth stating that it was expensive:
every one of the six was found by somebody rendering two of them the same way.

---

## The routing envelope, field by field

The directive asks for eight. Six are carried today; the state of each is below.

| Field | Carried? | By what |
|---|---|---|
| destination Room | **yes** | `ROOMS`/`SURFACES` registries; every entity's surface links to where it is acted on |
| objective | **partly** | *"Discuss this"* carries the area name into a turn. Nothing carries an objective for a blocker or a review finding |
| project / revision | **yes** | `project.memoryRevision`, pinned per projection |
| affected entity IDs | **yes**, newly | `knowledgeItemIds` on a review finding (`D-37`); `areaKey` on a blocker; `subjectKey` where the area does not say |
| priority / severity | **yes** | Memory's own grade, rendered as a grade and never as a reason |
| blocking state | **yes** | `implementationEligible` (`D-33`); a critical blocker marks a package rather than withholding it (`D-32`) |
| completion rule | **differs per entity, deliberately** | see below |
| return destination | **no** | nothing carries one |

### Completion rules are not one rule

This is the field that would be wrong to unify, and the reason is structural:

- a **review item** completes by the underlying state changing. Nobody closes
  it; it stops being derived.
- a **blocker** completes when a person resolves it, with a note. Somebody takes
  responsibility.
- an **open question** completes when it is answered, or is deliberately
  deferred — and deferral is an answer that must stay visible.
- a **recommended action** never completes. It is reasoned fresh each turn.
- a **gap** completes when coverage rises, which is a consequence rather than an
  act.

A board column called *Done* would have to mean five different things.

---

## What is missing

**An implementation task does not exist.** Nothing in Memory, Studio, CIE or
Artifacts produces one. The other six describe *what a project knows and what it
is waiting on*; none of them describes *work to be done to build the software*.

This is why Stage 6 comes before a board rather than after: a board over the six
that exist would be a board of things you cannot move, most of which nobody can
mark done.

## What is open, and not decided here

- **`return destination`** — worth carrying, or a field that would exist to fill
  a table? Nothing needs it today.
- **`objective` for a blocker or a finding** — *"Discuss this"* proves the
  pattern for an area. Whether a blocker should open a turn about itself is a
  product question.
- **`AREA-STATES`** — three vocabularies for coverage, none governing.
- **`GEN-GATE`** — whether a critical blocker should refuse generation or only
  mark it. Today it marks.

Each is recorded in `development/ACTIVE_CHECKLIST.md` and each needs a person.
