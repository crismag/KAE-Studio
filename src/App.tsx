import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { AppShell } from '@/app/shell/AppShell'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { createLiveServices } from '@/services/live/liveServices'
import { ProjectGate } from '@/app/shell/ProjectGate'
import { ActiveProjectProvider } from '@/app/shell/activeProject'
import { SignInGate } from '@/app/shell/SignInGate'
import { RouteError } from '@/app/shell/RouteError'
import { REDIRECT_ROUTES, ROUTES } from '@/app/registries/routes'

// Hash routing: the static build must work on Hostinger shared hosting
// without server rewrite rules for client-side routes.
//
// The children come from `registries/routes`, so route identity has one home.
// It used to live in three — this array, `AppShell`'s nav labels, and a title
// typed into each page — which is three places to find when a surface is
// renamed, and no way to know there was not a fourth.
const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace />, errorElement: <RouteError /> },
      ...ROUTES.map(({ path, element }) => ({ path, element, errorElement: <RouteError /> })),
      // Merged surfaces keep their paths. A deep link that used to work still
      // does, which is what lets a page be merged at all.
      ...REDIRECT_ROUTES.map(({ path, to }) => ({
        path,
        element: <Navigate to={to} replace />,
        errorElement: <RouteError />,
      })),
      { path: '*', element: <Navigate to="/dashboard" replace />, errorElement: <RouteError /> },
    ],
  },
])

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
})

/**
 * Mock unless a live backend is named.
 *
 * `VITE_STUDIO_API` selects the trusted Studio backend; `VITE_PROJECT_ID` names
 * the project to open, because real projects have UUIDs and the prototype was
 * written against one fixture id.
 *
 * Defaulting to the mocks is deliberate: a build that silently pointed at a
 * backend that was not there would render every panel as an error, and the
 * prototype's own demonstration value would be lost.
 */
const LIVE = import.meta.env.VITE_STUDIO_API as string | undefined

/**
 * The live application, once a project has been chosen.
 *
 * `key` on the provider is doing real work: changing projects replaces the
 * services and remounts the tree, so no component keeps a value derived from
 * the project it was showing a moment ago. Without it, switching would leave
 * the previous project's rendered state visible until each query refetched --
 * which is precisely the "one project showing another's content" that started
 * all of this.
 */
function Live() {
  return (
    <ProjectGate>
      {({ id, onSwitch }) => (
        <ServiceProvider key={id} services={createLiveServices(id)}>
          <ActiveProjectProvider value={{ id, onSwitch }}>
            <RouterProvider router={router} />
          </ActiveProjectProvider>
        </ServiceProvider>
      )}
    </ProjectGate>
  )
}

export function App() {
  if (LIVE) {
    return (
      <QueryClientProvider client={queryClient}>
        {/* The gate first: resolving a project needs a session. */}
        <SignInGate>
          <Live />
        </SignInGate>
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={createMockServices()}>
        {/* Only gates a live backend. In front of the mocks there is nothing to
            sign in to, and a login screen over fixtures would be theatre. */}
        <RouterProvider router={router} />
      </ServiceProvider>
    </QueryClientProvider>
  )
}
