/**
 * Deferring a question, and bringing it back.
 *
 * A deferral records that someone was asked and did not decide, so it must not
 * close the question (N36). KAE-Memory models that correctly: `deferred` is not
 * in `SETTLES`, and the queue keeps saying the question is open.
 *
 * Coming back was wrong. "Bring back" sent `answered`, which *is* in `SETTLES`,
 * so the button closed the question it claimed to reopen — silently, because a
 * settled question simply stops appearing.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createLiveServices } from './liveServices'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
  vi.stubGlobal('fetch', fetchMock)
})

function bodyOf(call: unknown[]): Record<string, unknown> {
  return JSON.parse((call[1] as { body: string }).body)
}

describe('deferring a decision', () => {
  it('records a deferral that does not close the question', async () => {
    await createLiveServices('p1').memory.deferDecision('p1', 'q1', true)

    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({ disposition: 'deferred' })
  })

  it('reopens rather than answers when brought back', async () => {
    // `answered` is in SETTLES. Sending it here closed the question the button
    // exists to reopen.
    await createLiveServices('p1').memory.deferDecision('p1', 'q1', false)

    const body = bodyOf(fetchMock.mock.calls[0])
    expect(body.disposition).toBe('open')
    expect(body.disposition).not.toBe('answered')
  })
})
