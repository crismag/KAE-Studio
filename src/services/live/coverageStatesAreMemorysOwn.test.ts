/**
 * `D-27` — an area KAE-Memory calls `sufficient` is not missing.
 *
 * The adapter read `a.state === 'satisfied'`. **`satisfied` is not one of
 * Memory's states**: `AreaState` is `missing`, `partial`, `sufficient`,
 * `not_applicable`. The comparison had never once been true, so a fully covered
 * area fell through to `missing` on the Coverage panel — the panel a person
 * reads to learn what KAE understands about their project — with a detail line
 * reading "0 of 2 confirmed" beside an area Memory held as done.
 *
 * The same word in the same mistake had already been found and fixed in
 * Studio's backend, twenty lines from a comment recording the lesson. The
 * adapter kept it. **A fix that does not check for siblings is half a fix**,
 * and that is what these are for: the mapping is asserted against Memory's
 * whole vocabulary rather than against the states somebody remembered.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLiveServices } from './liveServices'

/**
 * `AreaState` in `kae_memory/domain/readiness.py`, verbatim.
 *
 * Written out rather than imported — the two repositories share no code — so a
 * state added there and not here is a change somebody has to make deliberately,
 * and one added here without a mapping fails immediately below.
 */
const MEMORY_AREA_STATES = ['missing', 'partial', 'sufficient', 'not_applicable'] as const

function area(state: string, counts: Partial<{ confirmed: number; proposed: number }> = {}) {
  return {
    key: 'problem',
    name: 'Problem and value',
    state,
    confirmed: counts.confirmed ?? 0,
    proposed: counts.proposed ?? 0,
    required: 2,
    mandatory: true,
    contradicted: false,
  }
}

function respond(areas: unknown[]) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        project: { id: 'p1', name: 'Test', phase: 'active', createdAt: '', memoryRevision: 1 },
        confirmed: [],
        proposed: [],
        rejected: [],
        health: { percentage: 0, phase: 'discovering', areas },
        definition: {
          problem: { value: '' },
          value: { value: '' },
          stakeholders: [],
          inScope: [],
          outOfScope: [],
          workflows: [],
          assumptions: [],
          constraints: [],
          mappingVersion: 1,
        },
        openQuestions: [],
        blockers: [],
        contradictions: { count: 0, listable: false, reason: '' },
        preliminary: { warnings: [] },
        modules: { available: false, gap: { capability: 'modules', reason: '' } },
        unavailable: [],
      }),
      { status: 200 },
    ),
  )
}

async function coverage(state: string, counts?: Partial<{ confirmed: number; proposed: number }>) {
  respond([area(state, counts)])
  const projection = await createLiveServices('p1').projection.getProjection('p1')
  return projection.health.coverage[0]
}

afterEach(() => vi.restoreAllMocks())

describe('every state KAE-Memory has is named here', () => {
  it.each(MEMORY_AREA_STATES)('maps %s to something Studio renders', async (state) => {
    // The check that would have caught the original: driven off Memory's
    // vocabulary, so a word this build does not know cannot quietly become an
    // absence.
    const topic = await coverage(state)

    expect(topic.state).toBeTruthy()
    expect(topic.detail).toBeTruthy()
  })

  it('calls a sufficient area strong, not missing', async () => {
    // The defect, exactly. It shipped, and no test covered it.
    const topic = await coverage('sufficient', { confirmed: 3 })

    expect(topic.state).toBe('strong')
    expect(topic.detail).toBe('3 confirmed — enough for now')
  })

  it('never reports a sufficient area as a gap', async () => {
    const topic = await coverage('sufficient', { confirmed: 3 })

    expect(['missing', 'thin']).not.toContain(topic.state)
  })
})

describe('an area that does not apply is not an area nobody covered', () => {
  it('has its own state rather than falling into missing', async () => {
    // Memory means *this does not apply to this project*; `missing` means
    // *nobody has said anything about it*. One is a gap and the other is not.
    const topic = await coverage('not_applicable')

    expect(topic.state).toBe('notApplicable')
  })

  it('says so in words, and not as a count of nothing', async () => {
    const topic = await coverage('not_applicable')

    expect(topic.detail).toBe('Not applicable to this project.')
    expect(topic.detail).not.toMatch(/0 of/)
  })
})

describe('the states that were already right', () => {
  it('calls a partial area forming', async () => {
    expect((await coverage('partial', { confirmed: 1 })).state).toBe('forming')
  })

  it('calls an empty area missing', async () => {
    expect((await coverage('missing')).state).toBe('missing')
  })

  it('calls an area with candidates thin rather than missing', async () => {
    // Something is waiting to be reviewed. "Missing" would send a person to
    // write what is already sitting in the review queue.
    const topic = await coverage('missing', { proposed: 2 })

    expect(topic.state).toBe('thin')
    expect(topic.detail).toContain('2 awaiting review')
  })

  it('keeps the counts beside the state', async () => {
    // A state alone colours a row; the counts are what a person acts on.
    expect((await coverage('partial', { confirmed: 1 })).detail).toBe('1 of 2 confirmed')
  })
})
