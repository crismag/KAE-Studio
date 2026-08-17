/**
 * `WS-DEFER` — an open decision offers a way to settle it, not only a way out.
 *
 * Doc 01's actionability invariant: *"Every item surfaced for human attention
 * must provide at least one direct, semantically appropriate path toward
 * resolution. A defer/postpone control alone does not satisfy this
 * requirement."*
 *
 * `OpenDecisionRow` rendered exactly one control — `Decide later` — and for a
 * question nobody has been asked, none at all. KAE naming what needs deciding
 * and offering only its postponement is the shape the invariant is written
 * against.
 *
 * **What is asserted is the whole path, not the button.** A control wired to
 * nothing looks identical on screen to one that works, and the fix is only real
 * if clicking it puts the decision into the conversation — the sole route to
 * resolution that exists, since `ProjectMemoryClient` has `deferDecision` and
 * nothing that answers a decision.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices, resetPrototypeState } from '@/services/mock/mockServices'
import { InterviewRoom } from './InterviewRoom'
import type { OpenDecision, ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

const DECISION: OpenDecision = {
  id: 'OD-011',
  question: 'Which role holds approval authority?',
  severity: 'critical',
  blocks: [],
  suggestedOwner: 'Church leadership',
  deferred: false,
  asked: true,
}

function renderRoom(decision: OpenDecision = DECISION) {
  resetPrototypeState()
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string): Promise<ProjectProjection> => ({
        ...(await original(id)),
        openDecisions: [decision],
      }),
      classify: (id: string) => services.projection.classify(id),
    },
  } as StudioServices
  const respondTo = vi.spyOn(patched.interview, 'respondTo')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={patched}>
          <InterviewRoom />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
  return { respondTo }
}

/** The row for one decision, found through the question it asks. */
async function decisionRow(question: string) {
  const text = await screen.findByText(question)
  return within(text.closest('li')!)
}

describe('an open decision offers a path toward resolution', () => {
  it('carries more than a way to postpone it', async () => {
    renderRoom()
    const row = await decisionRow(DECISION.question)

    const controls = row.getAllByRole('button').map((b) => b.textContent)
    // Not a count. A second control that also only postpones would satisfy a
    // length check and fail the requirement it was written for.
    expect(controls.filter((c) => c !== 'Decide later' && c !== 'Bring back')).toEqual([
      'Discuss this',
    ])
  })

  it('puts the decision into the conversation, verbatim', async () => {
    const user = userEvent.setup()
    const { respondTo } = renderRoom()
    const row = await decisionRow(DECISION.question)

    await user.click(row.getByRole('button', { name: 'Discuss this' }))

    // Memory wrote the question. A paraphrase here would be Studio deciding
    // what was being asked.
    expect(respondTo).toHaveBeenCalledOnce()
    expect(respondTo.mock.calls[0][1]).toContain(DECISION.question)
  })

  it('offers no way back on a deferred one, because KAE-Memory has none', async () => {
    // `Bring back` posted `disposition: open`, which `ensure_disposition`
    // rejects by name, on a question `answer` would refuse a second response
    // for anyway. It was unreachable until deferred questions started arriving
    // (`D-198`), which is what made it worth removing rather than repairing.
    renderRoom({ ...DECISION, deferred: true })
    const row = await decisionRow(DECISION.question)

    expect(row.queryByRole('button', { name: 'Bring back' })).toBeNull()
    expect(row.getByText(/nothing here takes it back up/i)).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Discuss this' })).toBeInTheDocument()
  })

  it('offers it on a question nobody has been asked', async () => {
    // The worst row in the panel. Deferring needs a message id and a candidate
    // has none, so an unasked decision showed a question and no control of any
    // kind — only the words "Not asked yet". Asking is precisely what it needs,
    // and this is a person asking for it, one at a time.
    renderRoom({ ...DECISION, asked: false })
    const row = await decisionRow(DECISION.question)

    expect(row.getByText(/not asked yet/i)).toBeInTheDocument()
    expect(row.getByRole('button', { name: 'Discuss this' })).toBeInTheDocument()
  })
})
