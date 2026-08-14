# Execution context — Sources, GitHub connect, repo / workspace selection

Status: proposed. Generated 2026-08-13 from live Studio, not from a pinned Memory revision. Treat every claim below as **observed or already decided in this repository**. Do not invent missing Memory or GitHub-App contracts.

## Mission

Make the first-run path product-usable:

```text
choose project → connect a GitHub account (or pick a local folder)
  → select one or more repositories / workspaces
  → see them as the project's sources
  → set related options (branch, working directory, destination)
```

Setup remains a **revisitable lens**, not a wizard. Settings **configures** access. Sources **selects** resources. Setup **summarizes** what is configured and where outputs go (`§6`, `D-81`).

Complete when a person on `/sources` can tell the truth about this project in one glance: what it reads from, which account that comes from, what to do next, and that paste/runs are not a second hidden intake.

## Evidence (live)

Reviewed: `http://localhost:5199/#/sources` after ProjectGate, project **Cris Test1: New Project**.

Hash `#/sources` does not show Sources until a project is chosen. That is correct (`ProjectGate`). Everything below is the room after selection.

### Observed UI

| Region | What it showed |
| --- | --- |
| Sidebar | Current project name, Switch project, Sources current, Reviews **59** |
| Header | Title Sources; long pinned-revision lead; **Manage connections** |
| Empty list | **Nothing to read from yet.** Folder needs no account. *To read a repository on GitHub, connect an account in Settings first.* **Add a source** |
| Add a source | Folder *29 available*; GitHub *From an account you have connected*; Clone **Not yet**; Create **Not yet**; Paste (text works) |
| GitHub picker | Search + *Nothing to choose from. KAE can reach no repositories of this kind. It may be scoped to none, or to another account.* Menu stayed open above the picker. Two Cancels. |
| Folder picker | 29 rows under `/mnt/ai/workspaces/…` (KAE-Studio, KAE-Memory, temp, …), absolute paths, branch `main`. Single select. Menu still open. |
| Coverage | *28 sections read, 1 abandoned.* Badge **Some content unread**. |
| Activity | Long *succeeded* / *Reading a document* / *Classifying statements* log; one abandoned run with verbatim quote-mismatch. Dominates the page. |
| Footer | Sign-in disabled; Memory reachable schema 0025; CIE via Ollama; revision unreported |

### Contradictions that this work must close

1. **Empty sources vs a full project.** The list says nothing is configured. Coverage, Activity, and Reviews 59 prove material was read. Paste/interview intake did not become `ProjectSource` rows. The page claims one list of everything this project reads from (`§7`, `D-80`) and does not keep it.
2. **GitHub connected and not connected.** Empty copy always says connect in Settings. Add-source says an account is already connected (`useHasConnection()`). The picker says this kind has no reachable repos (scope / wrong account). The actionable state is **scope**, not **connect**.
3. **Local is the only working selector and looks like a disk dump.** 29 operator paths, not named workspaces for this project. No multi-select, no primary, no working-directory step.
4. **Add-source and picker stack.** Kind menu remains while the list appears. First-run includes two Not-yet rows.
5. **Hierarchy inverted.** Selection is a small block; Activity is the page.

`D-85` already removed the Setup ↔ Sources empty-state loop. Do not reopen it. Empty Sources must keep **Add a source** on this page. GitHub-without-connection still links to Settings, not Setup.

Unit tests already assert that a pasted brief **is** a source (`sourcesRoom.test.tsx`, `D-80`). Live Cris Test1 disagrees. That gap is OD-SRC-1. Do not “fix” it by hiding Coverage/Activity or by claiming the list is empty when documents exist.

## Binding contracts (do not weaken)

| ID | Rule |
| --- | --- |
| `§6` | Settings configure resources; workflow pages select them. Setup is a lens. |
| `§7` / `D-80` | Repository, paste, folder, upload are one Sources list, distinguished by kind badge. |
| `D-81` | One picker. Selection lives on Sources. Setup summarizes. |
| `D-85` | Empty Sources includes Add a source. Never send “connect” to Setup. |
| `ADR-0003` | Discrete source/destination state. No setup percentage. |
| `D-25` | Verified means reached, not typed. |
| `D-26` / `D-41` | Unavailable destination always has a reason and a grant path. |
| `D-56` | GitHub App wins over token. |
| `D-78` / `§19` | Unavailable capability is honest when reached for, not a dead button and not an apology wall. Clone/Create stay visible and Not yet. |
| `D-79` | Duplicate connection records are grouped, not deleted. |
| Credentials | Browser never sees a token. Connect is GitHub App install, not Studio-hosted OAuth. |

## Target experience

### First-run (no sources)

1. Identity of the project is already in the shell.
2. One panel: **What this project reads from** with a single next action keyed off real state:

   | State | Copy | Action |
   | --- | --- | --- |
   | No GitHub grant and local roots exist | You can add a folder on this machine now. GitHub needs an account. | Add a source (folder highlighted) + link Settings |
   | Grant exists, GitHub listing empty | An account is connected, but KAE cannot see any GitHub repositories. The App may be scoped to none, or the wrong installation is selected. | Manage connections / choose installation |
   | Grant exists, GitHub listing non-empty | Pick a repository from the connected account. | Open GitHub picker |
   | Paste/runs exist, source list empty | Treat as a defect until OD-SRC-1 is resolved. Do not show “nothing to read from yet.” | List documents as sources, or an explicit “read from paste, not yet a source record” state — **do not invent a third story** |

3. **Add a source** replaces itself with the picker for the chosen kind. One Cancel. Clone/Create remain, Not yet, explanation only when reached for.

### Picker (shared)

- Searchable list of what this credential (or local roots) can actually reach. Filter locally; do not GitHub-search the world.
- GitHub: account/installation filter when more than one install exists.
- Local: show folder **name** first, path second (`D-78`). Optional multi-select.
- Choosing records a Source, sets `primary_repository` only for the **primary** pick, infers `primary_branch` only when unset.
- A second pick must not clobber primary unless the user marks it primary.
- Destinations on Setup and Deliverables reuse this picker (GitHub only). No `owner/repository` free text when a listing exists.

### Account connector (`/settings/project`)

- Row shows **account / org identity**, not the literal `github` + `env:…`.
- Connect: GitHub App install URL when slug exists; prerequisite note when it does not.
- After install, return to Studio and refresh listing (setup URL / state). If the contract for return does not exist, stop and record it — do not fake OAuth.
- N installations: user chooses in UI. Backend already refuses to pick the first (`_source_client` in `backend/src/kae_studio/api.py`). Do not require `STUDIO_GITHUB_APP_INSTALLATION_ID` + restart if a list endpoint can be exposed. If it cannot, record OD-SRC-2 and keep the current reason string.
- Token + Grant stays secondary (Superseded). Revoke stays absent until Memory can un-grant.

### Setup (`/setup`)

- Identity → source summary (Read / Not read yet) → destinations → one-line connection status linking to Settings.
- Remove the apologetic **Connections moved** panel.
- Destination hint must not say “grant a connection **above**.”
- Working directory visible when a source is chosen (monorepo), not only inside collapsed Reading options.
- Still not a wizard. No trap. No percentage.

### Hierarchy on `/sources`

- When the list is empty, Coverage/Activity are secondary (collapsed or below the fold). Selection is the page.
- When sources exist: list + detail (pin, files, ingest) primary; Activity remains, not the hero.
- Use `plural()` for “N sections” / “N statements” so screen readers do not hear “section s”.

## Slices (ship in order)

| Slice | Outcome | Stop if |
| --- | --- | --- |
| **S1 Truthful empty / next action** | Empty copy, CTAs, and Add-source `means` agree with `connected`, listing kind, and whether paste/runs exist. Menu yields to picker. Activity demoted on empty list. `plural()`. | Live paste-without-source cannot be told honestly without a Memory field — then OD-SRC-1 |
| **S2 Shared picker** | One component for Sources (add), Setup destinations, Deliverables destination. Primary vs additional. Name-first local rows. | — |
| **S3 Account identity + install choice** | Settings row is an account. Multi-install selectable in product UI. Return-from-GitHub refresh if the App setup URL is already supported. | Installation list/select API missing — OD-SRC-2 |
| **S4 Setup lens polish** | Summary, destination picker, working directory, connection one-liner. Dashboard/intake leftover “go to Setup to connect” copy gone. | — |

Do not start a whole-app visual redesign. Do not implement clone or create. Do not put credentials in the browser. Do not merge Setup, Settings, and Sources into one wizard.

## Files to modify

### S1

- `src/pages/rooms/sources/SourcesRoom.tsx` — empty state keyed off `connected` + listing; keep AddSource in empty branch
- `src/pages/rooms/sources/AddSource.tsx` — close/replace menu on choose; GitHub `means` already depends on `connected`
- `src/pages/rooms/sources/intake.tsx` — Coverage/Activity placement; `plural()`; leftover Setup links
- `src/pages/rooms/sources/sourcesRoom.test.tsx`, `addSource.test.tsx`

### S2

- New shared picker (e.g. `src/components/project/RepositoryPicker.tsx`)
- Fold `src/pages/setup/RepositoryPicker.tsx` and `src/pages/rooms/sources/PickRepository.tsx`
- `src/pages/setup/SetupPage.tsx` — Destinations
- `src/pages/rooms/planning/GeneratePackage.tsx`
- `src/pages/setup/githubConnect.test.tsx`, `projectSetup.test.tsx`, `GeneratePackage.test.tsx`
- `src/hooks/useProject.ts` — only if primary-source semantics need an explicit field; prefer existing `primary_repository` + source list

### S3

- `src/pages/settings/SettingsPage.tsx`, `src/pages/settings/accounts.ts`
- `src/app/shell/useDeploymentStatus.ts` if status grows installation identity
- `backend/src/kae_studio/api.py` (`_source_client`, `/api/status`, repositories)
- `backend/src/kae_studio/acquisition/github_app.py`
- `src/services/interfaces.ts`, `live/liveServices.ts`, `mock/mockServices.ts`
- `backend/tests/test_github_app.py`

### S4

- `src/pages/setup/SetupPage.tsx`, `src/pages/setup/README.md`
- `src/pages/settings/README.md` — which page selects repositories
- `src/app/registries/rooms.ts` — Setup limit copy
- `src/pages/dashboard/DashboardPage.tsx` if journey still points at the old loop
- `src/app/shell/ProjectGate.tsx` — after create, land on Setup with a real next step

## Edge cases

- No App slug: Connect visible, prerequisite on reach, not a 404 link.
- 0 / 1 / N App installations: 0 install CTA; 1 use it; N must choose, never first.
- Install hand-off with no return: listing refreshes when the user comes back via nav.
- Token vs App: App wins; UI must not present two equal Connect buttons.
- Duplicate github connection rows: group (`accountsFrom`); do not delete.
- Second source must not overwrite `primary_repository` / chosen branch.
- Local vs GitHub in one picker API, destination GitHub-only.
- Destination with no granted connection: unavailable + Settings link.
- Unavailable destination with no Memory reason: fallback sentence (`D-41`).
- Empty mock vs demo fixture: tests must cover first-run, not only ministry/reporting already set up.
- Working directory empty = whole repo.
- ProjectGate: missing/deleted id → picker, never invent a project.
- Clone/Create: Not yet, copy only when reached for.
- `#/sources` with no project: ProjectGate, then Sources — do not skip the gate.

## Tests to run

```bash
npx vitest run src/pages/setup/projectSetup.test.tsx \
  src/pages/setup/githubConnect.test.tsx \
  src/pages/settings/accounts.test.ts \
  src/pages/rooms/sources/addSource.test.tsx \
  src/pages/rooms/sources/sourcesRoom.test.tsx \
  src/pages/rooms/planning/GeneratePackage.test.tsx
npx vitest run
cd backend && pytest tests/test_github_app.py tests/test_sources_survive_a_deploy.py tests/test_local_source.py -q
```

### New or updated assertions

| Case | Must hold |
| --- | --- |
| Empty Sources, disconnected | CTA is Settings or Add folder, never Setup |
| Empty Sources, connected, no GitHub repos | Copy is scope/account, not “connect first”; folder still offered if local roots exist |
| Empty Sources, paste/runs exist | Must not say “Nothing to read from yet” once OD-SRC-1 is resolved; until then fail the test that live and mock disagree |
| Add source → picker | Kind menu is gone; one Cancel |
| Pick repo | Source + `primary_repository` + inferred branch if unset |
| Second repo | Does not clobber primary unless marked |
| Folder picker | Name first, path second |
| Destination | Picker, not free text, when listing exists |
| Accounts | Display account/org when present; duplicates still grouped |
| N installations | User must pick; 1 auto-selects |
| `plural()` | No “section s” / “statement s” in accessible name |

### Manual first-run (localhost:5199)

1. Deep link `#/sources` with no project → Choose a project → Sources.
2. Cris Test1 (or a clean project): empty copy matches connection + listing, not a loop.
3. Connect GitHub → return → account named Connected.
4. Folder: pick one named workspace; it appears in the list.
5. GitHub: picker shows repos for the chosen install, or an honest scope reason.
6. Second source does not replace primary.
7. Setup summary matches the list; destination uses the same picker.
8. Activity is not the first thing an empty project sees.

## Open decisions — do not assume

### OD-SRC-1 — Paste / document intake vs `ProjectSource`

**Fact:** Tests say a pasted brief is a source. Live Cris Test1 has Coverage/Activity/Reviews and an empty source list.

**Do not assume** that hiding Activity is the fix, or that live Memory already writes a `paste` source.

**Decide by inspecting** live `GET /api/projects/{id}/sources` vs document/run endpoints. If Memory never creates a source for paste, either (a) Studio `ingestText` should also `addSource`, or (b) the list must include documents from the intake contract. Pick the option the existing ports already allow. If neither port can list those documents as sources, stop and record the Memory dependency.

### OD-SRC-2 — Choosing a GitHub App installation in the product

**Fact:** Backend lists installations and errors when several exist, asking for `STUDIO_GITHUB_APP_INSTALLATION_ID` and a restart.

**Do not assume** a Studio API already accepts a chosen installation id, or that browser OAuth exists.

**Decide by inspecting** `/api/status` and acquisition routes. If a select/list endpoint can be added in Studio BFF without new Memory schema, that is in scope for S3. If it requires host env only, keep the reason string and do not draw a fake account picker.

### OD-SRC-3 — Working directory vs multi-folder

**Fact:** `working_directory` is a setup field; local picker lists whole workspace roots.

**Do not assume** multi-select of folders inside a repo. First ship: pick a root (or GitHub repo), then optionally set working directory on Setup.

## Explicitly out of scope

- Clone repository / create repository
- Browser OAuth tokens or any secret in the client
- Revoke connection
- Repository analysis (`analyzed` is declared unreachable)
- Upload/PDF/DOCX decode
- Wizard that traps the user in Setup
- Redesign of Workspace, Definition, Requirements, Modules, Architecture, Plan, Reviews
- Changing CIE, Memory schema (unless OD-SRC-1 proves a missing field — then stop)
- Fixture fallbacks to make empty look configured
- CockroachDB / unrelated ES phases

## Completion report (required)

For the slice you ship:

- target and commit
- user-visible behavior
- API contracts consumed
- files changed
- automated checks
- live browser proof on `/#/sources` (named project)
- deferred OD-SRC-* if any
- whether deployed / pushed (only if asked)
