import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { AppShell } from '@/app/shell/AppShell'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
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
      { index: true, element: <Navigate to="/workspace" replace /> },
      { path: 'workspace', element: <Workspace /> },
      { path: 'definition', element: <ProjectDefinition /> },
      { path: 'modules', element: <Modules /> },
      { path: 'modules/:moduleId', element: <Modules /> },
      { path: 'requirements', element: <Requirements /> },
      { path: 'interfaces', element: <Interfaces /> },
      { path: 'architecture', element: <Architecture /> },
      { path: 'dependencies', element: <Dependencies /> },
      { path: 'plan', element: <Plan /> },
      { path: 'deliverables', element: <Deliverables /> },
      { path: 'reviews', element: <Reviews /> },
      { path: 'memory', element: <Memory /> },
      { path: '*', element: <Navigate to="/workspace" replace /> },
    ],
  },
])

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
})

const services = createMockServices()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <RouterProvider router={router} />
      </ServiceProvider>
    </QueryClientProvider>
  )
}
