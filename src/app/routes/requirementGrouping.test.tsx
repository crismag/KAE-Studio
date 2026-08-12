/**
 * `PPA-15` — *"KAE generated 70 things I don't know how to organise."*
 *
 * The customer's original complaint restated in the product's own words, and
 * the reason grouping exists. Memory computes which statements say adjacent
 * things; this is the half that makes it visible, because a grouping nobody
 * renders leaves the list exactly as flat as it was.
 *
 * ## The line these protect
 *
 * `EM-3` asks whether Memory may **merge** statements it judges to mean the
 * same thing, unattended. Nobody has answered it. Grouping does not need it
 * answered — provided the surface reorders and never folds. The moment this
 * renders one member of a group and hides the rest, it has performed the merge
 * that was not authorised, in the browser, where nothing records it.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Requirements } from './Requirements'
import type { ProjectProjection, Requirement } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function requirement(id: string, statement: string, relatedGroup: number | null): Requirement {
  return {
    id,
    category: 'functional',
    statement,
    status: 'proposed',
    satisfies: [],
    verifiedBy: [],
    updatedAt: '2026-08-12T09:00:00Z',
    trace: [],
    relatedGroup,
  } as unknown as Requirement
}

function renderRequirements(requirements: Requirement[]) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string): Promise<ProjectProjection> => ({
        ...(await original(id)),
        requirements,
      }),
    },
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>
          <Requirements />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const TWO_WORDINGS = [
  requirement('a', 'An invoice must be sent within three days of a job finishing.', 0),
  requirement('b', 'Invoices are sent within three working days after a job finishes.', 0),
  requirement('c', 'Only an authorised approver may approve a report.', null),
]

describe('adjacent statements are shown together', () => {
  it('heads a group with how many belong to it', async () => {
    renderRequirements(TWO_WORDINGS)

    expect(await screen.findByText('2 related statements')).toBeInTheDocument()
  })

  it('puts the members next to each other, whatever order they arrived in', async () => {
    // The whole point. A grouping that leaves rows 3 and 27 where they were
    // has computed something nobody can use.
    renderRequirements([
      requirement('a', 'An invoice must be sent within three days of a job finishing.', 0),
      requirement('c', 'Only an authorised approver may approve a report.', null),
      requirement('b', 'Invoices are sent within three working days after a job finishes.', 0),
    ])

    await screen.findByText('2 related statements')
    const rows = screen.getAllByRole('listitem')
    const text = rows.map((row) => row.textContent ?? '')
    const first = text.findIndex((entry) => entry.includes('An invoice must be sent'))
    const second = text.findIndex((entry) => entry.includes('Invoices are sent within three'))

    expect(second - first).toBe(1)
  })

  it('puts grouped statements before ungrouped ones', async () => {
    // Grouped rows carry a decision — *are these two the same thing?* —
    // and ungrouped rows carry none.
    renderRequirements(TWO_WORDINGS)

    await screen.findByText('2 related statements')
    const text = screen.getAllByRole('listitem').map((row) => row.textContent ?? '')
    const grouped = text.findIndex((entry) => entry.includes('An invoice must be sent'))
    const alone = text.findIndex((entry) => entry.includes('Only an authorised approver'))

    expect(grouped).toBeLessThan(alone)
  })
})

describe('grouping is not merging', () => {
  it('renders every member whole', async () => {
    // The assertion that keeps `EM-3` open. A surface showing one member and
    // hiding the rest has performed the merge nobody authorised, in the
    // browser, where nothing records it.
    renderRequirements(TWO_WORDINGS)

    expect(await screen.findByText(/An invoice must be sent within three days/)).toBeInTheDocument()
    expect(screen.getByText(/Invoices are sent within three working days/)).toBeInTheDocument()
  })

  it('says out loud that confirming one confirms only it', async () => {
    // A reader who takes "related" to mean "KAE merged these" stops checking
    // them, which is the failure the whole feature would cause.
    renderRequirements(TWO_WORDINGS)

    const heading = (await screen.findByText('2 related statements')).closest('li')!
    expect(within(heading).getByText(/confirming one confirms only it/i)).toBeInTheDocument()
  })

  it('keeps an ungrouped statement out of any group', async () => {
    renderRequirements(TWO_WORDINGS)

    await screen.findByText('2 related statements')
    expect(screen.getAllByText(/related statements/)).toHaveLength(1)
  })
})

describe('when nothing is grouped', () => {
  it('shows no heading at all', async () => {
    // Including for a project too large to group, where every statement comes
    // back with a null group. A standing "0 related" heading would be a claim
    // that KAE looked and found nothing.
    renderRequirements([
      requirement('a', 'An invoice must be sent within three days.', null),
      requirement('b', 'Only an approver may approve.', null),
    ])

    await screen.findByText(/An invoice must be sent/)
    expect(screen.queryByText(/related statements/)).not.toBeInTheDocument()
  })

  it('renders a group of one as an ordinary row', async () => {
    // Memory does not send these, and a filtered view can create one. A lone
    // row under a "2 related" heading claims something no longer true.
    renderRequirements([
      requirement('a', 'An invoice must be sent within three days.', 3),
      requirement('b', 'Only an approver may approve.', null),
    ])

    await screen.findByText(/An invoice must be sent/)
    expect(screen.queryByText(/related statements/)).not.toBeInTheDocument()
  })
})
