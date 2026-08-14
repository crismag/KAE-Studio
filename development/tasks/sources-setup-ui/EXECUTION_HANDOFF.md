# Execution handoff — SRC-01 Sources product UI

## Working rules

- Work **one slice at a time** (S1 → S2 → S3 → S4) as defined in `EXECUTION_CONTEXT.md`.
- Inspect current main and unmerged branches before coding; do not overwrite in-flight work.
- Read the live page and the files named in the context before changing copy. The 2026-08-13 review is evidence, not a screenshot to restyle blindly.
- Keep `§6`: Settings configure, Sources select, Setup summarizes. Do not build a trapping wizard.
- Never put credentials in the browser. Connect remains GitHub App install.
- Never add a fixture fallback to make a live route look complete.
- Clone and Create stay **Not yet**. Do not stub them as working.
- If a required Memory or installation-select contract is missing, **stop** and record OD-SRC-1 or OD-SRC-2. Do not invent Studio persistence.
- Run the tests listed in `EXECUTION_CONTEXT.md` for the slice you touch, then `npx vitest run` if the slice crosses ports.
- Browser checks that write to deployed Memory must use a dedicated or disposable project, not Cris Test1 if that project is in active use.

## Stop conditions

Stop and record a contract dependency when:

- paste/documents cannot appear on the Sources list without a Memory field that does not exist (OD-SRC-1);
- multi-install choice requires an API or durable store Studio does not have (OD-SRC-2);
- a control would claim clone, create, analysis, test-write, or revoke;
- a proposed UI action would fabricate a source, connection, or repository listing;
- current work overlaps unmerged changes that cannot be isolated.

## Completion report

Same fields as `EXECUTION_CONTEXT.md` (target, behavior, contracts, files, checks, live proof, deferred OD, deploy/push).

## First execution prompt

> Implement S1 only in KAE-Studio: truthful empty / next-action on `/sources`. Read `development/tasks/sources-setup-ui/EXECUTION_CONTEXT.md` and the live page at `/#/sources`. Empty copy, Add-source `means`, and the Settings link must agree with whether a GitHub connection is granted and whether GitHub/local listings have rows. Keep Add a source on the empty page (D-85). Choosing a kind must replace the menu with the picker (one Cancel). Demote Coverage/Activity when the source list is empty. Use `plural()` for section/statement counts. Do not start the shared picker extraction, Settings account identity, Setup destination picker, clone/create, or a wizard. If live paste/runs exist with an empty source list, inspect the sources vs documents APIs and either wire paste into the list using existing ports or stop with OD-SRC-1 — do not leave “Nothing to read from yet” on a project that has been read.
