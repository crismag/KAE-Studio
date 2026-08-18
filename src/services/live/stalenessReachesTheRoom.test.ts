/**
 * The adapter hop of `D-278` — whether the number is behind the project.
 *
 * KAE-Memory computes `is_stale` at read time against the project's current
 * revision, Studio's backend read it once to decide whether a classify press
 * would be refused, and the projection dropped it. This covers the last hop
 * before a component can read it: the field survives the adapter, and the two
 * ways of knowing nothing arrive as `null` rather than as a claim that the
 * number is current.
 */

import { describe, expect, it } from 'vitest'
import { toProjection } from './liveServices'

function backend(health: Record<string, unknown>) {
  return {
    project: { id: 'p1', name: 'Test', phase: 'active', memoryRevision: 3, createdAt: '' },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 40, status: 'discovering', areas: [], ...health },
    openQuestions: [],
    blockers: [],
    contradictions: { count: 0, listable: false, reason: '' },
    preliminary: { warnings: [], materialUnknowns: [] },
    modules: { available: false, gap: { capability: '', reason: '' } },
    unavailable: [],
  } as never
}

describe('staleness reaches the room', () => {
  it('carries a project that has moved since the number was measured', () => {
    expect(toProjection(backend({ knowledgeIsStale: true })).health.knowledgeIsStale).toBe(true)
  })

  it('carries a number measured at where the project is', () => {
    expect(toProjection(backend({ knowledgeIsStale: false })).health.knowledgeIsStale).toBe(false)
  })

  it('reads a backend that said nothing as unknown, never as current', () => {
    // `D-38`. A Studio backend older than this field, and a KAE-Memory that
    // sent none, both reach the UI as `null` — and the component renders
    // nothing for it. `false` here would be an assertion of freshness built on
    // an absent field.
    expect(toProjection(backend({})).health.knowledgeIsStale).toBeNull()
    expect(toProjection(backend({ knowledgeIsStale: null })).health.knowledgeIsStale).toBeNull()
  })

  it('leaves the percentage beside it untouched', () => {
    // The control. A failure here means the fixture stopped reaching the
    // mapper rather than that staleness regressed.
    expect(toProjection(backend({ knowledgeIsStale: true })).health.summary).toContain('40%')
  })
})
