/**
 * `D-250` — the chain of custody reaches the browser; the surface printed a count.
 *
 * `KnowledgeTrace.steps` is built per request by KAE-Memory, and its
 * `source_message` steps carry the message's own text. Studio's type declared
 * six fields and not that one, so the page whose lead promises the record is
 * *traceable to the evidence that produced it* rendered *"N message(s) in this
 * project's conversation"* — the number, standing where the sentences were.
 *
 * The count stays beside the quotations rather than being replaced by them: a
 * step whose text was never recorded is counted and not quoted, and the two
 * readings cannot disagree.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { RecordProvenance } from './RecordProvenance'
import type { KnowledgeTrace, StudioServices } from '@/services/interfaces'

const RECORDED = 'Every export has to carry the tenant it came from.'

function withTrace(trace: KnowledgeTrace): StudioServices {
  const base = createMockServices()
  return {
    ...base,
    memory: { ...base.memory, knowledgeTrace: async () => trace },
  }
}

function show(trace: KnowledgeTrace) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={withTrace(trace)}>
        <RecordProvenance knowledgeId="k-1" status="proposed" />
      </ServiceProvider>
    </QueryClientProvider>,
  )
}

const TWO_MESSAGES: KnowledgeTrace = {
  kind: 'rule',
  lifecycle: 'proposed',
  source_message_ids: ['m-1', 'm-2'],
  produced_by_run_id: 'run-9',
  steps: [
    { relation: 'project', reference: 'p-1' },
    { relation: 'session', reference: 's-1', detail: 'discovery' },
    { relation: 'source_message', reference: 'm-1', detail: RECORDED },
    { relation: 'source_message', reference: 'm-2', detail: '' },
    { relation: 'produced_by_run', reference: 'run-9', detail: '' },
  ],
}

const DOCUMENT = '/mnt/ai/workspaces/CRIS-GVIE@b120c87:docs/prompt.md'

const READ_FROM_A_FILE: KnowledgeTrace = {
  kind: 'requirement',
  lifecycle: 'proposed',
  source_message_ids: ['m-7'],
  produced_by_run_id: 'run-4',
  steps: [
    { relation: 'project', reference: 'p-1' },
    { relation: 'source_message', reference: 'm-7', detail: RECORDED },
    { relation: 'source_document', reference: DOCUMENT },
    { relation: 'produced_by_run', reference: 'run-4', detail: '' },
  ],
}

describe('provenance says whether a statement was read or said', () => {
  it('names the document a statement was read out of', async () => {
    show(READ_FROM_A_FILE)

    expect(await screen.findByText(DOCUMENT)).toBeInTheDocument()
  })

  it('does not call an ingested passage part of this project’s conversation', async () => {
    show(READ_FROM_A_FILE)

    await screen.findByText(DOCUMENT)
    expect(screen.queryByText(/message\(s\) in this project/)).not.toBeInTheDocument()
    expect(screen.getByText(/1 passage\(s\) read out of that source/)).toBeInTheDocument()
  })

  it('still calls a statement somebody typed a message, and names no document', async () => {
    show(TWO_MESSAGES)

    expect(await screen.findByText(/2 message\(s\) in this project/)).toBeInTheDocument()
    expect(screen.queryByText(/Read from/)).not.toBeInTheDocument()
  })
})

describe('provenance shows the evidence it holds', () => {
  it('quotes the source message the trace carries', async () => {
    show(TWO_MESSAGES)

    expect(await screen.findByText(`“${RECORDED}”`)).toBeInTheDocument()
    expect(screen.getByText('m-1')).toBeInTheDocument()
  })

  it('keeps the count beside the quotations, so both messages are accounted for', async () => {
    show(TWO_MESSAGES)

    expect(await screen.findByText(/2 message\(s\)/)).toBeInTheDocument()
  })

  it('counts a message whose text was never recorded and does not quote it', async () => {
    show(TWO_MESSAGES)

    await screen.findByText(`“${RECORDED}”`)
    expect(screen.queryByText('m-2')).not.toBeInTheDocument()
    expect(screen.queryByText('“”')).not.toBeInTheDocument()
  })

  it('names the run instead of calling it an extraction run', async () => {
    show(TWO_MESSAGES)

    expect(await screen.findByText('run-9')).toBeInTheDocument()
    expect(screen.queryByText(/^an extraction run$/)).not.toBeInTheDocument()
  })

  it('renders as it always did when KAE-Memory sends no steps', async () => {
    show({ kind: 'rule', lifecycle: 'proposed', source_message_ids: ['m-1', 'm-2'] })

    expect(await screen.findByText(/2 message\(s\)/)).toBeInTheDocument()
    expect(screen.queryByText(`“${RECORDED}”`)).not.toBeInTheDocument()
  })

  it('says so when there is no recorded source message at all', async () => {
    show({ kind: 'rule', lifecycle: 'proposed', source_message_ids: [], steps: [] })

    expect(await screen.findByText('no recorded source message')).toBeInTheDocument()
  })
})
