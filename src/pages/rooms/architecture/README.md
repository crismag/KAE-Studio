# Architecture Room

**Route:** `/architecture` · **Registry id:** `architecture`

`§8`'s Room: _"understand system structure and how the parts relate."_

**Three routes, one Room.** `/dependencies` and `/modules` are registered
`partOf: 'architecture'` — subflows with their own paths. `§13` puts a Room and
its subflows in one folder and the directive says one route per commit, so this
folder arrives over three commits, and all three are now here (`D-52`).

## Purpose

What this project decomposes into and how the parts depend on each other —
drawn, and readable as a list.

## User questions it answers

- What are the parts of this system?
- What has to be built before what?
- What does this module depend on, and what breaks if I change it?
- Which of this has anybody actually agreed to?
- What is still not derived at all?

## Entry conditions

None. A project with no modules opens here and is told it has none — which is a
different sentence from _"the graph could not be read"_, and the distinction is
the whole of `D-19`.

## Data it consumes

| Port         | For                                                    |
| ------------ | ------------------------------------------------------ |
| `projection` | `architecture` — modules, edges, build order, its note |

## Contextual toolbelt

`§9`. **Read it as a list**, which leaves for `/dependencies` rather than
redrawing the same graph here, and **selecting a module** in the subflow to see
what it depends on and what depends on it.

`§9`'s example also lists Components, Decisions and Compare. **None exists**,
and none is stubbed: nothing derives a component design, architecture decision
records have no producer, and there is no second architecture to compare against.
A belt loop with nothing on it teaches somebody the Room is broken rather than
young.

Nothing on this belt belongs in global navigation.

## Empty, loading and degraded states

Loading · a project with no modules, said as _this project has none_ · a graph
KAE-Memory could not read, which is a fact about the deployment rather than the
project · a module Memory left out of build order, shown at the end rather than
dropped, because a module missing from this page is one a reader believes does
not exist.

## Exit conditions

None. The decomposition changes when somebody defines a module, which happens
over MCP and not here.

## Owns

`ArchitectureRoom.tsx` and `ArchitectureDiagram.tsx`, which nothing outside this
Room uses.

`DependenciesSubflow.tsx` and `buildOrderLayers.ts`, which the diagram and the
list both use — a Room folder is exactly where a thing shared by two routes of
one Room belongs, and it moved when the second of them did rather than before.

`ModulesSubflow.tsx`, the curation surface, which states its own gap: KAE has no
module derivation, so there is nothing to curate. It uses `SeverityBadge`, which
**stays shared** — the Interview Room and the Definition Room use it too, and a
badge for a grade is not architecture-specific.

## Does **not** own

- **Deriving an architecture.** Nothing does. Modules are proposed over MCP;
  this Room renders what exists and states that the rest — component design, the
  data model, deployment topology — is derived by nothing.
- **Build order.** KAE-Memory computes it with a stable tie-break; this Room
  renders **Memory's order** and never recomputes one. Two orders that disagree
  is a question nobody can answer from a screen.
- **Curation.** Proposing a module or drawing an edge is Memory's MCP write
  path. Studio has no contract for it and simulates none (`D-19`).
- **Deciding what a dependency on a retired module means.** The drawing shows
  it; whether it is a problem is a real architectural question and not one a
  colour may answer (`ARC-RETIRED`).
- **Meaning in the drawing beyond one thing.** Position carries build-order
  depth. Box size is uniform because Memory holds nothing that would justify
  varying it, and the caption says so, because a reader finds meaning in any
  variation a diagram offers them.

## Transitions out

`/dependencies` for the same graph as a list · `/modules` for curation, which
states its own gap · `/workspace` to discuss what is missing.

## Tests

`architectureIsDrawn.test.tsx` · `architectureIsReadable.test.tsx` (the
`/dependencies` subflow, which moves with it).
