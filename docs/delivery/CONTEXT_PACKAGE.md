# Context Package

Status: approved direction.

## What it is

The context package is the generated, versioned projection of the project model, structured for consumption by developers and AI coding agents. It is the product's output.

Generation is separate from publication. One bundle is produced from a pinned Memory revision; a publisher then writes it to GitHub, a local workspace, or S3 without altering its meaning or structure. See `ARTIFACT_PUBLISHING.md`.

## Package structure

```text
project-context/
├── project-charter.md
├── stakeholder-register.md
├── scope-and-boundaries.md
├── business-workflows.md
├── requirements/
│   ├── functional-requirements.md
│   ├── integration-requirements.md
│   ├── security-requirements.md
│   └── operational-requirements.md
├── modules/
│   ├── report-management.md
│   ├── approval-workflow.md
│   └── publication.md
├── architecture/
│   ├── system-context.md
│   ├── component-design.md
│   ├── data-model.md
│   └── decisions/
├── interfaces/
│   ├── api-contracts.md
│   └── event-contracts.md
├── ui/
│   ├── navigation.md
│   ├── screen-specifications.md
│   └── prototypes/
├── planning/
│   ├── implementation-phases.md
│   ├── dependency-order.md
│   ├── risk-register.md
│   └── actionable-items.md
├── testing/
│   ├── acceptance-criteria.md
│   └── test-context.md
└── agents/
    ├── project-context.yaml
    ├── module-contexts/
    └── implementation-directives/
```

When publishing into an existing repository, this tree is written beneath the project's configured target directory (for example `docs/kae/`), so it coexists with the repository's own documentation rather than competing with it.

## The `agents/` directory

The differentiator. `project-charter.md` is for humans; `agents/` is machine-facing context designed to stop a coding agent from inventing missing requirements.

- `project-context.yaml` — structured project summary, module index, dependency order, active constraints, and the pinned Memory revision.
- `module-contexts/` — one bounded context per module, per `../architecture/MODULE_SPECIFICATION.md`. Sufficient to implement that module without reading the whole package.
- `implementation-directives/` — per-module instructions: what to build, what is explicitly out of scope, which decisions are still open and therefore must **not** be assumed, which interfaces are fixed contracts, and what acceptance tests must pass.

## Honesty requirements

These are what make the package trustworthy, and they are non-negotiable in generation.

- Every substantive statement traces to knowledge and evidence identifiers.
- The package header records the exact Memory revision, generation timestamp, content hash, and generator configuration.
- Node status is preserved: `proposed` content is marked as not yet confirmed.
- Open decisions appear as open, in the module that they block, and in `planning/actionable-items.md`. They are never resolved to make output look complete.
- Readiness per module and per dimension is stated, including for modules that are not implementation-ready.
- Known gaps and detected conflicts are listed rather than omitted.

## Package scopes

**Whole project** — the full tree above.

**Bounded module package** — one module, plus what is needed to implement it: satisfied objectives and customer requirements, exposed and consumed interfaces with contracts, owned and read data entities, screens, acceptance tests, binding decisions and constraints, stub summaries of dependency modules, its open decisions, and its readiness.

**Incremental update** — regeneration after the model changed. Produces the same structure; the publisher is responsible for expressing it as a diff against what is already published.

## Regeneration and staleness

Artifacts are immutable versions. Regeneration creates a new version pinned to a new Memory revision.

An artifact version becomes **outdated** when project knowledge it depends on has changed since generation. Studio detects this by comparing the pinned revision and the traced node set against current Memory state, and surfaces it in Deliverables. Outdated is a normal state during active development, not an error.

## Deliverable states

| State | Meaning |
| --- | --- |
| Generated | An artifact version exists. |
| Reviewed | The user accepted the proposed contents. |
| Published | Written to GitHub, local workspace, or S3. |
| Outdated | Project knowledge changed after generation. |
| Conflict | The target changed since the artifact was prepared. |

Review precedes publication by default. Studio should not publish content the user has not seen.

## What Memory records

Memory remembers that an artifact was generated, which knowledge revision produced it, where it was published, its content hash, and which requirements and evidence support it. Memory does not perform commits, filesystem writes, or object transfers.
