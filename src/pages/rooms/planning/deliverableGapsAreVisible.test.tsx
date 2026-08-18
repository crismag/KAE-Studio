/**
 * `D-252` — the incompleteness the producer may never be silent about is said.
 *
 * KAE-Memory records every unresolved critical gap in a deliverable's manifest
 * and enforces that the list is present rather than omitted. Studio dropped it
 * at the adapter, so the page had no way to say it — while the neighbouring
 * *"Carries N unresolved decisions"* sentence rendered for the mock's fixtures
 * and could never render live, because the field behind it is hardcoded empty.
 *
 * An adapter test proves the field arrives. This proves a person sees it, and
 * sees the summary rather than an area key.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Deliverables } from './DeliverablesSubflow'
import type { Deliverable } from '@/domain/types'

const WITH_GAPS: Deliverable = {
  id: 'DLV-GAPS',
  name: 'Project context package',
  description: '',
  scope: 'project',
  state: 'generated',
  version: 'v1',
  includes: [],
  files: [],
  unresolvedDecisionIds: [],
  unresolvedGaps: [
    { areaKey: 'authority_model', summary: 'Who may approve a report is undecided.' },
  ],
}

function renderPage(deliverables: Deliverable[]) {
  const services = createMockServices()
  services.artifacts.listDeliverables = async () => deliverables
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <Deliverables />
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

describe('a package says what it was assembled around', () => {
  it('names the gap in the words the manifest recorded, not the area key', async () => {
    renderPage([WITH_GAPS])

    expect(await screen.findByText(/1 critical gap still open/i)).toBeInTheDocument()
    expect(screen.getByText('Who may approve a report is undecided.')).toBeInTheDocument()
    expect(screen.queryByText(/authority_model/)).not.toBeInTheDocument()
  })

  /**
   * `D-253`. The refusal exists — `RenderService.render` raises before
   * producing bytes — and the page drew every package as though it did not.
   */
  it('says a package cannot be re-rendered, in the words Memory refused with', async () => {
    renderPage([
      {
        ...WITH_GAPS,
        unresolvedGaps: [],
        unreproducibleReason: 'render inputs were captured but the statements were not pinned',
      },
    ])

    expect(
      await screen.findByText(
        /cannot be re-rendered: render inputs were captured but the statements were not pinned/i,
      ),
    ).toBeInTheDocument()
  })

  /**
   * `D-254`. The counts are what change what a reader does with the package;
   * the pin identifiers behind them are as unreadable as an area key.
   */
  it('says what was unsettled, in counts a reader can act on', async () => {
    renderPage([
      {
        ...WITH_GAPS,
        unresolvedGaps: [],
        assembledUnderUncertainty: {
          proposed: 3,
          contested: 1,
          openAssumptions: 0,
          openQuestions: 2,
        },
      },
    ])

    const said = await screen.findByText(/Assembled while things were unsettled/i)
    expect(said).toHaveTextContent('3 proposed statements')
    expect(said).toHaveTextContent('1 contested statement')
    expect(said).toHaveTextContent('2 open questions')
    // A count of zero is not news, and listing it pads the one sentence a
    // reader has to get through.
    expect(said).not.toHaveTextContent('0 open assumptions')
  })

  /**
   * `D-255`. The producer wrote these as prose for a reader, so the page says
   * them as written rather than summarising them into a count.
   */
  it('says the qualification in the words the producer wrote it in', async () => {
    renderPage([
      {
        ...WITH_GAPS,
        unresolvedGaps: [],
        qualifications: ['This package rests on 4 statements nobody has confirmed.'],
      },
    ])

    expect(
      await screen.findByText('This package rests on 4 statements nobody has confirmed.'),
    ).toBeInTheDocument()
  })

  /**
   * `D-256`. Two refusals that are not the same refusal, on one card, each in
   * its own words — a package can fail either without failing the other.
   */
  it('separates cannot re-render from cannot reproduce the claim', async () => {
    renderPage([
      {
        ...WITH_GAPS,
        unresolvedGaps: [],
        unreproducibleReason: 'the statements were not pinned',
        unreproducibleClaimReason: 'recorded before provisional context was captured (N20.2)',
      },
    ])

    expect(
      await screen.findByText(/cannot be re-rendered: the statements were not pinned/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /cannot be reproduced as the claim it was: recorded before provisional context was captured/i,
      ),
    ).toBeInTheDocument()
  })

  /**
   * `D-274`. Both states arrived as `outdated`, so the card told a reader to
   * *regenerate to pick up the current revision* about a package the project
   * had withdrawn. The sentence is true of a stale package and wrong here, so
   * the assertion that matters is the absence of it.
   */
  it('tells a withdrawn package apart from a stale one, in the reason Memory recorded', async () => {
    renderPage([
      {
        ...WITH_GAPS,
        unresolvedGaps: [],
        state: 'withdrawn',
        withdrawnReason: 'The engagement it was written for was cancelled.',
      },
    ])

    expect(await screen.findByText(/no longer stands behind this package/i)).toBeInTheDocument()
    expect(
      screen.getByText(/The engagement it was written for was cancelled\./),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Regenerate to pick up the current revision/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Outdated')).not.toBeInTheDocument()
  })

  it('says only that a package was withdrawn where no reason was recorded', async () => {
    renderPage([{ ...WITH_GAPS, unresolvedGaps: [], state: 'withdrawn' }])

    expect(await screen.findByText(/no longer stands behind this package/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/Regenerate to pick up the current revision/i),
    ).not.toBeInTheDocument()
  })

  /**
   * The replacement is named, never printed as an identifier (`D-199`). The
   * name is resolved against the packages the page already holds.
   */
  it('names the package that replaced a superseded one', async () => {
    renderPage([
      { ...WITH_GAPS, unresolvedGaps: [], state: 'superseded', supersededById: 'DLV-NEW' },
      { ...WITH_GAPS, id: 'DLV-NEW', name: 'Project context package v2', unresolvedGaps: [] },
    ])

    // Asserted on the sentence rather than on the page: the replacement's own
    // card carries that name too, so a page-wide match would pass without the
    // sentence naming anything.
    const said = await screen.findByText(/A later package replaced this one/i)
    expect(said).toHaveTextContent('Project context package v2')
    expect(screen.queryByText(/DLV-NEW/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Regenerate to pick up the current revision/i),
    ).not.toBeInTheDocument()
  })

  it('still says a package was replaced when the replacement is not on this page', async () => {
    // A limit or a scope filter can leave the replacement out of the list. The
    // sentence stands without a name rather than falling back to the id.
    renderPage([
      { ...WITH_GAPS, unresolvedGaps: [], state: 'superseded', supersededById: 'DLV-ELSEWHERE' },
    ])

    expect(await screen.findByText(/A later package replaced this one/i)).toBeInTheDocument()
    expect(screen.queryByText(/DLV-ELSEWHERE/)).not.toBeInTheDocument()
  })

  it('says nothing when there is nothing to say', async () => {
    // The control. A complete package must not carry a warning shaped like one,
    // which is the failure mode of announcing an empty list.
    renderPage([{ ...WITH_GAPS, unresolvedGaps: [] }])

    expect(await screen.findByText('Project context package')).toBeInTheDocument()
    expect(screen.queryByText(/critical gap/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cannot be re-rendered/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/unsettled/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/rests on/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cannot be reproduced/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/no longer stands behind/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/A later package replaced/i)).not.toBeInTheDocument()
  })
})
