# Planning Room

**Route:** `/plan` · **Registry id:** `planning`

`§8`'s Room: _"turn an agreed definition into ordered work."_ `/deliverables` is
its subflow and lives here too.

## Purpose

Take what a project has settled and produce something a developer or a coding
agent can build from.

**Most of this Room does not exist**, and the page says so rather than
describing what it will be. `§19` names the failure it would otherwise be:
_Rooms as decorative themed pages without task boundaries._ Nothing measures
planning coverage, nothing sequences work, and there are no work items —
`STAGE_6_ACTION_MODEL.md` records that the seventh action entity, an
implementation task, exists nowhere in the estate.

What does work is the subflow: assembling a development package and choosing
where it goes.

## User questions it answers

- Is there enough here to build from?
- What would a package contain, and what would it admit it is missing?
- Where does the output go, and has anything been proved writable?
- What is stopping this from being ready?

## Entry conditions

None. A project with nothing settled opens here, is told what is not measured,
and can still ask for the best package available — `J8`, and the one thing this
Room does unreservedly well.

## Data it consumes

| Port         | For                                                      |
| ------------ | -------------------------------------------------------- |
| `projection` | `health` — what the project is fit for; blockers; gaps   |
| `artifacts`  | profiles, plans, generation runs, previews, publications |
| `setup`      | the destination a package would go to                    |

## Contextual toolbelt

`§9`. **Shape · Plan · Generate · Preview · Approve · Publish**, in that order,
each disabled until the one before it has produced something real.

`§9`'s example also lists Board, Backlog, Roadmap and Priority. **None exists**,
and none is stubbed — `§19` again: _do not add a board merely because
project-management products have boards; add it when Studio has meaningful work
items to manage._ There are none.

**Publish is present and refuses.** Publishing is off by decision (`D-8`), so
the control states the prerequisite rather than failing at the last step, which
is `§19`'s _do not present unavailable capability as disabled-looking but
otherwise real functionality without explaining the prerequisite._

Nothing on this belt belongs in global navigation.

## Empty, loading and degraded states

Loading · a project not fit to build from, which still generates and says the
package is **marked** not ready rather than claiming it is refused (`D-32`) ·
a destination nobody named · a destination named and unreachable, which is not a
destination nobody set (`D-26`) · every step of the pipeline failing with the
backend's own words and its remedy · a stale approval discarded when the plan
changes underneath it.

## Exit conditions

A package is generated, previewed, approved, and — where publishing is enabled,
which it is not here — sent. Approval is its own act and does not survive a
change to what it approved.

## Owns

`PlanningRoom.tsx`, `DeliverablesSubflow.tsx`, `GeneratePackage.tsx`,
`pipelineHandle.ts`, `FitFor.tsx`, and their tests. Nothing outside this Room
uses any of them.

`GeneratePackage.tsx` is the largest component that moved during `STAGE-2b`, and
size was the instinct against moving it. Size is not reuse (`D-53`): a publish
pipeline sitting in `components/project/` invites the next person to import one
into a page that should not have one, and its location is the only thing that
would have told them not to.

## Does **not** own

- **Whether a package may be generated.** Nothing refuses. `readiness_service`
  computes `implementation_eligible`, the blueprint carries it, and a critical
  blocker **marks** the result rather than withholding it (`D-32`). This Room
  reports that and does not enforce it.
- **What goes in a package.** KAE-Memory assembles from confirmed knowledge;
  Studio maps lifecycle to the package's confidence vocabulary and excludes what
  a package may not carry (`D-35`).
- **Publishing.** KAE-Artifacts owns the destination and the write. `D-8` is
  unruled and publishing is off; this Room does not simulate it.
- **Work items.** There are none. When there are, `STAGE_6_ACTION_MODEL.md` is
  the model they have to fit, and a board is Gate F's question rather than this
  Room's.
- **Readiness.** Memory computes it. This Room renders the two facts it produces
  and never folds them into one score.

## Transitions out

`/reviews` for what is waiting on a decision · `/settings/project` to name a
destination · `/definition` for what the package would be built from.

## Tests

`GeneratePackage.test.tsx` · `fitForIsVisible.test.tsx` ·
`deliverablesDoNotCrash.test.ts` (the mapping this Room reads).
