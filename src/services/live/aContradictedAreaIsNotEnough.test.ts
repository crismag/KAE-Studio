/**
 * `D-288` — KAE-Memory grades an area's internal conflict and Studio printed
 * *"enough for now"* over it.
 *
 * `evaluate_area` computes `state` and `contradicted` independently, so a
 * `sufficient` area can hold an unresolved contradiction. Memory does not treat
 * that as finished — it refuses to call such an area one answer away whatever
 * its shortfall (`D-157`) — and the field crossed the wire, reached Studio's
 * backend and reached the wire type here, where the mapper built `CoverageTopic`
 * from five keys and this was not one of them.
 *
 * The rendering half is in `pages/rooms/interview`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { toProjection } from './liveServices'

function area(over: Record<string, unknown> = {}) {
  return {
    key: 'problem',
    name: 'Problem and value',
    state: 'sufficient',
    confirmed: 2,
    proposed: 0,
    required: 2,
    mandatory: true,
    ...over,
  }
}

function backend(areas: Record<string, unknown>[]) {
  return {
    project: { id: 'p1', name: 'Test', phase: 'active', memoryRevision: 3, createdAt: '' },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 0, status: 'not_started', areas },
    openQuestions: [],
    blockers: [],
    contradictions: { count: 0, listable: false, reason: '' },
    preliminary: { warnings: [], materialUnknowns: [] },
    modules: { available: false, gap: { capability: '', reason: '' } },
    unavailable: [],
  } as never
}

function coverage(over: Record<string, unknown> = {}) {
  const [topic] = toProjection(backend([area(over)])).health.coverage
  return topic
}

afterEach(() => vi.restoreAllMocks())

describe("an area's own conflict reaches the panel", () => {
  it('carries the contradiction KAE-Memory measured', () => {
    expect(coverage({ contradicted: true }).contradicted).toBe(true)
  })

  it('carries a measured absence of one as the answer it is', () => {
    expect(coverage({ contradicted: false }).contradicted).toBe(false)
  })

  it('says nothing when KAE-Memory did not say', () => {
    // Absent is not *no contradiction* (`D-38`). A Studio backend older than
    // this has made no claim either way, and `false` would be Studio making
    // one on its behalf.
    expect(coverage().contradicted).toBeNull()
    expect(coverage({ contradicted: null }).contradicted).toBeNull()
  })

  it('leaves the state exactly as KAE-Memory graded it', () => {
    // The control, and the whole argument for a separate field: a
    // contradiction is a fact about the knowledge inside an area, not a degree
    // of coverage, and demoting the state here would be Studio regrading an
    // area — which of the three vocabularies governs is an open ruling
    // (`D-31`).
    const topic = coverage({ contradicted: true })

    expect(topic.state).toBe('strong')
    expect(topic.detail).toContain('enough for now')
  })
})
