import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SURFACES } from '@/app/registries/rooms'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { Modules } from '@/pages/rooms/architecture/ModulesSubflow'
import { Reviews } from '@/pages/rooms/review/ReviewsRoom'
import { Requirements } from './Requirements'

function renderRoute(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={createMockServices()}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => resetPrototypeState())

describe('Modules', () => {
  it('presents the decomposition as proposed, awaiting the user', async () => {
    renderRoute(<Modules />)
    expect(await screen.findByText('Approval Workflow')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /accept/i }).length).toBeGreaterThan(0)
  })

  it('shows blocked readiness rather than claiming the module is ready', async () => {
    renderRoute(<Modules />)
    await screen.findByText('Approval Workflow')
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0)
    expect(screen.getByText(/approver role undecided/i)).toBeInTheDocument()
  })

  it('records an acceptance when the user curates a module', async () => {
    const user = userEvent.setup()
    renderRoute(<Modules />)
    await screen.findByText('Report Management')

    await user.click(screen.getAllByRole('button', { name: /^accept$/i })[0])

    await waitFor(() => expect(screen.getByText('Accepted')).toBeInTheDocument())
  })
})

describe('Reviews', () => {
  it('separates agent-proposed knowledge and marks it unconfirmed', async () => {
    renderRoute(<Reviews />)
    expect(await screen.findByText('Agent-proposed knowledge')).toBeInTheDocument()
    // Two agent proposals in the fixture; both must carry the same disclaimer.
    expect(
      screen.getAllByText(/an agent cannot change the project definition/i).length,
    ).toBeGreaterThan(0)
  })

  it('surfaces the contradiction with both competing statements', async () => {
    renderRoute(<Reviews />)
    await screen.findByText(/cannot be both immutable and correctable/i)
    expect(
      screen.getByText(/“Editing an approved report invalidates the prior approval.”/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/“A published report that is later found to be wrong can be corrected.”/),
    ).toBeInTheDocument()
  })
})

describe('Requirements', () => {
  it('discloses provenance on demand rather than by default', async () => {
    const user = userEvent.setup()
    renderRoute(<Requirements />)
    await screen.findByText('Only an authorised approver may approve a report.')

    expect(screen.queryByText(/Reports should be approved before publication\./)).toBeNull()

    // "Source & reasoning" since U3. It was "Why this is here", and that rename
    // broke this test for six days because nothing ran it — see the CI workflow
    // added alongside this fix.
    await user.click(screen.getAllByRole('button', { name: /source & reasoning/i })[0])

    expect(
      await screen.findByText(/“We need a way for ministry leaders to submit monthly reports\.”/),
    ).toBeInTheDocument()
  })

  it('marks a contested requirement as needing clarification', async () => {
    renderRoute(<Requirements />)
    const statement = await screen.findByText(
      'A published report that is later found to be wrong can be corrected.',
    )
    const row = statement.closest('li')!
    expect(within(row).getByText('Needs clarification')).toBeInTheDocument()
  })
})

/**
 * `D-49` — a Room's stated limit cannot deny what the product does.
 *
 * The Reviews Room's registry entry read *"contradictions and gaps are not
 * computed"*. `D-30` connected KAE-Memory's review, which computes unresolved
 * contradictions, missing and partial areas, duplicates and open blockers — and
 * `D-38` puts every limit on the Dashboard card, so the product was telling
 * people it could not do something it does.
 *
 * The sentence was true when written and survived four ticks and two increments
 * that touched the same page. A registry claim that has to be *remembered* goes
 * stale; this ties it to the code.
 *
 * **The claim, not the prose.** Wording stays free. What is fixed is that while
 * the panel exists, the registry may not deny it.
 */
describe('a Room limit does not deny a shipped capability', () => {
  const reviews = SURFACES.find((surface) => surface.id === 'review')!

  it('does not claim contradictions are uncomputed while the review panel ships', () => {
    // Read from source rather than imported, so this fails on the registry's
    // words rather than on a component's existence alone.
    const panel = readFileSync('src/pages/rooms/review/QualityReview.tsx', 'utf8')
    expect(panel).toContain('export function QualityReview(')

    expect(reviews.limit ?? '').not.toMatch(/contradictions?[^.]*not (?:be )?computed/i)
  })

  it('still names what genuinely is not computed', () => {
    // A limit that shrinks to nothing is its own defect: three of the five
    // review groups remain uncomputed, and a Room claiming none would be the
    // opposite mistake.
    expect(reviews.limit ?? '').toMatch(/requirement-level gaps|test verification/i)
  })
})
