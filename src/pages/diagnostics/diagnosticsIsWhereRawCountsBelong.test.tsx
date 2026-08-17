/**
 * The operator page shows the pipeline's numbers, and does not read as progress.
 *
 * `EPI-7`/`D-156`. Two things can go wrong here quietly. It could **invent a
 * figure** — a health percentage or a ratio the projection never carried — which
 * is the one defect this surface cannot afford, since its whole claim is that
 * these are the raw values rather than a reading of them. And it could render
 * **absent as zero**: a projection carrying no extraction coverage has not
 * reported how much of the sources was read, which is a different fact from
 * having abandoned nothing, and on this page that difference is the point.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Diagnostics } from './DiagnosticsPage'
import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import type { ProjectProjection } from '@/domain/types'
import type { StudioServices } from '@/services/interfaces'

function renderDiagnostics(shape?: (base: ProjectProjection) => ProjectProjection) {
  const services = createMockServices()
  const original = services.projection.getProjection.bind(services.projection)
  const patched: StudioServices = {
    ...services,
    projection: {
      ...services.projection,
      getProjection: async (id: string) => {
        const base = await original(id)
        return shape ? shape(base) : base
      },
      classify: (id: string) => services.projection.classify(id),
    },
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ServiceProvider services={patched}>
          <Diagnostics />
        </ServiceProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('the raw counts have a home that is not a to-do list', () => {
  it('says these numbers are not work anybody has to do', async () => {
    renderDiagnostics()

    expect(await screen.findByText(/not a list of things anybody has to do/i)).toBeTruthy()
  })

  it('shows the pipeline counts the projection carries', async () => {
    renderDiagnostics()

    expect(await screen.findByText('Statements')).toBeTruthy()
    expect(screen.getByText('Proposed')).toBeTruthy()
    expect(screen.getByText('Open questions')).toBeTruthy()
  })

  it('keeps findings apart from proposed statements, which are a different set', async () => {
    // `D-96`. They were rendered as one number once, and the two differ by an
    // order of magnitude on the owner's own project.
    renderDiagnostics()

    expect(
      await screen.findByText(/Findings are what a review produced, and are not the proposed/i),
    ).toBeTruthy()
  })

  it('reports unread coverage as unreported rather than as nothing abandoned', async () => {
    renderDiagnostics((base) => ({ ...base, extractionCoverage: undefined }))

    expect(await screen.findByText(/is unreported — which is not the same as/i)).toBeTruthy()
    expect(screen.queryByText('Sections abandoned')).toBeNull()
  })

  it('counts the sections nobody read, beside the ones extraction gave up on', async () => {
    // `D-232`. This panel showed "Sections abandoned: 0" beside a warning that
    // content was lost, because a document truncated at the ingest ceiling
    // never becomes a run — a different failure from abandonment (`AUD-024`).
    renderDiagnostics((base) => ({
      ...base,
      extractionCoverage: {
        succeeded: 3,
        abandoned: 0,
        notIngested: 4,
        total: 7,
        complete: false,
      },
    }))

    expect(await screen.findByText('Sections never read')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText(/4 of 7 were never read at all/i)).toBeTruthy()
  })

  it('draws a figure the backend did not report as unknown, not as zero', async () => {
    // The distinction this page exists to keep, applied to the new fields: a
    // Memory older than `AUD-024` counts no truncation, and a zero there would
    // claim none happened.
    renderDiagnostics((base) => ({
      ...base,
      extractionCoverage: {
        succeeded: 3,
        abandoned: 1,
        notIngested: null,
        total: null,
        complete: false,
      },
    }))

    expect(await screen.findByText('Sections never read')).toBeTruthy()
    expect(screen.getByText(/An em dash is a figure this backend did not report/i)).toBeTruthy()
    // The denominator falls back to what it was, which is today's behaviour on
    // a backend that reports no total.
    expect(screen.getByText(/1 of 4 submissions could not be fully read/i)).toBeTruthy()
  })

  it('invents no figure of its own', async () => {
    // Every number on the page has to be one the projection carried. A percent
    // sign here is a derived reading wearing a raw value's clothes.
    const { container } = renderDiagnostics()

    await screen.findByText('Statements')

    expect(container.textContent).not.toMatch(/%/)
  })
})
