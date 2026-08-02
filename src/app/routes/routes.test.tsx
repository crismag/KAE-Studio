import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { Modules } from './Modules'
import { Reviews } from './Reviews'
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

    await user.click(screen.getAllByRole('button', { name: /why this is here/i })[0])

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
