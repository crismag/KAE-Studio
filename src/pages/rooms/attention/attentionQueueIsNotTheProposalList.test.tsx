/**
 * The Room reads the attention layer, and says what the run left out (`SYN-3e`).
 *
 * Two things can quietly go wrong here and neither would fail anything else.
 *
 * **The Room could read the evidence layer.** `ADR-0007`'s whole point is that
 * extracted rows and attention items are different things; a Room that listed
 * proposed knowledge under this heading would be the 803-row queue with a nicer
 * title, which is the failure the synthesis package was opened to avoid. So the
 * page's data has to come from `SynthesisPort` and from nothing else.
 *
 * **The exclusions could be dropped.** Memory computes `withheld` deliberately
 * — 36 themes become 8 items, and the 28 that did not are the first question a
 * person asks. A field computed carefully, transmitted faithfully and read by
 * nothing is the largest recurring defect in this estate, and it is invisible:
 * the page looks finished without it.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AttentionRoom } from './AttentionRoom'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import type { StudioServices } from '@/services/interfaces'
import type { UnknownSynthesisReport } from '@/domain/types'

const REPORT: UnknownSynthesisReport = {
  considered: 41,
  resolved: 5,
  themes: 36,
  raised: [{ attentionItemId: 'attn-001', question: 'Who approves a return' }],
  withheld: ['Which fields of the return are mandatory', 'How long a return is retained'],
  clustered: true,
  rankedByBlocking: true,
}

function harness(overrides: Partial<StudioServices['synthesis']> = {}) {
  const services = createMockServices()
  // Delegating rather than spreading: the mock is a class, so its methods are on
  // the prototype and `{...mock}` would produce an object with none of them.
  const synthesis: StudioServices['synthesis'] = {
    listAttention: (id) => services.synthesis.listAttention(id),
    listSynthesizedModel: (id) => services.synthesis.listSynthesizedModel(id),
    runUnknownSynthesis: (id) => services.synthesis.runUnknownSynthesis(id),
    ...overrides,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <ServiceProvider services={{ ...services, synthesis }}>
        <AttentionRoom />
      </ServiceProvider>
    </QueryClientProvider>,
  )
  return synthesis
}

describe('the Room reads the attention layer', () => {
  it('renders the items the synthesis port returned', async () => {
    harness()

    // Two matches on purpose: the theme in the model, and the item raised from
    // it. They legitimately share a title.
    expect(
      (await screen.findAllByText(/Who approves a return before it is published/)).length,
    ).toBeGreaterThan(0)
  })

  it('renders the synthesized model beside them, not the evidence behind it', async () => {
    harness()

    // A goal, which is a synthesized object. The sentences it was drawn from
    // live on `/reviews` and must not appear here.
    expect(await screen.findByText(/Monthly reporting without manual collation/)).toBeTruthy()
  })

  it('never reads the proposal list to fill this page', async () => {
    const services = createMockServices()
    const proposals = vi.spyOn(services.projection, 'getProjection')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <ServiceProvider services={services}>
          <AttentionRoom />
        </ServiceProvider>
      </QueryClientProvider>,
    )
    await screen.findAllByText(/Who approves a return before it is published/)

    // The projection is where proposed rows live. Reading it here is how this
    // Room becomes the queue it exists to replace.
    expect(proposals).not.toHaveBeenCalled()
  })
})

describe('a run says what it withheld', () => {
  it('names every theme the run declined to raise', async () => {
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    for (const theme of REPORT.withheld) {
      expect(await screen.findByText(theme)).toBeTruthy()
    }
  })

  it('reports how many themes were formed, so 8 items from 36 is legible', async () => {
    harness({ runUnknownSynthesis: () => Promise.resolve(REPORT) })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/36 themes/)).toBeTruthy()
  })

  it('says when nothing was compared, so themes of one are not read as compaction', async () => {
    harness({
      runUnknownSynthesis: () => Promise.resolve({ ...REPORT, clustered: false }),
    })

    await userEvent.click(await screen.findByRole('button', { name: /look again/i }))

    expect(await screen.findByText(/every unknown stood alone/)).toBeTruthy()
  })
})
