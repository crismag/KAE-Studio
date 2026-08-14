# SRC-01 — Implementation directive

Module: Sources / Project Setup product UI (`SRC-01`)

## What to build

A truthful first-run on `/sources` and the related connect → select → summarize path.

- Empty state copy matches real connection + listing state.
- Add a source stays on the empty page; choosing a kind replaces the menu with the picker.
- One shared repository picker for Sources, Setup destinations, and Deliverables.
- Settings shows GitHub as an account (name/org), not `github` + `env:…`.
- Setup summarizes sources and destinations; it does not absorb Connect or become a wizard.
- Primary vs additional sources; second pick does not overwrite primary.
- Local rows: name first, path second.
- Coverage/Activity secondary when the source list is empty.
- `plural()` for section/statement counts.

## What is explicitly out of scope

Clone, create repository, browser OAuth, revoke, analysis, file decode, trapping wizard, redesign of other Rooms, fixture fallbacks, Memory schema invention.

## Open decisions — must not be assumed

- **OD-SRC-1:** Live Cris Test1 has reads/reviews and an empty source list; tests say paste is a source. Inspect APIs. Wire with existing ports or stop.
- **OD-SRC-2:** Multiple GitHub App installations currently require a host env var and restart. Do not draw a fake account picker if no list/select API exists.
- **OD-SRC-3:** Working directory is a setup field, not an in-picker nested folder multi-select.

## Fixed contracts

`§6`, `§7`/`D-80`, `D-81`, `D-85`, `ADR-0003`, `D-25`, `D-26`/`D-41`, `D-56`, `D-78`/`§19`, `D-79`. Secrets never in the browser.

## Acceptance tests that must pass

See `EXECUTION_CONTEXT.md` “Tests to run”. Minimum live proof: `#/sources` with no project hits ProjectGate; after a project is chosen, empty copy does not lie; folder pick adds a named source; GitHub empty is a scope/account story when already connected; Setup summary matches the list.

## Slice order

S1 only until that slice’s tests and live proof pass. Then S2, S3, S4.
