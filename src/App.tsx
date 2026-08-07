import { useEffect, useState } from 'react'
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
const LIVE = import.meta.env.VITE_STUDIO_API as string | undefined
const PINNED = import.meta.env.VITE_PROJECT_ID as string | undefined

/**
 * Which project this session is about.
 *
 * A build-time id works for a developer running one project and does not
 * survive deployment: the same bundle is served to everyone, so baking an id
 * into it means the deployed app shows one project forever and a fresh
 * environment shows none at all. That is what a deployed build did — it fell
 * back to the prototype's fixture id and rendered an empty page with no
 * explanation.
 *
 * So it is resolved at runtime when nothing is pinned. First project for now,
 * which is honest for a single-operator deployment and is not a project
 * picker — that is a product decision, and this is not the place to make it.
 */
function useResolvedProject(): { id?: string; state: 'resolving' | 'ready' | 'none' } {
  const [id, setId] = useState<string | undefined>(PINNED)
  const [state, setState] = useState<'resolving' | 'ready' | 'none'>(
    PINNED ? 'ready' : 'resolving',
  )

  useEffect(() => {
    if (PINNED || !LIVE) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`${LIVE}/api/projects`, { credentials: 'include' })
        const projects = response.ok ? await response.json() : []
        if (cancelled) return
        const first = Array.isArray(projects) && projects.length ? projects[0].id : undefined
        setId(first)
        setState(first ? 'ready' : 'none')
      } catch {
        if (!cancelled) setState('none')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { id, state }
}

function Live() {
  const { id, state } = useResolvedProject()

  if (state === 'resolving') return <Centered>Finding your project…</Centered>
  if (state === 'none')
    return (
      <Centered>
        <p>No project exists yet in this deployment.</p>
        <p style={{ opacity: 0.7, fontSize: 13, marginTop: 8 }}>
          Nothing is wrong — there is simply nothing to show. Create one through the API and
          reload.
        </p>
      </Centered>
    )

  return (
    <ServiceProvider services={createLiveServices(id)}>
      <RouterProvider router={router} />
    </ServiceProvider>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>{children}</div>
    </div>
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
