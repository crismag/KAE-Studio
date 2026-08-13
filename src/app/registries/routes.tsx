/**
 * One visible place that maps a user-facing route to the page that owns it.
 *
 * `§13`: *"There must be one obvious place that maps user-facing routes to page
 * owners. Avoid route definitions scattered across unrelated components."*
 *
 * They were not scattered — `App.tsx` held them all — but route *identity* was
 * in three files: the router array, `AppShell`'s `NAV` labels, and a title typed
 * into each page. Renaming a surface meant finding three and hoping there was
 * not a fourth.
 *
 * Now identity lives in [`rooms.ts`](rooms.ts) and this file pairs each entry
 * with its component. The router and the navigation both read from here, so the
 * two cannot disagree about what exists.
 *
 * ## Why the elements are eager
 *
 * No `React.lazy`. Studio is one bundle served from static hosting, and code
 * splitting on thirteen routes that share a projection would trade a real
 * simplicity for a saving nobody has measured. When the bundle warrants it, this
 * is the file where splitting happens — which is most of the point of having it.
 */

import type { ReactElement } from 'react'

import { Architecture } from '@/pages/rooms/architecture/ArchitectureRoom'
import { Dashboard } from '@/app/routes/Dashboard'
import { Deliverables } from '@/app/routes/Deliverables'
import { Dependencies } from '@/app/routes/Dependencies'
import { Memory } from '@/app/routes/Memory'
import { Modules } from '@/app/routes/Modules'
import { Plan } from '@/app/routes/Plan'
import { ProjectDefinition } from '@/pages/rooms/definition/DefinitionRoom'
import { ProjectSettings } from '@/app/routes/ProjectSettings'
import { ProjectSetup } from '@/app/routes/ProjectSetup'
import { Requirements } from '@/app/routes/Requirements'
import { Reviews } from '@/pages/rooms/review/ReviewsRoom'
import { SourcesRoom } from '@/pages/rooms/sources/SourcesRoom'
import { InterviewRoom } from '@/pages/rooms/interview/InterviewRoom'
import { REDIRECTS, SURFACES, type SurfaceDefinition } from './rooms'

/** Surface id → the component that renders it. */
const PAGES: Record<string, () => ReactElement> = {
  dashboard: () => <Dashboard />,
  setup: () => <ProjectSetup />,
  interview: () => <InterviewRoom />,
  sources: () => <SourcesRoom />,
  definition: () => <ProjectDefinition />,
  requirements: () => <Requirements />,
  modules: () => <Modules />,
  architecture: () => <Architecture />,
  dependencies: () => <Dependencies />,
  planning: () => <Plan />,
  deliverables: () => <Deliverables />,
  review: () => <Reviews />,
  'project-settings': () => <ProjectSettings />,
  memory: () => <Memory />,
}

export interface RouteDefinition {
  surface: SurfaceDefinition
  /** Router path — the registry route without its leading slash. */
  path: string
  element: ReactElement
}

/**
 * Every route, derived from the registry rather than listed again.
 *
 * A surface with no component **throws at module load**, which is the point: a
 * registry entry nobody can reach is the "declared and uncalled" defect this
 * estate has found seven times, and here it is a startup failure rather than a
 * blank page.
 */
export const ROUTES: RouteDefinition[] = SURFACES.map((surface) => {
  const page = PAGES[surface.id]
  if (!page) {
    throw new Error(
      `the surface registry declares "${surface.id}" (${surface.route}) and no page renders it`,
    )
  }
  return { surface, path: surface.route.replace(/^\//, ''), element: page() }
})

/**
 * Old paths, kept alive.
 *
 * Exported beside the routes so a reader sees both halves of the migration in
 * one file: what exists, and what used to.
 */
export const REDIRECT_ROUTES = REDIRECTS.map((redirect) => ({
  path: redirect.from.replace(/^\//, ''),
  to: redirect.to,
}))
