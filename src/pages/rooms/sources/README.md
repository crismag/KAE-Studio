# Sources Room

**Route:** `/sources` · **Registry id:** `sources` ·
**Redirects here:** `/ingestion`

The first folder under `pages/rooms/`, and the shape the rest follow.
`§13`: *"a developer can find a screen by looking at the filesystem."*

## Purpose

Everything this project reads from, and what KAE did with it. A person arrives
holding material — a repository, a brief, a specification — and leaves having
handed it over, or knowing exactly why they could not.

## User questions it answers

- What can KAE read from, and what has it actually read?
- What is in this repository, and what would it read if I asked?
- What happened to the thing I gave it, and why did that one fail?
- How much of what I supplied never became knowledge?

## Entry conditions

None. The Room is useful with nothing connected — its empty state is a route to
Project Settings rather than a dead end.

## Data it consumes

| Port | For |
|---|---|
| `acquisition` | sources, file listings, file excerpts, file ingest |
| `ingestion` | pasted text, extraction coverage, agent runs |

Both are revision-pinned by the backend: a file listing and an ingest happen at
the same commit, which is what makes provenance point at something stable.

## Owns

`SourcesRoom.tsx` (the tabbed shell and the repository browser), `intake.tsx`
(paste, the file gap, coverage, run activity) and `runVocabulary.ts` — the
plain-words reading of a run's error code, used by nothing else.

## Does **not** own

- **Connection configuration.** `§6`: workflow selects, Settings configures.
  Adding or granting a credential is `/settings/project`.
- **Repository selection for the project.** That is a `primary_repository`
  decision and belongs to setup/intake; this Room manages what is *already*
  attached.
- **What the extracted statements mean.** Candidates go to the Review Room.
- **Any judgement about a repository.** Reading is not analysis, and the Room
  states that beside the action rather than at the top of the page.

## States it must render

Loading · empty (nothing connected) · **inaccessible** (a source that exists and
could not be reached, with its reason) · error · truncated listing · a
configured repository the credential can no longer see · a run that failed, in
words.

The fourth is the one usually missed, and `sourcesRoom.test.tsx` asserts it.

## Exit conditions

Files or text handed over, with an ingest outcome naming what was stored and
what was dropped. The Room deliberately does **not** claim the material has been
read — that happens in a worker, and the Activity tab is where it becomes
visible.

## Transitions out

`/reviews` (candidates to accept) · `/settings/project` (connect something) ·
`/setup` (choose the project's repository).

## Tests

`sourcesRoom.test.tsx` — the browser, the four states, the tabs.
`intake.test.tsx` — paste, truncation, the file gap, run vocabulary, the
composer's Paperclip.
