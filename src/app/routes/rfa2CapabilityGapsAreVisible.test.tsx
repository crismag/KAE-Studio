/**
 * RFA-2 · An unavailable capability says so, on screen.
 *
 * The audit's central finding pointed at the rendered page rather than at the
 * adapter. `AUD-002` was that Studio's backend computes capability gaps with
 * real care and the adapter dropped them; the conservation check written for it
 * asserts they survive the *mapper*.
 *
 * That check passed while `/definition` looked up a bare `value` against a
 * backend emitting `definition.value` — so every capability note returned
 * `undefined` and the panels rendered as blankly as before. A repair that looks
 * right and delivers nothing is this audit's own subject, and the guard did not
 * catch it because it stopped one layer short of a person.
 *
 * So this one goes all the way: given a projection carrying gaps, the reasons
 * must be **on the screen**.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { ProjectDefinition } from './ProjectDefinition'
import { Modules } from './Modules'
import type { ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

const VALUE_REASON = 'The area covers problem and value together, and nothing distinguishes them.'
const WORKFLOWS_REASON = 'Memory holds statements, not sequences, so there is nothing to order.'
const MODULES_REASON = 'Studio curation is a separate contract, not yet reconciled.'

/** A projection shaped like the live one, carrying gaps a person must see. */
function withGaps(base: ProjectProjection): ProjectProjection {
  return {
    ...base,
    definition: { ...base.definition, value: '', workflows: [] },
    modules: [],
    unavailable: [
      { section: 'definition.value', reason: VALUE_REASON },
      { section: 'definition.workflows', reason: WORKFLOWS_REASON },
    ],
    modulesGap: {
      capability: 'modules',
      reason: MODULES_REASON,
      state: 'planned',
      provedInstead: [],
    },
  }
}

function renderWithProjection(node: React.ReactNode) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      getProjection: async (id: string) => withGaps(await original(id)),
    },
  }

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>{node}</ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('a capability gap reaches the screen', () => {
  it('states why the value section is empty, in the backend`s own words', async () => {
    renderWithProjection(<ProjectDefinition />)

    // Verbatim. A reason paraphrased on the way through is one a person cannot
    // act on, and the backend wrote these to be read.
    expect(await screen.findByText(VALUE_REASON)).toBeInTheDocument()
  })

  it('states why business workflows are empty', async () => {
    renderWithProjection(<ProjectDefinition />)

    expect(await screen.findByText(WORKFLOWS_REASON)).toBeInTheDocument()
  })

  it('states why no modules exist rather than showing a bare zero', async () => {
    renderWithProjection(<Modules />)

    expect(await screen.findByText(MODULES_REASON)).toBeInTheDocument()
    // And the counts are gone: "0 accepted" beside a capability that cannot
    // produce a module reads as a project with none.
    expect(screen.queryByText(/0 accepted/i)).not.toBeInTheDocument()
  })

  it('says nothing when there is nothing to say', async () => {
    // The other half, and the one that keeps this honest. A project whose
    // sections all computed must not carry a standing notice about limits it
    // does not have — a banner on every project is a banner nobody reads.
    renderWithProjection(<Modules />)
    await screen.findByText(MODULES_REASON)

    const services = createMockServices()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider services={services}>
            <ProjectDefinition />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByText(VALUE_REASON)).not.toBeInTheDocument()
  })
})
