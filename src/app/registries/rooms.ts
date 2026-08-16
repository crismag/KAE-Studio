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

/**
 * Where a surface sits in the navigation (`NAV-01`, `D-95`).
 *
 * The live sweep counted the interactive controls on all fourteen destinations.
 * Six of them — Definition, Modules, Architecture, Dependencies, Plan, Memory —
 * have **two buttons each, and both belong to the shell**. Nothing on those
 * pages can be operated. They were given the same weight in the sidebar as the
 * four rooms where work actually happens, so a first-time reader met fourteen
 * equal choices and no way to tell which four were the product.
 *
 * The rule this encodes: **a `primary` destination can be operated.** A page
 * whose only controls belong to the shell is something you *read*, and reading
 * is what `understanding` is for.
 *
 * Nothing is removed. Every route still resolves, every deep link still works,
 * and the grouped sections are open-able rather than hidden — `§18`'s guardrail
 * and the reason this is a navigation change and not a deletion.
 */
export type SurfaceGroup = 'primary' | 'understanding' | 'settings'

export type SurfaceReadiness = 'live' | 'partial' | 'awaiting-capability'

export interface SurfaceDefinition {
  /** Stable across renames and route moves. Never a path. */
  id: string
  title: string
  route: string
  kind: SurfaceKind
  /**
   * Which navigation section this belongs to.
   *
   * Distinct from `kind`, which says what a surface *is*. A `room` can be
   * `understanding` — Architecture is a Room by intent and a reading surface in
   * practice, because nothing on it can be operated yet.
   */
  group: SurfaceGroup
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
    group: 'primary',
    title: 'Project home',
    route: '/dashboard',
    kind: 'surface',
    purpose: 'See where the project stands, what needs you, and where to go next',
    readiness: 'partial',
    limit:
      'Recent changes and per-Room attention counts need contracts that do not exist — a change feed in Memory, and §4’s work-item model.',
  },
  {
    id: 'attention',
    group: 'primary',
    title: 'What needs you',
    route: '/attention',
    kind: 'room',
    purpose: 'Act on the few things synthesis raised, instead of on every sentence KAE read',
    readiness: 'partial',
    // Second, directly after Home, because it answers Home's second question
    // and is the shortest list in the product. Reviews — the 803 rows it draws
    // from — stays below it until `OD-SYN-3` retires it.
    //
    // What this page **is**. It reads the queue and produces it; it does not
    // close an item, because which gestures an item accepts is carried on the
    // item and turning those into controls is `SYN-4`.
    limit:
      'Items can be read and re-produced, not resolved from here. Only material unknowns raise items yet — the other five domain synthesizers are unbuilt.',
  },
  {
    id: 'setup',
    group: 'settings',
    title: 'Project Setup',
    route: '/setup',
    kind: 'surface',
    purpose: 'See how this project is set up, and where its outputs go',
    readiness: 'partial',
    // What this page **is**, not what it will become. It stopped selecting
    // repositories in `D-81` — Sources does that — and describing it as a
    // future intake sequence told the Dashboard to advertise a wizard nobody
    // is building (`D-91`, `§6`).
    limit:
      'Selecting sources happens in Sources; this page summarises what is configured. Publishing is off, so no destination has been proved writable.',
  },
  {
    id: 'interview',
    group: 'primary',
    title: 'Workspace',
    route: '/workspace',
    kind: 'room',
    purpose: 'Resolve what the project needs to know through conversation',
    readiness: 'live',
  },
  {
    id: 'sources',
    group: 'primary',
    title: 'Sources',
    route: '/sources',
    kind: 'room',
    purpose: 'Everything this project reads from, and what KAE did with it',
    readiness: 'partial',
    limit:
      'Repositories, pasted text, and uploaded PDF, Word, Excel or text files. URLs and transcripts are not source kinds yet.',
  },
  {
    id: 'definition',
    group: 'understanding',
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
    group: 'understanding',
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
    group: 'understanding',
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
    group: 'understanding',
    title: 'Architecture',
    route: '/architecture',
    kind: 'room',
    purpose: 'Understand system structure and how the parts relate',
    // Was `awaiting-capability` on the grounds that *"nothing derives an
    // architecture"*. Something does — the module decomposition and its
    // dependencies — and `ARC-1b` draws it. What is still underived is the
    // rest of an architecture, which the page continues to say.
    readiness: 'partial',
    limit:
      'The module decomposition is drawn. Component design, the data model ' +
      'and deployment topology are not derived by anything.',
  },
  {
    id: 'dependencies',
    group: 'understanding',
    title: 'Dependencies',
    route: '/dependencies',
    kind: 'surface',
    partOf: 'architecture',
    purpose: 'See what must be built before what',
    // Was `awaiting-capability`, limited by *"the module graph is reachable
    // over MCP only, so this is empty on every deployment"* — true, and fixed
    // by `D-19` rather than by this page.
    readiness: 'partial',
    limit:
      'Modules are proposed through KAE-Memory directly. Studio can read the ' +
      'graph and has no contract for defining one.',
  },
  {
    id: 'planning',
    group: 'understanding',
    title: 'Plan',
    route: '/plan',
    kind: 'room',
    purpose: 'Turn an agreed definition into ordered work',
    readiness: 'awaiting-capability',
    limit: 'Planning coverage is not measured. The page states what it is waiting for.',
  },
  {
    id: 'review',
    group: 'primary',
    title: 'Reviews',
    route: '/reviews',
    kind: 'room',
    purpose: 'Accept or refuse what KAE has proposed',
    readiness: 'partial',
    // This said *"contradictions and gaps are not computed"*, which stopped
    // being true when `D-30` connected KAE-Memory's review — and `D-38` puts
    // every limit on the Dashboard, so the product was telling people it could
    // not do something it does (`D-49`).
    //
    // What remains uncomputed is narrower and different: open decisions live on
    // the workspace by choice, a *requirement-level* gap is nobody's
    // comparison, and verification needs test links KAE does not record.
    limit:
      'Requirement-level gaps and test verification are not computed. Area coverage, ' +
      'contradictions, duplicates and open blockers arrive from KAE-Memory’s review.',
  },
  {
    id: 'deliverables',
    group: 'primary',
    title: 'Deliverables',
    route: '/deliverables',
    kind: 'surface',
    partOf: 'planning',
    purpose: 'Generate a development package and send it somewhere',
    readiness: 'partial',
    limit: 'Publishing is disabled on this deployment, so no destination has been proved writable.',
  },
  {
    id: 'project-settings',
    group: 'settings',
    title: 'GitHub',
    route: '/settings/project',
    kind: 'settings',
    purpose: 'Connect GitHub so this project can read repositories',
    readiness: 'live',
  },
  {
    id: 'diagnostics',
    group: 'settings',
    title: 'Knowledge health',
    route: '/diagnostics',
    kind: 'surface',
    purpose: 'Read the pipeline’s raw counts as an operator, where they are not a person’s work',
    // Not `live`: the registry's own rule is that a surface carrying a limit is
    // not finished, and this one is half of `EPI-7` by design.
    readiness: 'partial',
    // `EPI-7`/`D-156`. The destination, built before anything moves to it. The
    // counts it shows are still on the primary surfaces as well, which is the
    // second half of the row and deliberately not this one.
    limit:
      'The same counts still appear on Reviews, Requirements and the Dashboard; nothing has moved here yet.',
  },
  {
    id: 'memory',
    group: 'understanding',
    title: 'Memory',
    route: '/memory',
    kind: 'surface',
    purpose: 'Answer why KAE believes a statement',
    readiness: 'partial',
    limit:
      'Agent activity is not implemented; the panel says so rather than showing an empty list.',
  },
]

/**
 * The surfaces in one navigation section, in registry order.
 *
 * The order is the registry's, so *what the sidebar shows* and *what order it
 * shows it in* stay one fact in one file. A second array here would be the
 * fourth place surface identity lives, which is what this registry replaced.
 */
export function surfacesInGroup(group: SurfaceGroup): SurfaceDefinition[] {
  return SURFACES.filter((surface) => surface.group === group)
}

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
