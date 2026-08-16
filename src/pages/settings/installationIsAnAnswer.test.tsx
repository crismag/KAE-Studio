/**
 * Installing the App must change what this page says (`D-106`).
 *
 * The owner's report, and it is three symptoms of one cause:
 *
 * > After the connector is installed in GitHub, the page does not know it has
 * > been completed… when I load the page again, it asks me to setup the GitHub
 * > connection again. It does not remember that it's already been configured.
 *
 * The page did not fail to notice. It was never looking. *Is GitHub connected?*
 * was answered from the project's connection records alone, and installing the
 * App creates none — so a completed install could not change the answer, and
 * the page offered the same button to somebody who had just pressed it.
 *
 * `D-90` keeps installation and connection apart deliberately: one is a fact
 * about the deployment, the other about the project. That split stays. What
 * these assert is that the **question** changed — *can this project read
 * GitHub?* — which an installation answers on its own.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Connections } from './SettingsPage'
import type { InstallationListing, StudioServices } from '@/services/interfaces'

/**
 * `useDeploymentStatus` reads `/api/status` with a bare `fetch`, not through a
 * service port, so jsdom answers nothing and the App slug is undefined — which
 * makes `ConnectGitHub` render null and hides the very link under test. Stubbed
 * rather than worked around: the slug is what the Connect URL is built from.
 */
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            github_app_slug: 'kae-github-connector-app',
            github_app: 'configured',
            github_source: 'not configured',
            memory: 'reachable',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    ),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const NONE: InstallationListing = { installations: [], unavailableReason: '', selected: '' }

const INSTALLED: InstallationListing = {
  installations: [{ installationId: 154071811, account: 'crismag', repositorySelection: 'all' }],
  unavailableReason: '',
  selected: '',
}

function show({
  installations,
  connections,
}: {
  installations: InstallationListing
  connections: unknown[]
}) {
  const base = createMockServices()
  const port = base.acquisition
  const services: StudioServices = {
    ...base,
    // `useMemoryConnections` reads the **setup** port, not `memory` — an
    // earlier version of this file overrode the wrong one, so the mock's own
    // connections were still returned and every assertion passed against a
    // mutation that removed the fix entirely. A guard nobody has seen fail is a
    // guard nobody knows the shape of.
    setup: {
      ...base.setup,
      listConnections: async () => connections as never,
    } as StudioServices['setup'],
    acquisition: {
      ...Object.fromEntries(
        Object.keys(port).map((key) => [
          key,
          (...args: unknown[]) => (port as never as Record<string, Function>)[key](...args),
        ]),
      ),
      installations: async () => installations,
    } as never,
  }
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
      >
        <ServiceProvider services={services}>
          <Connections />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('what the page does with a completed install', () => {
  it('stops asking somebody to connect once the App is installed', async () => {
    /**
     * The reported defect, stated as the assertion that would have caught it.
     * No connection record exists — installing the App never creates one — and
     * the page must still not offer the first-run Connect panel.
     */
    show({ installations: INSTALLED, connections: [] })

    expect(await screen.findByText(/installed on/i)).toBeInTheDocument()
    expect(screen.queryByText(/GitHub is not available to connect/i)).not.toBeInTheDocument()
  })

  it('names the account it was installed on', async () => {
    // "Connected" without saying *to what* is the state this page kept
    // rendering. An installation carries the account; showing it is the
    // difference between a claim and a fact somebody can check.
    show({ installations: INSTALLED, connections: [] })

    expect((await screen.findAllByText(/crismag/)).length).toBeGreaterThan(0)
  })

  it('still offers Connect when nothing is installed and nothing is recorded', async () => {
    // The other half. A page that never offers the control is as broken as one
    // that never stops.
    show({ installations: NONE, connections: [] })

    expect(await screen.findByRole('link', { name: /^connect/i })).toBeInTheDocument()
  })

  it('sends somebody to GitHub in a new tab, not out of KAE', async () => {
    /**
     * The second symptom: *"it uses the same browser page so it takes me away
     * from the kae site"*. GitHub's install flow replaces the tab and has
     * nowhere to send anybody back to, so finishing meant navigating back by
     * hand — to a page that then had to be reloaded before it noticed.
     */
    show({ installations: NONE, connections: [] })

    const link = await screen.findByRole('link', { name: /^connect/i })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    expect(link.getAttribute('href')).toContain('/installations/new')
  })
})
