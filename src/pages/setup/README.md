# Project Setup

**Route:** `/setup` · **Registry id:** `setup`

Not a Room. `§13` names it as its own page, and `§6` says why: _workflow pages
select configured resources; settings pages configure those resources._ This is
where a project's resources are configured before any Room selects them.

## Purpose

Stage one of the product, which did not exist until recently. Where a project's
material comes from, where its outputs go, and what KAE is allowed to reach.

_"Not all information intake comes from an interview."_ This page is the other
half — the one that takes what somebody already has instead of asking them to
say it again.

## User questions it answers

- What repository is this project about, and which branch?
- What may KAE read, and what should it leave alone?
- Where do generated documents go?
- Has any of that actually been proved, or only typed in?

## Entry conditions

None, and no order. `01`'s rule is explicit that stages never trap the user:
every field is revisitable and shows its own state, so this is a lens rather
than a wizard.

## Data it consumes

| Port          | For                                                     |
| ------------- | ------------------------------------------------------- |
| `setup`       | configuration fields, publication targets, connections  |
| `acquisition` | the repositories this deployment's credential can reach |

## Contextual toolbelt

`§9`. **Pick a repository** (searchable, from what the credential can actually
reach), **set a branch**, **name a destination**, **choose the default**, and
**test access**.

**Test read and test write are not here.** Access exists and is checked; a
bounded read probe and a write probe are `D-8`'s neighbourhood, and a control
that claimed to prove either would be claiming a capability. `§19`: _do not
present unavailable capability as disabled-looking but otherwise real
functionality without explaining the prerequisite._

Nothing on this belt belongs in global navigation. Connection management lives
in Settings and this page links to it rather than absorbing it (`§6`).

## Empty, loading and degraded states

Loading · nothing configured at all · a repository named and nothing read from
it, which is `configured` and **not** `verified` (`D-25`) · a destination
registered and unreachable, which is not a destination nobody set, and which
links to the grant that would fix it (`D-26`, `D-41`) · a credential the
deployment does not hold, which says so rather than showing an empty picker.

## Exit conditions

None. Setup is revisited whenever a project's resources change, which is why it
is not a sequence with an end.

## Owns

`SetupPage.tsx`, and the
`githubConnect` test that spans this page and Settings — the connect flow
crosses the `§6` boundary by design, so its test names both sides.

`RepositoryPicker` **is shared and is not this page's** — it lives in
`components/project/` because Sources, this page's destination field and the
Planning Room all pick a repository, and two implementations of one control
drift (`D-87`).

`StageReadiness` **stays shared**: the Architecture and Planning Rooms use it to
say what they are waiting for.

## Does **not** own

- **Credentials.** The browser never sees one. A connection names where a secret
  lives — `env:NAME` — and the backend resolves it. `§19`.
- **Connection management.** Granting, revoking and authorizing live in Project
  Settings. This page selects what has already been configured (`§6`).
- **What `verified` means.** It means KAE reached the thing. A granted
  credential is permission, not proof, and `ADR-0003` ruled the distinction this
  page nearly lost (`D-25`).
- **Durability.** KAE-Memory owns the source record, the publication targets and
  the connections. Studio holds no durable state of its own (`D-21`, `D-22`).
- **Inferring what it asks for.** `§5`: do not ask for what KAE can safely
  infer. Inferring `project_kind` from a read repository is `INFER-2`, and it
  waits on a credential this deployment does not have.

## Transitions out

`/settings/project` to grant or revoke a connection · `/sources` to see what the
configured repository actually contains · `/ingestion` to give KAE something
directly.

## Tests

`projectSetup.test.tsx` · `githubConnect.test.tsx`
