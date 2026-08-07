import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { AppShell } from '@/app/shell/AppShell'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { createLiveServices } from '@/services/live/liveServices'
import { SignInGate } from '@/app/shell/SignInGate'
import { RouteError } from '@/app/shell/RouteError'
import { Workspace } from '@/app/routes/Workspace'
import { ProjectDefinition } from '@/app/routes/ProjectDefinition'
import { Modules } from '@/app/routes/Modules'
import { Requirements } from '@/app/routes/Requirements'
import { Interfaces } from '@/app/routes/Interfaces'
import { Architecture } from '@/app/routes/Architecture'
import { Dependencies } from '@/app/routes/Dependencies'
import { Plan } from '@/app/routes/Plan'
import { Deliverables } from '@/app/routes/Deliverables'
import { Reviews } from '@/app/routes/Reviews'
import { Memory } from '@/app/routes/Memory'

// Hash routing: the static build must work on Hostinger shared hosting
// without server rewrite rules for client-side routes.
const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/workspace" replace />, errorElement: <RouteError /> },
      { path: 'workspace', element: <Workspace />, errorElement: <RouteError /> },
      { path: 'definition', element: <ProjectDefinition />, errorElement: <RouteError /> },
      { path: 'modules', element: <Modules />, errorElement: <RouteError /> },
      { path: 'modules/:moduleId', element: <Modules />, errorElement: <RouteError /> },
      { path: 'requirements', element: <Requirements />, errorElement: <RouteError /> },
      { path: 'interfaces', element: <Interfaces />, errorElement: <RouteError /> },
      { path: 'architecture', element: <Architecture />, errorElement: <RouteError /> },
      { path: 'dependencies', element: <Dependencies />, errorElement: <RouteError /> },
      { path: 'plan', element: <Plan />, errorElement: <RouteError /> },
      { path: 'deliverables', element: <Deliverables />, errorElement: <RouteError /> },
      { path: 'reviews', element: <Reviews />, errorElement: <RouteError /> },
      { path: 'memory', element: <Memory />, errorElement: <RouteError /> },
      { path: '*', element: <Navigate to="/workspace" replace />, errorElement: <RouteError /> },
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
const services = import.meta.env.VITE_STUDIO_API
  ? createLiveServices(import.meta.env.VITE_PROJECT_ID as string | undefined)
  : createMockServices()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        {/* Only gates a live backend. In front of the mocks there is nothing to
            sign in to, and a login screen over fixtures would be theatre. */}
        {import.meta.env.VITE_STUDIO_API ? (
          <SignInGate>
            <RouterProvider router={router} />
          </SignInGate>
        ) : (
          <RouterProvider router={router} />
        )}
      </ServiceProvider>
    </QueryClientProvider>
  )
}
