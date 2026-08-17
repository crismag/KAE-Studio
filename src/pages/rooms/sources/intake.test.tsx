/**
 * Ingestion — the second way into a project.
 *
 * `POST /v1/projects/{id}/documents` has been live in KAE-Memory the whole
 * time. Studio had no surface for it, so a person holding material already
 * written down was asked to retype it into a conversation. That is GitHub issue
 * #3 stated as a missing page rather than as a bad answer.
 *
 * These assert the three things the page must never get wrong: that queued is
 * not read, that loss is reported, and that a failure arrives in words.
 */

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { Intake } from './intake'
import type { IngestionPort, StudioServices } from '@/services/interfaces'

/**
 * The mock ports are classes, so spreading one drops every prototype method.
 * Delegating explicitly is longer and cannot silently produce a port whose
 * every call fails.
 */
function withIngestion(base: StudioServices, over: Partial<IngestionPort>): StudioServices {
  const port = base.ingestion
  return {
    ...base,
    ingestion: {
      ingestText: (id, document) => port.ingestText(id, document),
      decodeUpload: (file) => port.decodeUpload(file),
      coverage: (id) => port.coverage(id),
      runs: (id) => port.runs(id),
      ...over,
    },
  }
}

function renderIngestion(patch?: (services: StudioServices) => StudioServices) {
  const base = createMockServices()
  const services = patch ? patch(base) : base
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ServiceProvider services={services}>
          <Intake />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

async function paste(user: ReturnType<typeof userEvent.setup>, text = 'Invoices go out weekly.') {
  await user.type(await screen.findByLabelText(/what is this/i), 'Brief')
  await user.type(screen.getByLabelText(/the text/i), text)
  await user.click(screen.getByRole('button', { name: /read this/i }))
}

async function chooseFile(file: File) {
  const input = await screen.findByLabelText(/the file/i)
  fireEvent.change(input, { target: { files: [file] } })
}

describe('pasting a document', () => {
  it('sends the title and the text as written', async () => {
    const user = userEvent.setup()
    const sent: { title: string; text: string }[] = []
    renderIngestion((services) =>
      withIngestion(services, {
        ingestText: async (id, document) => {
          sent.push(document)
          return services.ingestion.ingestText(id, document)
        },
      }),
    )

    await paste(user)

    // Verbatim. Memory stores the text exactly as written because every
    // extracted statement keeps a quote back into it.
    expect(sent).toEqual([{ title: 'Brief', text: 'Invoices go out weekly.' }])
  })

  it('will not send an untitled document', async () => {
    const user = userEvent.setup()
    renderIngestion()

    await user.type(await screen.findByLabelText(/the text/i), 'Some notes.')

    // A project with four documents called "pasted text" cannot tell them
    // apart, and the title is what provenance shows beside every statement.
    expect(screen.getByRole('button', { name: /read this/i })).toBeDisabled()
  })

  it('says the text is stored and the reading is not done', async () => {
    const user = userEvent.setup()
    renderIngestion()

    await paste(user)

    // Queued is not read. Saying otherwise is the same substitution as a
    // percentage that has not been recalculated.
    expect(await screen.findByText(/stored and queued/i)).toBeInTheDocument()
    expect(screen.getByText(/reading it happens in the background/i)).toBeInTheDocument()
  })

  it('reports what was dropped, loudly', async () => {
    const user = userEvent.setup()
    renderIngestion((services) =>
      withIngestion(services, {
        ingestText: async () => ({
          document: 'Brief',
          chunks: 4,
          truncatedChunks: 11,
          warnings: ['the document was cut at 4 chunks'],
        }),
      }),
    )

    await paste(user)

    // `AUD-024`: a document cut at a chunk limit reported success with most of
    // itself unread.
    expect(await screen.findByRole('alert')).toHaveTextContent(/11 sections were not stored/i)
    expect(screen.getByText(/part of this document has not been read/i)).toBeInTheDocument()
  })

  it('carries Memory’s own warnings, unparaphrased', async () => {
    const user = userEvent.setup()
    renderIngestion((services) =>
      withIngestion(services, {
        ingestText: async () => ({
          document: 'Brief',
          chunks: 1,
          truncatedChunks: 0,
          warnings: ['one chunk exceeded the item limit and was extracted partially'],
        }),
      }),
    )

    await paste(user)

    expect(
      await screen.findByText(/one chunk exceeded the item limit and was extracted partially/i),
    ).toBeInTheDocument()
  })

  it('surfaces a refusal rather than looking like it worked', async () => {
    const user = userEvent.setup()
    renderIngestion((services) =>
      withIngestion(services, {
        ingestText: async () => {
          throw new Error('KAE-Memory returned 503')
        },
      }),
    )

    await paste(user)

    expect(await screen.findByText(/KAE-Memory returned 503/)).toBeInTheDocument()
    expect(screen.queryByText(/stored and queued/i)).not.toBeInTheDocument()
  })
})

describe('uploading a file', () => {
  it('decodes, then waits for confirmation before ingesting', async () => {
    const user = userEvent.setup()
    const sent: { title: string; text: string; origin?: string }[] = []
    renderIngestion((services) =>
      withIngestion(services, {
        decodeUpload: async () => ({
          text: 'Invoices go out weekly.',
          warnings: [],
          format: 'text',
          suggestedTitle: 'brief',
        }),
        ingestText: async (id, document) => {
          sent.push(document)
          return services.ingestion.ingestText(id, document)
        },
      }),
    )

    await user.click(await screen.findByRole('tab', { name: /upload a file/i }))
    await chooseFile(new File(['Invoices go out weekly.'], 'brief.txt', { type: 'text/plain' }))

    expect(await screen.findByLabelText(/what kae will read/i)).toHaveValue(
      'Invoices go out weekly.',
    )
    expect(screen.getByLabelText(/what is this/i)).toHaveValue('brief')
    expect(sent).toEqual([])

    await user.click(screen.getByRole('button', { name: /read this/i }))

    expect(sent).toEqual([{ title: 'brief', text: 'Invoices go out weekly.', origin: 'upload' }])
    expect(await screen.findByText(/stored and queued/i)).toBeInTheDocument()
  })

  it('refuses a type it cannot read, and does not look like it worked', async () => {
    const user = userEvent.setup()
    renderIngestion()

    await user.click(await screen.findByRole('tab', { name: /upload a file/i }))
    await chooseFile(new File(['\x89PNG'], 'logo.png', { type: 'image/png' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot read this file type/i)
    expect(screen.queryByRole('button', { name: /read this/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/stored and queued/i)).not.toBeInTheDocument()
  })

  it('shows a scan warning before ingest, rather than silently emptying', async () => {
    const user = userEvent.setup()
    renderIngestion((services) =>
      withIngestion(services, {
        decodeUpload: async () => ({
          text: 'Hi.',
          warnings: [
            'This PDF has almost no extractable text. It may be a scan. OCR is not available; paste the wording if you have it.',
          ],
          format: 'pdf',
          suggestedTitle: 'scan',
        }),
      }),
    )

    await user.click(await screen.findByRole('tab', { name: /upload a file/i }))
    await chooseFile(new File(['Hi.'], 'scan.pdf', { type: 'application/pdf' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/may be a scan/i)
    expect(screen.getByRole('button', { name: /read this/i })).toBeEnabled()
  })
})

describe('watching what KAE did', () => {
  it('shows each run and what it produced', async () => {
    renderIngestion()

    // Two discovery runs in the fixture, deliberately: one that succeeded and
    // one that did not, because the success path is the one nobody gets wrong.
    expect(await screen.findAllByText(/reading a document/i)).toHaveLength(2)
    expect(screen.getByText(/6 statements/i)).toBeInTheDocument()
  })

  it('says what a failure means, in words', async () => {
    renderIngestion()

    // `VC-10`. `unverifiable_output` tells a person something is wrong and
    // nothing about whether it is theirs to fix.
    expect(await screen.findByText(/quoted text that is not in the source/i)).toBeInTheDocument()
    expect(screen.getByText(/every statement KAE records has to be traceable/i)).toBeInTheDocument()
  })

  it('keeps the technical message beside the reading', async () => {
    renderIngestion()

    // A summarised error is one a person cannot search for.
    expect(
      await screen.findByText('quote not found in source after 3 attempts'),
    ).toBeInTheDocument()
  })

  it('renders an unknown code as itself rather than inventing a meaning', async () => {
    renderIngestion((services) =>
      withIngestion(services, {
        runs: async () => [
          {
            id: 'r1',
            role: 'discovery',
            status: 'failed',
            attemptNumber: 1,
            errorCode: 'something_new_from_a_later_memory',
            errorMessage: 'detail',
            startedAt: null,
            completedAt: null,
            outputSummary: {},
          },
        ],
      }),
    )

    // "Something went wrong" would be worse than the identifier, because it
    // throws away the one piece of information the identifier carries.
    expect(await screen.findByText('something_new_from_a_later_memory')).toBeInTheDocument()
    expect(screen.getByText(/no plain-words reading for that yet/i)).toBeInTheDocument()
  })

  it('dates each run and says how long a finished one took', async () => {
    renderIngestion((services) =>
      withIngestion(services, {
        runs: async () => [
          {
            id: 'r1',
            role: 'discovery',
            status: 'succeeded',
            attemptNumber: 1,
            errorCode: null,
            errorMessage: null,
            startedAt: '2026-03-04T09:15:00Z',
            completedAt: '2026-03-04T09:15:42Z',
            outputSummary: {},
          },
        ],
      }),
    )

    // *Newest first* over undated rows makes a run from five minutes ago and
    // one from three weeks ago the same row.
    expect(await screen.findByText(/4 Mar, 09:15/)).toBeInTheDocument()
    expect(screen.getByText(/took 42s/)).toBeInTheDocument()
  })

  it('says nothing about how long a run still going has taken', async () => {
    renderIngestion((services) =>
      withIngestion(services, {
        runs: async () => [
          {
            id: 'r1',
            role: 'discovery',
            status: 'running',
            attemptNumber: 1,
            errorCode: null,
            errorMessage: null,
            startedAt: '2026-03-04T09:15:00Z',
            completedAt: null,
            outputSummary: {},
          },
        ],
      }),
    )

    // The badge already says `running`. A duration invented from a missing end
    // would read as a run that finished instantly.
    expect(await screen.findByText(/4 Mar, 09:15/)).toBeInTheDocument()
    expect(screen.queryByText(/took/)).not.toBeInTheDocument()
  })

  it('says nothing rather than that a run took less than no time', async () => {
    renderIngestion((services) =>
      withIngestion(services, {
        runs: async () => [
          {
            id: 'r1',
            role: 'discovery',
            status: 'succeeded',
            attemptNumber: 1,
            errorCode: null,
            errorMessage: null,
            startedAt: '2026-03-04T09:15:42Z',
            completedAt: '2026-03-04T09:15:00Z',
            outputSummary: {},
          },
        ],
      }),
    )

    // Both ends are the server's clock, so an end before a start is a fact
    // about the clock. *took -42s* would send a person looking for a bug in
    // their project.
    expect(await screen.findByText(/4 Mar, 09:15/)).toBeInTheDocument()
    expect(screen.queryByText(/took/)).not.toBeInTheDocument()
  })

  it('dates nothing for a run that never started', async () => {
    renderIngestion((services) =>
      withIngestion(services, {
        runs: async () => [
          {
            id: 'r1',
            role: 'discovery',
            status: 'pending',
            attemptNumber: 1,
            errorCode: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            outputSummary: {},
          },
        ],
      }),
    )

    // An em dash where a date would go is a row asking a person to wonder what
    // is missing. A queued run has no start because it has not started.
    const row = (await screen.findByText(/reading a document/i)).closest('li')
    expect(row).not.toBeNull()
    expect(row?.textContent).not.toMatch(/—|took/)
  })

  it('says when nothing has run at all', async () => {
    renderIngestion((services) => withIngestion(services, { runs: async () => [] }))

    expect(
      await screen.findByText(/KAE has not read anything for this project/i),
    ).toBeInTheDocument()
  })
})

describe('how much has been read', () => {
  it('reports loss beside the count, not folded into it', async () => {
    renderIngestion()

    expect(await screen.findByText(/6 sections read, 1 abandoned/i)).toBeInTheDocument()
    // The sentence that keeps readiness honest: a project that lost content is
    // not less ready, it is less read.
    expect(screen.getByText(/it is lower because part of what you gave KAE/i)).toBeInTheDocument()
  })
})

describe('the composer’s attach button', () => {
  it('goes to ingestion rather than doing nothing', async () => {
    // `AUD-022`'s remaining half. This button had no `onClick` for the whole
    // life of the product — the most prominent dead control in Studio, in its
    // main surface. It links to `/ingestion`, where a person pastes or uploads,
    // sees the text, and confirms.
    const { Composer } = await import('@/pages/rooms/interview/InterviewRoom')
    render(
      <MemoryRouter>
        <Composer onSend={() => {}} pending={false} draft="" setDraft={() => {}} />
      </MemoryRouter>,
    )

    const attach = screen.getByRole('link', { name: /give KAE a document to read/i })
    expect(attach).toHaveAttribute('href', '/ingestion')
  })
})

describe('the failure a person actually meets', () => {
  it('reads retry_budget_exhausted, because it is the terminal one', async () => {
    // Found by deploying: the live project had one of these against a single
    // unverifiable_output, and the first version of the vocabulary had no
    // reading for it. `abandon()` sets it when the budget is spent, so it is
    // the code on the run a person sees stopped.
    renderIngestion((services) =>
      withIngestion(services, {
        runs: async () => [
          {
            id: 'r1',
            role: 'discovery',
            status: 'abandoned',
            attemptNumber: 3,
            errorCode: 'retry_budget_exhausted',
            errorMessage: 'quote not found in source',
            startedAt: null,
            completedAt: null,
            outputSummary: {},
          },
        ],
      }),
    )

    expect(await screen.findByText(/tried three times and stopped/i)).toBeInTheDocument()
    // And the reassurance that matters: a failure did not corrupt the project.
    expect(screen.getByText(/nothing incorrect was recorded either/i)).toBeInTheDocument()
  })
})
