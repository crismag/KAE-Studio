/**
 * `D-334` · Configured and reachable are different states, and the panel could
 * only see the first.
 *
 * *What can be generated now* branched on `artifacts === 'configured'`, which is
 * a URL string being non-empty. A deployment whose KAE-Artifacts was stopped
 * still reported `configured`, so the panel promised a package that every
 * generation route would refuse — and the promise outlived the service.
 *
 * The three states have three different remedies: nothing to configure, a
 * setting to fill in, and a service to start. This asserts the screen tells
 * them apart.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { GenerableNow } from '@/pages/rooms/interview/InterviewRoom'
import type { ProjectProjection } from '@/domain/types'

/** A project with nothing of its own to say, so the deployment is the subject. */
const PROJECTION = {
  modules: [],
  openDecisions: [],
} as unknown as ProjectProjection

function statusSaying(body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
  )
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={createMockServices()}>
          <GenerableNow projection={PROJECTION} />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a configured but stopped KAE-Artifacts', () => {
  it('says the service is not answering rather than promising a package', async () => {
    statusSaying({ artifacts: 'configured', artifacts_reachable: false })

    renderPanel()

    expect(await screen.findByText(/is not answering/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/the project context package can be generated/i),
    ).not.toBeInTheDocument()
  })

  it('does not blame configuration for a service that is merely down', async () => {
    // The two sentences send an operator to different places — one to a
    // settings file, one to a process. Collapsing them costs the wrong search.
    statusSaying({ artifacts: 'configured', artifacts_reachable: false })

    renderPanel()

    await screen.findByText(/is not answering/i)
    expect(screen.queryByText(/not configured on this deployment/i)).not.toBeInTheDocument()
  })

  it('still promises the package when the service answers', async () => {
    // The half that keeps this honest. A panel that never promises anything is
    // not a working panel, it is a broken one that cannot be told apart.
    statusSaying({ artifacts: 'configured', artifacts_reachable: true })

    renderPanel()

    expect(
      await screen.findByText(/the project context package can be generated/i),
    ).toBeInTheDocument()
  })

  it('keeps the unconfigured sentence where there is no service at all', async () => {
    // Absent, not `false`: an unfilled setting is not an outage, and reporting
    // one would send an operator hunting a process nobody started.
    statusSaying({ artifacts: 'not configured' })

    renderPanel()

    expect(await screen.findByText(/not configured on this deployment/i)).toBeInTheDocument()
    expect(screen.queryByText(/is not answering/i)).not.toBeInTheDocument()
  })
})
