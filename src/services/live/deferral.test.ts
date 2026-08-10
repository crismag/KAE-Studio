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

describe('a turn survives a refresh', () => {
  it('rebuilds conclusions and the recommendation from message metadata', async () => {
    // AUD-013. `concluded` was persisted and never read back; `recommendation`
    // was returned on the response and stored nowhere. A refresh erased both
    // from the transcript while the provenance beside them survived — which
    // made a silent loss look like a deliberate omission.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'm1',
            content: 'So the constraint is a two-week deadline.',
            actor_type: 'assistant',
            created_at: '2026-08-10T00:00:00Z',
            metadata: {
              skill: 'reflect_understanding',
              provenance: ['k1'],
              concluded: [
                {
                  statement: 'Ships in two weeks.',
                  consequence: 'ARCHITECTURAL',
                  revisit_when: 'BEFORE_BUILD',
                  material: true,
                },
              ],
              recommendation: {
                advice: 'Cut scope to the inbox.',
                reason: 'Two weeks does not fit the whole thing.',
                consequence: 'REWORK',
              },
            },
          },
        ]),
        { status: 200 },
      ),
    )

    const [message] = await createLiveServices('p1').memory.listMessages('p1')

    expect(message.concluded).toHaveLength(1)
    expect(message.concluded?.[0].statement).toBe('Ships in two weeks.')
    // camelCase on the way in: the component reads `revisitWhen`, and the wire
    // says `revisit_when`. Under the old path neither existed at all.
    expect(message.concluded?.[0].revisitWhen).toBe('BEFORE_BUILD')
    expect(message.recommendation?.advice).toBe('Cut scope to the inbox.')

    vi.restoreAllMocks()
  })

  it('leaves a turn that concluded nothing empty rather than inventing one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'm2',
            content: 'What does the deadline depend on?',
            actor_type: 'assistant',
            created_at: '2026-08-10T00:00:00Z',
            metadata: { skill: 'ask_one_question' },
          },
        ]),
        { status: 200 },
      ),
    )

    const [message] = await createLiveServices('p1').memory.listMessages('p1')

    expect(message.concluded).toEqual([])
    expect(message.recommendation).toBeNull()

    vi.restoreAllMocks()
  })
})
