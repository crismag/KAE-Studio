# Project Settings

**Route:** `/settings/project` · **Registry id:** `project-settings`

Not a Room. `§13` names `settings/` as its own page folder, and `§6` gives it
the other half of the line Setup sits on: _settings pages configure resources;
workflow pages select them._

`§13`'s tree also shows `connections/`, `ai/`, `storage/` and `development/`
beneath this. **Only connections exist**, and no empty folders were created to
match the picture — a directory that promises a section nobody built is the
filesystem's version of a disabled-looking control.

## Purpose

Configure what this project may reach, and say plainly what each grant is worth.
The place a credential is authorised, revoked, and seen.

## User questions it answers

- What has this project been given access to?
- Who granted it, and when?
- What is this deployment configured to reach at all?
- Why can I not publish?

## Entry conditions

None. Reachable from Setup whenever a connection turns out to be what is
missing (`D-41`).

## Data it consumes

| Port    | For                                                        |
| ------- | ---------------------------------------------------------- |
| `setup` | connections, their authorization state, who granted them   |

## Contextual toolbelt

`§9`. **Record a connection** (as a reference, never a secret), **grant** it,
and read **who granted it and when** — the date the grant was made, which is
what `last_verified_at` holds.

**Never *last checked*.** Nothing here has reached GitHub. That timestamp is
stamped by `authorize_connection` and by nothing else, so a label saying the
connection was *checked* would be `D-25`'s *verified means proved, not declared*
committed in wording rather than in a badge. This page's earlier contract asked
*"when was it last checked?"* and the page answered neither half; the question
is now the one the data can answer (`D-60`).

**Revoke is absent.** Nothing in KAE-Memory moves a connection out of `granted`,
so a revoke control would be a button with no write behind it — `§19`, and the
same reason `Publish` states its prerequisite rather than failing at the end.

Nothing on this belt belongs in global navigation, and nothing here selects a
resource — that is `/setup`'s and the Rooms' (`§6`).

## Empty, loading and degraded states

Loading · no connection recorded · a connection recorded and never granted,
which is `never_granted` and not a failure · a grant that exists while the
deployment holds no credential, which is a project-level permission over a
missing environment variable and says so.

## Exit conditions

None. Settings are revisited, not completed.

## Owns

`SettingsPage.tsx`. Nothing else is single-use here — the connect flow's test
lives with `/setup`, because it crosses this boundary by design and its subject
is the flow rather than either page.

## Does **not** own

- **Credentials.** A connection holds a reference — `env:NAME` — and the browser
  never sees a secret. `§19`, and `ProviderConnection` refuses anything that
  looks like one.
- **The durable record.** KAE-Memory's `provider_connections` is authoritative.
  Studio's acquisition service keeps a working copy and adopts from the record
  rather than owning it (`D-22`).
- **Which repository a project uses.** That is a selection, and selections are
  `/setup`'s (`§6`).
- **Global or deployment settings.** `§19`: _do not make global Settings a
  dumping ground for project-specific decisions._ The converse holds too —
  everything here is one project's.
- **Publishing.** Off by decision (`D-8`). This page can say why; it cannot turn
  it on.

## Transitions out

`/setup` to select what a granted connection makes available · `/sources` to see
what the connection can actually read.

## Tests

`githubConnect.test.tsx` (in `pages/setup/`, which renders both sides of the
connect flow).
