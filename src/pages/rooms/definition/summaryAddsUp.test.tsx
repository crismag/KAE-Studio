/**
 * The summary line over `/requirements` accounts for every row it counts.
 *
 * `D-201`. It read *"N requirements · A confirmed · B awaiting review"* and
 * stopped there, while `rejected` and `superseded` statements reach the
 * projection (`D-34`) and the tab strip beside the sentence counts them. So a
 * project that had rejected anything showed a total no two visible numbers
 * could reach — `D-96`'s defect, on the page `D-96` was fixed on, inside one
 * sentence instead of between two.
 *
 * These assert the arithmetic a reader does in their head, not the wording:
 * every part named, the parts adding to the total, and nothing announced at
 * zero except the two states this page is about.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Requirements } from './RequirementsSubflow'
import type { ProjectProjection, Requirement } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function requirement(id: string, status: Requirement['status']): Requirement {
  return {
    id,
    category: 'functional',
    statement: `Statement ${id}.`,
    status,
    satisfies: [],
    verifiedBy: [],
    updatedAt: '2026-08-17T09:00:00Z',
    trace: [],
    relatedGroup: null,
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

/** The one sentence under the title, as a person reads it. */
async function summary(): Promise<string> {
  const line = await screen.findByText(/requirements? ·/)
  return line.textContent ?? ''
}

const EVERY_STATE = [
  requirement('a', 'confirmed'),
  requirement('b', 'proposed'),
  requirement('c', 'rejected'),
  requirement('d', 'superseded'),
  requirement('e', 'contested'),
]

describe('the requirements summary accounts for every row', () => {
  it('names the states that are neither confirmed nor awaiting review', async () => {
    renderRequirements(EVERY_STATE)

    const text = await summary()

    expect(text).toContain('5 requirements')
    expect(text).toContain('1 confirmed')
    expect(text).toContain('1 awaiting review')
    expect(text).toContain('1 rejected')
    expect(text).toContain('1 superseded')
    expect(text).toContain('1 needing clarification')
  })

  it('adds up — the parts sum to the total it states', async () => {
    // The assertion that fails if a seventh state arrives and nobody names it.
    // Read off the rendered sentence rather than recomputed from the fixture,
    // because the defect was a number on screen and not a number in a function.
    renderRequirements(EVERY_STATE)

    const text = await summary()
    const [total, ...parts] = [...text.matchAll(/(\d+)\s+[a-z]/g)].map((match) => Number(match[1]))

    expect(total).toBe(5)
    expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
  })

  it('stays quiet about a state the project has never been in', async () => {
    // *0 superseded* on a project that has superseded nothing is noise beside
    // two numbers that matter.
    renderRequirements([requirement('a', 'confirmed'), requirement('b', 'proposed')])

    const text = await summary()

    expect(text).toContain('1 confirmed')
    expect(text).toContain('1 awaiting review')
    expect(text).not.toContain('superseded')
    expect(text).not.toContain('rejected')
  })
})
