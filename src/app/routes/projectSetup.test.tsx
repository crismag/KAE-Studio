/**
 * Project Setup — stage one, which had no surface at all.
 *
 * KAE-Memory has modelled every field here since migration `0020`. On the
 * deployed database `project_configuration`, `publication_targets` and
 * `provider_connections` held **zero rows between them**, against 1,977
 * knowledge items. Not under-used: never written to, once.
 *
 * These assert the four things that make the page worth having, and the two it
 * must never do.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { ProjectSetup } from './ProjectSetup'
import type { SetupPort, StudioServices } from '@/services/interfaces'

/**
 * Override part of the setup port without losing the rest.
 *
 * The mock ports are classes, so `{...services.setup}` copies own properties
 * and **drops every prototype method** — producing a port whose every call is
 * `undefined is not a function`, which renders as a failed read and passes a
 * test asserting failure for the wrong reason. Delegating explicitly is longer
 * and cannot do that.
 */
function withSetup(base: StudioServices, over: Partial<SetupPort>): StudioServices {
  const port = base.setup
  return {
    ...base,
    setup: {
      getSetup: (id) => port.getSetup(id),
      configure: (id, field, value, options) => port.configure(id, field, value, options),
      registerTarget: (id, input) => port.registerTarget(id, input),
      setDefaultTarget: (id, targetId) => port.setDefaultTarget(id, targetId),
      listConnections: (id) => port.listConnections(id),
      recordConnection: (id, input) => port.recordConnection(id, input),
      authorizeConnection: (id, connectionId) => port.authorizeConnection(id, connectionId),
      ...over,
    },
  }
}

function renderSetup(patch?: (services: StudioServices) => StudioServices) {
  const base = createMockServices()
  const services = patch ? patch(base) : base
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          <ProjectSetup />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('the project can be configured through the product', () => {
  it('renders the fields KAE-Memory will actually accept', async () => {
    renderSetup()

    // The six of `KNOWN_FIELDS`. A seventh would be a control whose save always
    // fails, which is the shape of half this audit's findings.
    //
    // `primary_repository` is not among them any more: it is a picker, because
    // `§6` says a workflow page selects a configured resource rather than
    // asking somebody to type its name from memory.
    expect(await screen.findByLabelText(/filter repositories/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/branch/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/working directory/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/what kind of project/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/output format/i)).toBeInTheDocument()
  })

  it('shows what is already configured rather than an empty form', async () => {
    renderSetup()

    // The configured repository is marked in the list rather than typed into a
    // box, so "what is set" and "what is available" are one reading.
    const chosen = await screen.findByRole('option', { name: /ministry\/reporting-platform/ })
    expect(chosen).toHaveAttribute('aria-selected', 'true')
  })

  it('saves a changed field', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderSetup((services) =>
      withSetup(services, {
        configure: async (projectId, field, value, options) => {
          calls.push(`${field}=${value}`)
          return services.setup.configure(projectId, field, value, options)
        },
      }),
    )

    const branch = await screen.findByLabelText(/branch/i)
    await user.clear(branch)
    await user.type(branch, 'develop')
    await user.tab()

    expect(calls).toContain('primary_branch=develop')
  })

  it('does not save a field nobody touched', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderSetup((services) =>
      withSetup(services, {
        configure: async (projectId, field, value, options) => {
          calls.push(field)
          return services.setup.configure(projectId, field, value, options)
        },
      }),
    )

    const branch = await screen.findByLabelText(/branch/i)
    await user.click(branch)
    await user.tab()

    // Focus is not intent. A blur that writes would fill the record with
    // "confirmed by" attributions nobody made.
    expect(calls).toEqual([])
  })
})

describe('setup reports state, not a score', () => {
  it('carries no percentage anywhere', async () => {
    renderSetup()
    await screen.findByText(/where this project stands/i)

    // `ADR-0003`: a percentage over two booleans says less than the booleans,
    // and `Setup 100%` reads as "the project is 100% understood".
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('says what each state means, in words beside the colour', async () => {
    renderSetup()

    expect(await screen.findByText(/^Sources$/)).toBeInTheDocument()
    expect(screen.getByText(/a connection to it has been checked and granted/i)).toBeInTheDocument()
  })

  it('distinguishes configured from verified', async () => {
    // The distinction the whole summary exists for. A repository somebody typed
    // is configured; only a checked connection is verified, and `ADR-0003` is
    // explicit that verified means proved rather than declared.
    renderSetup((services) => withSetup(services, { listConnections: async () => [] }))

    await screen.findByText(/^Sources$/)

    expect(screen.getByText(/a repository is named\. nothing has been read/i)).toBeInTheDocument()
    // Nothing on the page claims verification, because nothing has proved it.
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })
})

describe('the output destination', () => {
  it('shows where outputs currently go', async () => {
    renderSetup()

    expect(await screen.findByText('planning documents')).toBeInTheDocument()
    expect(screen.getByText(/ministry\/reporting-platform\/docs\/planning/)).toBeInTheDocument()
  })

  it('refuses a destination with no granted connection, and says why', async () => {
    renderSetup((services) => withSetup(services, { listConnections: async () => [] }))

    expect(await screen.findByText(/grant a connection above first/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register destination/i })).toBeDisabled()
  })

  it('states that write access is unproved rather than implying it works', async () => {
    // The honest edge. Publishing is off by decision (`D-8`), so no destination
    // has been proved writable — and a page that implied otherwise would fail
    // at the last step of a long flow.
    renderSetup()

    expect(await screen.findByText(/test write is not available/i)).toBeInTheDocument()
  })
})

describe('when setup cannot be read', () => {
  it('says so instead of showing an empty form', async () => {
    // An empty setup form reads as "nothing is configured", which is the
    // opposite of "we could not tell you what is configured".
    renderSetup((services) =>
      withSetup(services, {
        getSetup: async () => {
          throw new Error('KAE-Memory did not answer within 5s')
        },
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.queryByLabelText(/source repository/i)).not.toBeInTheDocument()
  })
})
