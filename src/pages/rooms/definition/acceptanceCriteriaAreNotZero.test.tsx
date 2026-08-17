/**
 * The *Acceptance criteria* panel does not answer `0` for a capability nothing
 * has.
 *
 * `D-218`. `liveServices.ts` sets `acceptanceTests: []` on every live
 * projection, and the panel rendered `<Badge tone="neutral">0</Badge>` over an
 * empty list — a neutral badge, which is the tone that means *this is the
 * number*. Nothing upstream was dropped: Studio's backend computes no acceptance
 * criteria and KAE-Memory has no kind for one, so the count is a product limit
 * stated as a quantity about the user's project (`D-38`, `D-184`).
 *
 * The same file already refuses this twice — `RequirementRow` renders
 * `verifiedBy` only when non-empty because *"rendering a product limit as a
 * per-row warning tells someone their requirements are defective"*, and the
 * summary line omits *"N without verification"* because *"a count that cannot
 * vary is not information."* The panel is where the rule was not applied.
 *
 * Both arms are asserted, because the fix must not become the opposite mistake:
 * with `acceptanceTestsGap` null the count is a fact about the project and has
 * to be shown, including at zero.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Requirements } from './RequirementsSubflow'
import type { CapabilityGap, ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

const GAP: CapabilityGap = {
  capability: 'Acceptance criteria',
  reason: 'KAE does not record acceptance criteria yet, so none can be listed for any project.',
  state: 'planned',
  provedInstead: [],
}

function renderWith(overrides: Partial<ProjectProjection>) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string): Promise<ProjectProjection> => ({
        ...(await original(id)),
        ...overrides,
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

/** The panel, addressed by its heading so neither assertion can match the page. */
async function panel(): Promise<HTMLElement> {
  const heading = await screen.findByText('Acceptance criteria')
  const found = heading.closest('section, div[class*="rounded"]')
  expect(found).not.toBeNull()
  return found as HTMLElement
}

describe('a capability nothing has is not a count of zero', () => {
  it('says the criteria are not recorded rather than counting none', async () => {
    renderWith({ acceptanceTests: [], acceptanceTestsGap: GAP })

    expect((await panel()).textContent).toContain('not recorded')
  })

  it('never shows the number that would say the project has none', async () => {
    renderWith({ acceptanceTests: [], acceptanceTestsGap: GAP })

    // The defect, exactly: a neutral `0` beside the heading.
    expect((await panel()).textContent).not.toMatch(/Acceptance criteria\s*0/)
  })

  it('gives the reason where the count used to be, not only on the page', async () => {
    renderWith({ acceptanceTests: [], acceptanceTestsGap: GAP })

    // The page's `CapabilityNote` already names this limit and already did when
    // the badge said `0`. A reader who reads the badge has read something false
    // whether or not a paragraph above it is correct.
    expect((await panel()).textContent).toContain('does not record acceptance criteria yet')
  })

  it('counts them when they are readable, so the fix is not the same error reversed', async () => {
    renderWith({ acceptanceTestsGap: null })

    const text = (await panel()).textContent ?? ''
    expect(text).not.toContain('not recorded')
    expect(text).not.toContain('does not record acceptance criteria yet')
  })

  it('states a genuine zero, because then it is a fact about the project', async () => {
    renderWith({ acceptanceTests: [], acceptanceTestsGap: null })

    expect((await panel()).textContent).toMatch(/Acceptance criteria\s*0/)
  })
})
