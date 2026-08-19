/**
 * A page whose rows send you somewhere else is not a page (`NAV-01` N3,
 * `D-97`).
 *
 * The live sweep found `/requirements` showing 174 statements where each
 * proposed row's only action was the sentence *"Review this on the Reviews
 * page: confirm it, correct it, or reject it."* One hundred and seventy-four
 * redirects, on a page a person opened to work.
 *
 * The gesture existed the whole time — `POST /knowledge/{id}/confirm` and its
 * reject counterpart, which Reviews has always called.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Requirements } from './RequirementsSubflow'
import type { ProjectProjection, Requirement } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function requirement(over: Partial<Requirement> = {}): Requirement {
  return {
    id: 'k-1',
    category: 'functional',
    statement: 'Invoices are sent within three working days.',
    status: 'proposed',
    version: 4,
    satisfies: [],
    verifiedBy: [],
    updatedAt: '2026-08-12T09:00:00Z',
    trace: [],
    relatedGroup: null,
    ...over,
  } as unknown as Requirement
}

function show(requirements: Requirement[], memory: Partial<StudioServices['memory']> = {}) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    memory: { ...services.memory, ...memory } as StudioServices['memory'],
    projection: {
      ...services.projection,
      getProjection: async (id: string): Promise<ProjectProjection> => ({
        ...(await original(id)),
        requirements,
      }),
    },
  }
  render(
    <MemoryRouter>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ServiceProvider services={patched}>
          <Requirements />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('acting on a statement where it is read', () => {
  it('confirms without sending anybody to another page', async () => {
    const user = userEvent.setup()
    const confirmFinding = vi.fn().mockResolvedValue({ accepted: true, memoryRevision: 5 })
    show([requirement()], { confirmFinding })

    await user.click(await screen.findByRole('button', { name: /^confirm$/i }))

    await waitFor(() => expect(confirmFinding).toHaveBeenCalled())
    expect(confirmFinding.mock.calls[0][1]).toBe('k-1')
    expect(screen.queryByText(/Review this on the Reviews page/)).not.toBeInTheDocument()
  })

  it('carries the version a confirmation needs', async () => {
    /**
     * The same optimistic-concurrency check rejection has always sent, and the
     * more consequential of the two: a rejection of moved wording loses a
     * candidate, a confirmation of it makes something nobody read
     * authoritative (`D-306`).
     */
    const user = userEvent.setup()
    const confirmFinding = vi.fn().mockResolvedValue({ accepted: true, memoryRevision: 5 })
    show([requirement({ version: 7 })], { confirmFinding })

    await user.click(await screen.findByRole('button', { name: /^confirm$/i }))

    await waitFor(() => expect(confirmFinding).toHaveBeenCalled())
    // (projectId, findingId, expectedVersion)
    expect(confirmFinding.mock.calls[0][2]).toBe(7)
  })

  it('carries the version a rejection needs', async () => {
    /**
     * Optimistic concurrency. KAE-Memory refuses a rejection aimed at wording
     * that has since changed, and a rejection sent without the version — or
     * with an invented one — is refused outright.
     */
    const user = userEvent.setup()
    const rejectFinding = vi.fn().mockResolvedValue({ accepted: true, memoryRevision: 5 })
    show([requirement({ version: 4 })], { rejectFinding })

    await user.click(await screen.findByRole('button', { name: /^reject$/i }))

    await waitFor(() => expect(rejectFinding).toHaveBeenCalled())
    // (projectId, findingId, reason, expectedVersion)
    expect(rejectFinding.mock.calls[0][1]).toBe('k-1')
    expect(rejectFinding.mock.calls[0][3]).toBe(4)
  })

  it('keeps the sentence when there is no version to reject against', async () => {
    // A button that always fails is worse than no button. An adapter that sends
    // no version gets the honest redirect it had before.
    show([requirement({ version: undefined })])

    expect(await screen.findByText(/Review this on the Reviews page/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeInTheDocument()
  })

  it('offers no gesture on an open question, because there is nothing to agree to', async () => {
    /**
     * *"I could not determine this"* is not a claim. A Confirm button on it
     * would be agreeing to an absence, and answering it happens in
     * conversation — for this row the redirect is the truth.
     */
    show([requirement({ category: 'open_question' })])

    expect(
      await screen.findByText(/Answer this, or record it as an assumption/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeInTheDocument()
  })

  it('says a write failed rather than looking like it did nothing', async () => {
    const user = userEvent.setup()
    const confirmFinding = vi.fn().mockRejectedValue(new Error('conflict'))
    show([requirement()], { confirmFinding })

    await user.click(await screen.findByRole('button', { name: /^confirm$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/was not recorded/i)
  })
})
