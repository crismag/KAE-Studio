/**
 * `D-282` — the *Open decisions* panel drew a page and labelled it as a count.
 *
 * KAE-Memory's candidates listing takes a ceiling — 20, from Studio's own
 * client default — orders most severe first, and reports how many it cut. The
 * panel's badge is computed from the array that survived that cut, so on any
 * project with more questions than the ceiling it is a confident count of the
 * project's open decisions that is really the page size.
 *
 * **The badge is deliberately not corrected**, and one assertion holds that
 * line: `total` counts deferred questions too and `blocking` excludes them, so
 * substituting it swaps one wrong number for a less noticeable one. What was
 * missing is a sentence, and a sentence is what is asserted.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  reason: 'Authorization has no confirmed knowledge.',
  blocks: [],
  suggestedOwner: 'Church leadership',
  deferred: false,
  asked: true,
}

function renderRoom(completeness: ProjectProjection['openDecisionsCompleteness']) {
  resetPrototypeState()
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string): Promise<ProjectProjection> => ({
        ...(await original(id)),
        openDecisions: [DECISION],
        openDecisionsCompleteness: completeness,
      }),
      classify: (id: string) => services.projection.classify(id),
    },
  } as StudioServices
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
}

describe('a list of questions the ceiling cut', () => {
  it('says how many there are and how many are on the page', async () => {
    renderRoom({ total: 47, omitted: 46 })

    expect(await screen.findByText(/47 questions in all, showing the 1 most severe/)).toBeVisible()
  })

  it('says which end went, because it is not the arbitrary end', async () => {
    // Most severe first, so what a ceiling cuts is the least severe. A reader
    // otherwise has to assume the important ones might be the missing ones.
    renderRoom({ total: 47, omitted: 46 })

    expect(await screen.findByText(/46 others are not on this page/)).toBeVisible()
  })

  it('leaves the badge counting what is on screen', async () => {
    // `total` is a count of a different set — it includes deferred questions,
    // which the badge excludes — so putting it in the badge would be a second
    // wrong number and a harder one to notice.
    renderRoom({ total: 47, omitted: 46 })

    expect(await screen.findByText('1 open')).toBeVisible()
  })

  it('says nothing where the list is whole', async () => {
    renderRoom({ total: 1, omitted: 0 })
    await screen.findByText(DECISION.question)

    expect(screen.queryByText(/not on this page/)).toBeNull()
  })

  it('says nothing where the producer claimed nothing', async () => {
    // `D-38`. A backend older than the field made no claim about completeness,
    // and inventing either half of the sentence from that is the failure the
    // tri-state exists to prevent.
    renderRoom({ total: null, omitted: null })
    await screen.findByText(DECISION.question)

    expect(screen.queryByText(/not on this page/)).toBeNull()
    expect(screen.queryByText(/questions in all/)).toBeNull()
  })
})
