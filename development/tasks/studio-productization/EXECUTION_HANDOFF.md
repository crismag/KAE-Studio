# Execution Handoff

## Working rules

- Work one ES phase at a time.
- Inspect current main and recent unmerged branches before coding; do not overwrite ongoing Claude work.
- Verify the actual Memory and CIE contracts before adding frontend fields.
- Never add a fixture fallback to make a live route appear complete.
- Keep durable project and conversation state in Memory.
- Preserve sparse-input behavior: unknowns, assumptions, and deferred decisions are allowed.
- Run the existing format, lint, type, unit/component, build, backend, and relevant browser gates.
- Browser tests that write to deployed Memory must use a dedicated clean project or disposable development project.
- Report backend/CIE blockers into the KAE-Ecosystem EM/EC track instead of repairing them in Studio.
- RDS/PostgreSQL is active. CockroachDB is retained, low priority, and unverified; do not add provider work here.

## Stop conditions

Stop and record a contract dependency when:

- Memory cannot list/create/read projects with the identity or lifecycle required by ES-1;
- canonical/supersession information required by ES-5 does not exist;
- a page needs acceptance criteria or reasoning not present in a real contract;
- a proposed UI action would fabricate a user message, confirmation, decision, module, relationship, plan, or deliverable;
- current Studio work overlaps unmerged changes and cannot be safely isolated.

## Completion report

For each target report:

- target and commit;
- user-visible behavior;
- API contracts consumed;
- files changed;
- automated checks;
- live browser proof;
- deferred dependency;
- whether deployed;
- whether pushed.

## First execution prompt

> Implement ES-1 only in KAE-Studio: real project list/create/select and active-project routing. First inspect current main, recent Studio work, and the actual Memory project APIs. Keep durable project identity and data in Memory; Studio may persist only the active-project preference. Remove the fixed-project fallback from the product path. Prove isolation using two projects, reload/reopen behavior, and a deep-link-without-selection case. Do not begin ES-2+, Memory canonicalization, CIE behavior changes, CockroachDB work, archive/delete, or unrelated visual redesign. If the required Memory contract is missing, stop with the precise endpoint/schema dependency rather than inventing Studio persistence.
