/**
 * Definition renders what Memory holds, or says why it cannot.
 *
 * `toProjection` hard-coded every Definition field empty (DEF-1.3), so the page
 * was blank for every project whatever the project held. These cover the wiring
 * and, more importantly, the two ways it could go wrong afterwards: silently
 * dropping the block, or filling it with something plausible.
 */

import { describe, expect, it } from 'vitest'
import { toProjection } from './liveServices'

function backend(overrides: Record<string, unknown> = {}) {
  return {
    project: { id: 'p1', name: 'Test', phase: 'active', memoryRevision: 3, createdAt: '' },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 0, status: 'not_started', areas: [] },
    openQuestions: [],
    blockers: [],
    contradictions: { count: 0, listable: false, reason: '' },
    preliminary: { warnings: [], materialUnknowns: [] },
    modules: { available: false, gap: { capability: '', reason: '' } },
    unavailable: [],
    ...overrides,
  } as never
}

describe('the Definition block', () => {
  it('carries what the backend derived from confirmed knowledge', () => {
    const projection = toProjection(
      backend({
        definition: {
          problem: '',
          value: '',
          objectives: [{ id: 'k1', text: 'Publish within a week.', status: 'confirmed' }],
          stakeholders: [{ id: 'k2', name: 'Ministry leaders submit reports.', status: 'confirmed' }],
          inScope: [],
          outOfScope: [],
          workflows: [],
          assumptions: [],
          constraints: [{ id: 'k3', text: 'The team is three people.', status: 'confirmed' }],
          mappingVersion: 1,
        },
      }),
    )

    expect(projection.definition.objectives).toHaveLength(1)
    expect(projection.definition.stakeholders[0].name).toBe('Ministry leaders submit reports.')
    expect(projection.definition.constraints[0].text).toBe('The team is three people.')
  })

  it('leaves the problem statement empty rather than borrowing an objective', () => {
    const projection = toProjection(
      backend({
        definition: {
          problem: '',
          value: '',
          objectives: [{ id: 'k1', text: 'Publish within a week.', status: 'confirmed' }],
          stakeholders: [],
          inScope: [],
          outOfScope: [],
          workflows: [],
          assumptions: [],
          constraints: [],
          mappingVersion: 1,
        },
      }),
    )

    expect(projection.definition.problem).toBe('')
  })

  it('survives a backend that predates the block', () => {
    // Not a project without a definition — a deployment where the two halves
    // are different versions. Rendering blank is right; throwing is not.
    const projection = toProjection(backend())

    expect(projection.definition.objectives).toEqual([])
    expect(projection.definition.problem).toBe('')
  })
})
