/**
 * The Dashboard walking skeleton, and the four things it must not invent.
 *
 * Stage 3: *"Build the smallest truthful Dashboard… Do not invent readiness,
 * tasks, room status, or recent changes if the backing contract does not exist.
 * Document missing contracts first."*
 *
 * That sentence is the whole test plan. A dashboard is the easiest surface in
 * any product to fill with plausible numbers, because the shape is so familiar
 * that a reader supplies the meaning — which is why `UXA-10` names it first:
 * *"no dashboard, Room, board, progress, or readiness component claims
 * unavailable or invented state."*
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Dashboard } from './Dashboard'
import { SURFACES } from '@/app/registries/rooms'
import type { ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function renderDashboard(shape?: (base: ProjectProjection) => ProjectProjection) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string) => {
        const base = await original(id)
        return shape ? shape(base) : base
      },
      classify: (id: string) => services.projection.classify(id),
    },
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>
          <Dashboard />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('the journey', () => {
  it('marks the stage the project reports', async () => {
    renderDashboard((base) => ({ ...base, health: { ...base.health, phase: 'defining' } }))

    const active = await screen.findByText('Definition')
    expect(active).toHaveAttribute('aria-current', 'step')
  })

  it('marks nothing when the phase is one it does not recognise', async () => {
    // Guessing a position would put a project somewhere it is not. Marking the
    // first stage is the tempting default and it is a claim.
    renderDashboard((base) => ({ ...base, health: { ...base.health, phase: 'something-new' } }))

    expect(
      await screen.findByText(/reports a stage this view does not recognise/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Setup')).not.toHaveAttribute('aria-current')
  })
})

describe('what needs you', () => {
  it('counts things that exist and links each one somewhere', async () => {
    renderDashboard()

    const proposals = await screen.findByText(/proposed statement.* awaiting your decision/i)
    expect(proposals.closest('a')).toHaveAttribute('href', '/reviews')
  })

  it('renders no row for a count of zero', async () => {
    // A permanent list of zeroes is `Reviews 81` inverted: it trains the eye
    // past the panel, so the one time a row appears nobody sees it.
    renderDashboard((base) => ({
      ...base,
      findings: [],
      openDecisions: [],
      contradictions: { count: 0, listable: true, reason: '' },
      extractionCoverage: { succeeded: 3, abandoned: 0, complete: true },
    }))

    expect(
      await screen.findByText(/nothing is waiting on you that KAE can currently detect/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /awaiting your decision/i })).not.toBeInTheDocument()
  })

  it('says "that KAE can detect" rather than "all clear"', async () => {
    // The narrower claim is the true one: three of the five review groups are
    // not computed at all, so silence is not evidence of nothing.
    renderDashboard((base) => ({
      ...base,
      findings: [],
      openDecisions: [],
      contradictions: { count: 0, listable: true, reason: '' },
      extractionCoverage: { succeeded: 3, abandoned: 0, complete: true },
    }))

    expect(await screen.findByText(/that KAE can currently detect/i)).toBeInTheDocument()
    expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument()
  })

  it('surfaces content loss as something needing a person', async () => {
    renderDashboard((base) => ({
      ...base,
      extractionCoverage: { succeeded: 3, abandoned: 2, complete: false },
    }))

    const row = await screen.findByText(/part of what you gave KAE was never read/i)
    expect(row.closest('a')).toHaveAttribute('href', '/ingestion')
  })
})

describe('Room launchers tell the truth before they are clicked', () => {
  it('says what a Room is waiting for', async () => {
    renderDashboard()

    // `§13`: truthful availability. A person should not have to open a Room to
    // discover it cannot do its job.
    //
    // Read from the registry rather than quoting one Room's sentence. The
    // first version of this asserted *"nothing derives an architecture"* and
    // failed the day that stopped being true — which is the check working, and
    // also a test that has to be rewritten every time the product improves.
    // What `§13` actually requires is that **every** limit reaches the card.
    const limited = SURFACES.filter((surface) => surface.kind === 'room' && surface.limit)

    expect(limited.length).toBeGreaterThan(0)
    for (const room of limited) {
      expect(
        await screen.findByText(room.limit!),
        `${room.title} states a limit the Dashboard does not show`,
      ).toBeInTheDocument()
    }
  })

  it('marks a Room that cannot do its job yet', async () => {
    renderDashboard()

    const waiting = SURFACES.find(
      (surface) => surface.kind === 'room' && surface.readiness === 'awaiting-capability',
    )!
    // Found through its own purpose line: a Room's title can also be a journey
    // stage, and appear twice.
    const card = (await screen.findByText(waiting.purpose)).closest('a')!

    expect(card).toHaveTextContent('Not yet')
  })

  it('does not mark a Room that works', async () => {
    renderDashboard()

    const workspace = (await screen.findByText('Workspace')).closest('a')!
    expect(workspace).not.toHaveTextContent('Not yet')
  })
})

describe('coverage carries a denominator, never a percentage', () => {
  it('says how many of how many', async () => {
    renderDashboard()

    // `§3` and `ADR-0003` agree: `7 of 10 areas` says what `70%` cannot,
    // because the reader can tell what the whole is.
    expect(await screen.findByText(/areas have enough confirmed evidence/i)).toBeInTheDocument()
  })

  it('shows no percentage anywhere on the page', async () => {
    renderDashboard()
    await screen.findByText(/current journey/i)

    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument()
  })

  it('says when nothing has been assessed rather than showing zero of zero', async () => {
    renderDashboard((base) => ({ ...base, health: { ...base.health, coverage: [] } }))

    expect(await screen.findByText(/no area has been assessed yet/i)).toBeInTheDocument()
  })
})

describe('what the skeleton deliberately omits', () => {
  it('has no recent-changes panel', async () => {
    // `recentChanges` is `[]` in the live adapter and nothing in Memory
    // produces a change feed (`AUD-038`). A panel would be permanently empty,
    // which reads as "nothing has happened".
    renderDashboard()
    await screen.findByText(/current journey/i)

    expect(screen.queryByText(/recent changes/i)).not.toBeInTheDocument()
  })

  it('marks its next action as derived rather than ranked', async () => {
    // `§4`'s work-item model is Stage 6. Until it exists the action comes from
    // `floorAction`, and saying so is the difference between a recommendation
    // and a guess wearing one's clothes.
    renderDashboard()

    // The sentence itself, not the word. `/derived/i` matched this *and* a
    // Room limit reading "not derived by anything", so the assertion started
    // failing on an unrelated change — a matcher loose enough to hit two
    // different claims was never testing this one.
    expect(
      await screen.findByText(/Suggested from where this project has got to/i),
    ).toBeInTheDocument()
  })
})

describe('when the project cannot be read', () => {
  it('says so instead of rendering an empty dashboard', async () => {
    // The worst failure this page could have: every count legitimately zero,
    // every panel empty, and a person concluding their project is empty.
    const services = createMockServices()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider
            services={{
              ...services,
              projection: {
                ...services.projection,
                getProjection: async () => {
                  throw new Error('KAE-Memory did not answer within 5s')
                },
                classify: (id: string) => services.projection.classify(id),
              },
            }}
          >
            <Dashboard />
          </ServiceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be read/i)
    expect(screen.queryByText(/current journey/i)).not.toBeInTheDocument()
  })
})
