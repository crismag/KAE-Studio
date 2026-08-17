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

  it('says nothing when there is nothing to say', async () => {
    // The control. A complete package must not carry a warning shaped like one,
    // which is the failure mode of announcing an empty list.
    renderPage([{ ...WITH_GAPS, unresolvedGaps: [] }])

    expect(await screen.findByText('Project context package')).toBeInTheDocument()
    expect(screen.queryByText(/critical gap/i)).not.toBeInTheDocument()
  })
})
