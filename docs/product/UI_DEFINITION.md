# UI Definition as an Output

Status: approved direction.

> Scope note: this document covers the interface KAE-Studio **defines for the project being specified**. The interface of KAE-Studio itself is governed by `../ui/UI_GENERATION_CONTEXT.md`.

## Principle

The user interface can be defined before development. A screen specification is part of the implementation-ready definition, connected to the same model as everything else: a screen realizes a workflow, is used by actors, depends on interfaces, and is verified by acceptance tests.

## Screen specification

Each `SCR-` node establishes:

purpose; intended users; entry points; layout regions; displayed information; user actions; form fields; validations; permissions; loading states; empty states; error states; navigation; API dependencies; acceptance criteria; responsive behavior; and wireframes or generated prototypes where produced.

## Example

```text
Screen: Report Submission   (SCR-004)

User
    Ministry leader

Purpose
    Create and submit a monthly ministry report.

Sections
    Reporting period
    Summary
    Activities
    Attendance metrics
    Challenges
    Attachments
    Submission status

Actions
    Save draft
    Preview
    Submit for approval

Rules
    Reporting period is required.
    Submission is disabled until mandatory sections are complete.
    Submitted reports become read-only unless returned for revision.

Dependencies
    Authentication
    Ministry directory
    Attachment storage
    Approval workflow

States
    New
    Draft
    Submitting
    Submitted
    Returned
    Approved
    Publication failed
```

## Connection to the project model

- `realized_by`: a workflow is carried out through one or more screens.
- `consumes`: a screen depends on interfaces owned by modules; a screen action with no backing interface is a gap.
- `constrained_by`: permissions on a screen must be consistent with the module's security requirements. Divergence is a Reviews finding.
- `verified_by`: screen acceptance criteria are acceptance tests like any other.
- Every state in the screen's state list must be reachable and must have defined behavior, including the failure states. A screen specifying only the happy path is `draft`, not `complete`.

## Generated output

For each screen, the package can produce a screen specification, a navigation map, a component specification, a route definition, and implementation context for the screen. Visual wireframes and interactive prototypes are a later capability; the specification is the near-term deliverable and is what makes the screen implementable.

## Guardrails

- Do not invent screens for modules with no user-facing responsibility.
- Do not specify visual design where the project has no design system decision; specify structure, information, actions, and states, and record the design decision as open.
- Do not let screen permissions become a second, divergent source of authorization truth — the module's security requirements are authoritative.
