/**
 * `D-43` — a finished extraction refreshes what it produced.
 *
 * Extraction is the one thing that changes a project without anybody touching
 * it. Eight mutations invalidate `['projection']` — every action a person takes
 * refreshes what they see — and a run finishing did not.
 *
 * So somebody could paste a brief, watch the runs go green, and read a page
 * still describing the project as it was before their document was read. The
 * runs panel said the work succeeded; the page beside it disagreed.
 *
 * ## Why this and not a freshness badge
 *
 * `§15` recommends *current/stale/pending/unavailable* metadata. A badge reading
 * *"stale"* on a screen whose data is stale **because we did not ask again** is
 * a label for our own omission. The state was worth finding; the vocabulary was
 * not worth adding.
 *
 * ## One mutant these cannot kill, and why that is not a gap
 *
 * Removing `&& !working` from the condition leaves behaviour identical: the
 * effect's dependency array is `[working, …]`, so it only runs when `working`
 * changes, and `wasWorking.current` is true only on the change *out of* work.
 * The two forms are equivalent in every reachable state.
 *
 * The clause stays because it says what the condition means to a reader, and
 * because a later change to the dependency array would make it load-bearing
 * again. It is recorded here rather than defended by a contrived test — **a
 * guard that cannot fail is decoration**, and pretending otherwise is worse
 * than saying which of three attempts actually held.
 */

import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { useRuns } from './useProject'
import type { StudioServices } from '@/services/interfaces'
import type { AgentRunRecord } from '@/domain/types'

function run(status: AgentRunRecord['status']): AgentRunRecord {
  return {
    runId: `run-${status}`,
    status,
    attemptNumber: 1,
    errorCode: null,
    startedAt: '2026-08-13T09:00:00Z',
    produced: 0,
  } as unknown as AgentRunRecord
}

/** A services object whose run list is whatever the caller says it is now. */
function withRuns(rows: () => AgentRunRecord[]): StudioServices {
  const base = createMockServices()
  const port = base.ingestion
  return {
    ...base,
    ingestion: {
      ingestText: (projectId, document) => port.ingestText(projectId, document),
      runs: async () => rows(),
      coverage: (projectId) => port.coverage(projectId),
    },
  }
}

function harness(services: StudioServices) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>{children}</ServiceProvider>
    </QueryClientProvider>
  )
  return { wrapper, invalidate }
}

/** Whether anything asked for the projection to be read again. */
function projectionInvalidated(invalidate: { mock: { calls: unknown[][] } }): boolean {
  return invalidate.mock.calls.some((call) => {
    const key = (call[0] as { queryKey?: unknown[] } | undefined)?.queryKey
    return Array.isArray(key) && key[0] === 'projection'
  })
}

describe('when work finishes', () => {
  it('asks the projection again', async () => {
    let rows = [run('running')]
    const { wrapper, invalidate } = harness(withRuns(() => rows))
    const { result, rerender } = renderHook(() => useRuns(), { wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(projectionInvalidated(invalidate)).toBe(false)

    rows = [run('succeeded')]
    await result.current.refetch()
    rerender()

    await waitFor(() => expect(projectionInvalidated(invalidate)).toBe(true))
  })

  it('does not ask again while the work is still going', async () => {
    // Invalidating on every poll would refetch the whole projection every four
    // seconds to show a project that has not changed yet.
    const { wrapper, invalidate } = harness(withRuns(() => [run('running')]))
    const { result, rerender } = renderHook(() => useRuns(), { wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(1))

    // Polled again, still working. The first version of this rendered once and
    // passed with the transition check removed — the effect had simply never
    // run a second time, so it proved nothing about the condition it names.
    await result.current.refetch()
    rerender()
    await result.current.refetch()
    rerender()

    expect(projectionInvalidated(invalidate)).toBe(false)
  })

  it('does not ask again on a project whose runs were finished all along', async () => {
    // The transition is the event, not the state. A page opened after the work
    // completed has nothing to refresh, and refetching on arrival would undo
    // the caching every other surface depends on.
    const { wrapper, invalidate } = harness(withRuns(() => [run('succeeded')]))
    const { result } = renderHook(() => useRuns(), { wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(1))

    expect(projectionInvalidated(invalidate)).toBe(false)
  })

  it('treats a failed run as finished too', async () => {
    // A run that failed changed nothing, but the panel stops polling either
    // way — and a page that refreshes after a failure shows the same project,
    // which costs one request and keeps the rule simple.
    let rows = [run('running')]
    const { wrapper, invalidate } = harness(withRuns(() => rows))
    const { result, rerender } = renderHook(() => useRuns(), { wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    rows = [run('failed')]
    await result.current.refetch()
    rerender()

    await waitFor(() => expect(projectionInvalidated(invalidate)).toBe(true))
  })
})
