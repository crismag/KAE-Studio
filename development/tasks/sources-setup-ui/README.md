# Sources and Project Setup — product UI

Status: proposed execution context from live review, not a Memory-pinned artifact.

Evidence: browser review of `http://localhost:5199/#/sources` on 2026-08-13 against project **Cris Test1: New Project**, plus the current Studio code for Setup, Settings connections, and Sources.

This package is the bounded implementation context for making Project Setup, GitHub account connection, and repo / multi-repo / workspace selection feel like a product. It does not authorize a visual redesign of every Room.

## Documents

- [EXECUTION_CONTEXT.md](EXECUTION_CONTEXT.md) — full context: observed facts, contracts, slices, files, edge cases, tests
- [EXECUTION_HANDOFF.md](EXECUTION_HANDOFF.md) — agent working rules and first prompt
- [agents/project-context.yaml](agents/project-context.yaml) — machine-facing summary
- [agents/implementation-directives/SRC-01.md](agents/implementation-directives/SRC-01.md) — what to build, what not to assume

## Readiness

| Dimension        | State     | Note |
| ---------------- | --------- | ---- |
| Requirements     | draft     | Derived from live UI + existing §6 / D-81 / D-85 contracts |
| UI               | draft     | Screens observed; target layout specified, not mocked |
| Interfaces       | incomplete | Installation-choice API may be missing; stop rather than invent |
| Acceptance tests | draft     | Named below; several need new cases |
| Open decisions   | blocking  | OD-SRC-1 (paste vs source list), OD-SRC-2 (install picker contract) |
