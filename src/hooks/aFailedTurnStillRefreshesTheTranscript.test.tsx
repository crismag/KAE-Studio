/**
 * `D-284` — the message is durable whether the turn succeeded or not.
 *
 * CIE records what the person said as the first act of a turn, before it reads
 * the project and before it asks the model. `Composer` clears the draft
 * unconditionally on submit. So with the transcript invalidated only
 * `onSuccess`, a failed turn left the sentence gone from the box, absent from
 * the conversation, and present in KAE-Memory — the one state in which
 * *"nothing was recorded"* is most persuasive and least true.
 *
 * The room now tells the person to check the conversation above. That advice is
 * only followable if the conversation was asked for again, which is what these
 * assert.
 *
 * ## The projection is deliberately not refreshed on failure
 *
 * A failed turn produced no move, recorded no assumption and changed nothing
 * derived. Asking for the projection again would be a guess dressed as a
 * refresh, and it is the expensive read on this page.
 */

import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ServiceProvider } from '@/services/ServiceProvider'
import { createMockServices } from '@/services/mock/mockServices'
import { useSendMessage } from './useProject'
import type { StudioServices } from '@/services/interfaces'

/** Services whose turn always fails, the way an unreachable model does. */
function withAFailingTurn(): StudioServices {
  const base = createMockServices()
  return {
    ...base,
    interview: {
      ...base.interview,
      respondTo: async () => {
        throw new Error('the interviewer could not be reached')
      },
    },
  }
}

function harness(services: StudioServices) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>{children}</ServiceProvider>
    </QueryClientProvider>
  )
  return { wrapper, invalidate }
}

/** Whether anything asked for this query to be read again. */
function asked(invalidate: { mock: { calls: unknown[][] } }, name: string): boolean {
  return invalidate.mock.calls.some((call) => {
    const key = (call[0] as { queryKey?: unknown[] } | undefined)?.queryKey
    return Array.isArray(key) && key[0] === name
  })
}

describe('a turn that failed', () => {
  it('asks for the transcript again, because the message is durable anyway', async () => {
    const { wrapper, invalidate } = harness(withAFailingTurn())
    const { result } = renderHook(() => useSendMessage(), { wrapper })

    result.current.mutate('Reports go to the ministry every quarter.')

    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() => expect(asked(invalidate, 'messages')).toBe(true))
  })

  it('asks for the session again as well', async () => {
    // The session is where the transcript hangs off. Refreshing one without the
    // other reads back a conversation from a session state that predates it.
    const { wrapper, invalidate } = harness(withAFailingTurn())
    const { result } = renderHook(() => useSendMessage(), { wrapper })

    result.current.mutate('Reports go to the ministry every quarter.')

    await waitFor(() => expect(result.current.isError).toBe(true))
    await waitFor(() => expect(asked(invalidate, 'session')).toBe(true))
  })

  it('does not ask for the projection, because nothing derived changed', async () => {
    const { wrapper, invalidate } = harness(withAFailingTurn())
    const { result } = renderHook(() => useSendMessage(), { wrapper })

    result.current.mutate('Reports go to the ministry every quarter.')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(asked(invalidate, 'project')).toBe(false)
  })
})

describe('a turn that succeeded', () => {
  it('still refreshes the transcript and the project', async () => {
    // The control. Moving the transcript onto `onSettled` must not take it off
    // the success path, and the project read stays where it was.
    const { wrapper, invalidate } = harness(createMockServices())
    const { result } = renderHook(() => useSendMessage(), { wrapper })

    result.current.mutate('Reports go to the ministry every quarter.')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await waitFor(() => expect(asked(invalidate, 'messages')).toBe(true))
    expect(asked(invalidate, 'project')).toBe(true)
  })
})
