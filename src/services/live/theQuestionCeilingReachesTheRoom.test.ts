/**
 * The adapter hop of `D-282` — whether the list of questions is the whole list.
 *
 * KAE-Memory's candidates listing truncates to `limit`, orders most severe
 * first, and says how many it cut. Studio's projection now carries both counts
 * (`openQuestionsCompleteness`); this covers the last hop before a component
 * can read them, and that a backend claiming nothing arrives as `null` rather
 * than as a claim that the list is whole.
 */

import { describe, expect, it } from 'vitest'
import { toProjection } from './liveServices'

function backend(completeness?: Record<string, unknown>) {
  return {
    project: { id: 'p1', name: 'Test', phase: 'active', memoryRevision: 3, createdAt: '' },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 40, status: 'discovering', areas: [] },
    openQuestions: [
      { id: 'q-1', question: 'What is in scope?', severity: 'critical', disposition: 'open' },
    ],
    ...(completeness === undefined ? {} : { openQuestionsCompleteness: completeness }),
    blockers: [],
    contradictions: { count: 0, listable: false, reason: '' },
    preliminary: { warnings: [], materialUnknowns: [] },
    modules: { available: false, gap: { capability: '', reason: '' } },
    unavailable: [],
  } as never
}

describe('the question ceiling reaches the room', () => {
  it('carries how many the ceiling cut, and how many there are', () => {
    const completeness = toProjection(backend({ total: 47, omitted: 27 })).openDecisionsCompleteness

    expect(completeness).toEqual({ total: 47, omitted: 27 })
  })

  it('carries a whole list as a claim rather than as silence', () => {
    // Zero is the producer saying it counted and cut nothing. Collapsing it
    // into `null` would lose the difference between "complete" and "we were
    // not told", which is the whole point of the tri-state.
    expect(toProjection(backend({ total: 1, omitted: 0 })).openDecisionsCompleteness).toEqual({
      total: 1,
      omitted: 0,
    })
  })

  it('reads a backend that said nothing as unknown, never as whole', () => {
    // `D-38`. A Studio backend older than the field claims nothing about
    // completeness, and the component renders nothing for it.
    expect(toProjection(backend()).openDecisionsCompleteness).toEqual({
      total: null,
      omitted: null,
    })
  })

  it('leaves the questions beside them untouched', () => {
    // The control. A failure here means the fixture stopped reaching the
    // mapper rather than that the counts regressed.
    expect(toProjection(backend({ total: 47, omitted: 27 })).openDecisions).toHaveLength(1)
  })
})
