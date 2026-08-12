/**
 * The Room registry — one declarative place that says what Studio's surfaces are.
 *
 * `§13` of the UX package asks for exactly this: *"Dashboard cards, breadcrumbs,
 * navigation labels, and workflow routing should consume the registry rather
 * than duplicate Room identity."*
 *
 * Today that identity is duplicated three ways — a literal array in `App.tsx`,
 * a second literal in `AppShell`'s `NAV`, and page titles typed into each route
 * — so renaming a surface means finding three files and hoping there is not a
 * fourth.
 *
 * ## What a Room is, and what it is not
 *
 * `§8`: a Room is a route family with a focused objective. Rooms are defined by
 * **user intent, not backend service** — there is no Memory Room merely because
 * KAE-Memory exists.
 *
 * So `kind` matters. A `room` is a place work happens; a `surface` is a
 * supporting page that answers a real question without being a work
 * environment; a `settings` page configures rather than selects.
 *
 * ## Truthful availability
 *
 * `§13`'s Dashboard shows *"Room launchers with truthful availability"*, and
 * `UXA-10` forbids claiming state that is not there. `readiness` is that field,
 * and it is deliberately not a boolean:
 *
 * - `live` — the surface does real work against real data
 * - `partial` — it works and states a limit it cannot pass
 * - `awaiting-capability` — the page exists and the capability behind it does
 *   not, and it says so rather than looking broken
 *
 * A Dashboard launcher reading `awaiting-capability` can say *why* before
 * somebody clicks, which is the difference between a considered product and a
 * dead end with good typography.
 *
 * **This registry does not create Rooms.** It names what exists today at the
 * paths that exist today. Stage 5 converts pages into Rooms one at a time, and
 * `§18` is explicit that renaming a page `Room` without changing its
 * responsibility is not conversion.
 */

export type SurfaceKind = 'room' | 'surface' | 'settings'

export type SurfaceReadiness = 'live' | 'partial' | 'awaiting-capability'

export interface SurfaceDefinition {
  /** Stable across renames and route moves. Never a path. */
  id: string
  title: string
  route: string
  kind: SurfaceKind
  /** What a person comes here to do, in one sentence. */
  purpose: string
  readiness: SurfaceReadiness
  /**
   * Why it cannot do more, when `readiness` is not `live`. Required in that
   * case — an unavailable surface with no reason is the state `§16` calls out.
   */
  limit?: string
  /** Room this surface belongs under, when it is a subflow rather than a Room. */
  partOf?: string
}

/**
 * Ordered as a person would move through a project, not alphabetically and not
 * by when each was built.
 */
export const SURFACES: SurfaceDefinition[] = [
  {
    id: 'dashboard',
    title: 'Project home',
    route: '/dashboard',
    kind: 'surface',
    purpose: 'See where the project stands, what needs you, and where to go next',
    readiness: 'partial',
    limit:
      'Recent changes and per-Room attention counts need contracts that do not exist — a change feed in Memory, and §4’s work-item model.',
  },
  {
    id: 'setup',
    title: 'Project Setup',
    route: '/setup',
    kind: 'surface',
    purpose: 'Say where this project reads from and where its outputs go',
    readiness: 'partial',
    limit:
      'Becomes the progressive intake flow in Stage 4. Today it is one page rather than a sequence.',
  },
  {
    id: 'interview',
    title: 'Workspace',
    route: '/workspace',
    kind: 'room',
    purpose: 'Resolve what the project needs to know through conversation',
    readiness: 'live',
  },
  {
    id: 'sources',
    title: 'Sources',
    route: '/sources',
    kind: 'room',
    purpose: 'Everything this project reads from, and what KAE did with it',
    readiness: 'partial',
    limit:
      'Repositories and pasted text. KAE cannot decode uploaded files, and URLs and transcripts are not source kinds yet.',
  },
  {
    id: 'definition',
    title: 'Project Definition',
    route: '/definition',
    kind: 'room',
    purpose: 'Understand and agree what is being built',
    readiness: 'partial',
    limit:
      'Scope, workflows and stakeholder roles have no backend capability and say so per section.',
  },
  {
    id: 'requirements',
    title: 'Requirements',
    route: '/requirements',
    kind: 'surface',
    partOf: 'definition',
    purpose: 'Read what the project has established, grouped and filtered',
    readiness: 'partial',
    limit: 'Module ownership and test verification are not derived by anything.',
  },
  {
    id: 'modules',
    title: 'Modules',
    route: '/modules',
    kind: 'surface',
    partOf: 'architecture',
    purpose: 'Curate the components a project decomposes into',
    readiness: 'awaiting-capability',
    limit: 'KAE has no module derivation, so there is nothing to curate yet.',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    route: '/architecture',
    kind: 'room',
    purpose: 'Understand system structure and how the parts relate',
    readiness: 'awaiting-capability',
    limit: 'Nothing derives an architecture. The page states what it will hold.',
  },
  {
    id: 'dependencies',
    title: 'Dependencies',
    route: '/dependencies',
    kind: 'surface',
    partOf: 'architecture',
    purpose: 'See what must be built before what',
    readiness: 'awaiting-capability',
    limit: 'The module graph is reachable over MCP only, so this is empty on every deployment.',
  },
  {
    id: 'planning',
    title: 'Plan',
    route: '/plan',
    kind: 'room',
    purpose: 'Turn an agreed definition into ordered work',
    readiness: 'awaiting-capability',
    limit: 'Planning coverage is not measured. The page states what it is waiting for.',
  },
  {
    id: 'deliverables',
    title: 'Deliverables',
    route: '/deliverables',
    kind: 'surface',
    partOf: 'planning',
    purpose: 'Generate a development package and send it somewhere',
    readiness: 'partial',
    limit: 'Publishing is disabled on this deployment, so no destination has been proved writable.',
  },
  {
    id: 'review',
    title: 'Reviews',
    route: '/reviews',
    kind: 'room',
    purpose: 'Accept or refuse what KAE has proposed',
    readiness: 'partial',
    limit: 'Only agent proposals populate. Contradictions and gaps are not computed.',
  },
  {
    id: 'project-settings',
    title: 'Project Settings',
    route: '/settings/project',
    kind: 'settings',
    purpose: 'Configure how KAE reaches the services this project uses',
    readiness: 'live',
  },
  {
    id: 'memory',
    title: 'Memory',
    route: '/memory',
    kind: 'surface',
    purpose: 'Answer why KAE believes a statement',
    readiness: 'partial',
    limit:
      'Agent activity is not implemented; the panel says so rather than showing an empty list.',
  },
]

/** Rooms only, in registry order. What a Room switcher or Dashboard offers. */
export const ROOMS = SURFACES.filter((surface) => surface.kind === 'room')

/**
 * Paths that used to be surfaces and now resolve elsewhere.
 *
 * `§18`'s guardrail: *"Do not remove old routes until redirects/deep links and
 * replacement behavior are verified."* A merged page keeps its path — the
 * composer's Paperclip points at `/ingestion`, and it was dead for the life of
 * the product until yesterday.
 */
export const REDIRECTS: { from: string; to: string; because: string }[] = [
  {
    from: '/ingestion',
    to: '/sources',
    because: '§7 — repositories, text and files are one Source abstraction, not two pages',
  },
]

export function surfaceById(id: string): SurfaceDefinition | undefined {
  return SURFACES.find((surface) => surface.id === id)
}

export function surfaceByRoute(route: string): SurfaceDefinition | undefined {
  return SURFACES.find((surface) => surface.route === route)
}
