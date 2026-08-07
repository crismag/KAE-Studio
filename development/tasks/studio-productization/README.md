# KAE Studio Productization Tasks

Status: planned  
Evidence: live review of `https://kae.crishub.com/studio/#/workspace` on 2026-08-07  
Scope owner: KAE-Studio

## Objective

Move Studio from a fixed development fixture to a truthful multi-project product experience:

> create a clean project → provide initial context → converse through CIE → review only that project's knowledge → leave and reopen the same project

This package contains Studio-owned actions from the browser review. It does not move Memory or CIE responsibilities into Studio.

## Current evidence

The deployed application is usable as an integrated development demonstration, but it still:

- resolves one project at runtime with no project list, selector, or creation flow;
- presents stale and cross-project fixture content on several routes;
- renders a very long development transcript as the primary workspace;
- exposes internal UUIDs in Open decisions;
- shows page counts and status claims that disagree across routes;
- contains pages whose blocker explanations refer to modules or deliverables not visible in the selected project;
- exposes an active Settings control with no visible result;
- retains the footer claim `Prototype — mock data` while some paths use live CIE and Memory.

## Already complete — do not reopen

The recent repository work already delivered:

- U2: hide UUIDs where the completed requirements/workspace pass covered them;
- U3: source and readable decision explanation;
- U4: contextual actions returning to conversation without sending on the user's behalf;
- U6 readiness counts where Memory supplies a real completeness signal;
- U8: progressive explanation;
- Workspace readiness projection mapping fix (`key` / `state`);
- Studio `/turn` routing through CIE;
- CI for formatting, lint, types, tests, and build.

This track may extend those behaviors to uncovered components, but must not replace them with fabricated frontend data.

## Boundaries

Studio owns:

- project selection and creation experience;
- active-project UI state;
- route composition and projection presentation;
- truthful empty, loading, unavailable, and blocked states;
- review actions already supported by versioned APIs;
- navigation, settings presentation, and diagnostics;
- generation/publication interaction when supported by real contracts.

Studio does not own:

- durable projects, messages, evidence, knowledge, revisions, or readiness;
- semantic deduplication, canonicalization, or supersession;
- CIE move selection or conversational policy;
- acceptance criteria that Memory does not model;
- provider-specific database behavior.

AWS RDS/PostgreSQL remains the active path. CockroachDB-specific implementation and testing are excluded.

## Documents

- [PHASE_REGISTER.md](PHASE_REGISTER.md) — sequencing and gates
- [STUDIO_TARGETS.md](STUDIO_TARGETS.md) — implementation-ready targets
- [EXECUTION_HANDOFF.md](EXECUTION_HANDOFF.md) — agent instructions and first prompt
