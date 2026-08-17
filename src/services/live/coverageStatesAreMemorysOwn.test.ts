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
 *
 * **It rotted, and both halves of why are the point (`D-213`).** `EPI-5b` added
 * `evidenced` and `interpreted` to the enum and this transcription kept the four
 * words it had; a copy nobody can compile against goes stale silently (`D-125`).
 * That alone would not have hidden it — the assertion driven off this list was
 * `toBeTruthy()`, and a state falling through to `missing` is truthy. **It
 * asserted that something rendered, never that it was right**, which is `D-32`
 * inside the test written to stop `D-32`.
 */
const MEMORY_AREA_STATES = [
  'missing',
  'partial',
  'evidenced',
  'interpreted',
  'sufficient',
  'not_applicable',
] as const

/**
 * `ADR-0008`'s progression, in Memory's order — `readiness.py:40`.
 *
 * `not_applicable` is not on it: it is not a degree of coverage.
 */
const MEMORY_LADDER = ['missing', 'partial', 'evidenced', 'interpreted', 'sufficient'] as const

/** Studio's five words as degrees, so *descending* is a thing that can be said. */
const STUDIO_RANK: Record<string, number> = {
  missing: 0,
  thin: 1,
  forming: 2,
  strong: 3,
}

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
  return respondWith({ health: { percentage: 0, phase: 'discovering', areas } })
}

/** The projection payload, with one section replaced. */
function respondWith(over: Record<string, unknown>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        ...{
          project: { id: 'p1', name: 'Test', phase: 'active', createdAt: '', memoryRevision: 1 },
          confirmed: [],
          proposed: [],
          rejected: [],
          health: { percentage: 0, phase: 'discovering', areas: [] },
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
        },
        ...over,
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

  it('never descends where KAE-Memory climbs', async () => {
    // The guard the `toBeTruthy` one above could never be (`D-213`). Memory's
    // ladder is walked in order and Studio's answer may not go backwards along
    // it — so a rung this build has no arm for is a failure here rather than an
    // area rendering as a worse gap than the tier below it.
    const answers = []
    for (const state of MEMORY_LADDER) {
      answers.push(STUDIO_RANK[(await coverage(state, { confirmed: 1 })).state])
    }

    expect(answers).toEqual([...answers].sort((a, b) => a - b))
  })

  it('does not call a grounded area a gap', async () => {
    // The defect exactly: `evidenced` is better grounded than `partial`
    // (`readiness.py:108`) and rendered below it.
    for (const state of ['evidenced', 'interpreted']) {
      expect(['missing', 'thin']).not.toContain((await coverage(state)).state)
    }
  })

  it('says what grounds a grounded area, rather than counting to zero', async () => {
    // "0 of 2 confirmed" is the sentence `EPI-5b` exists to replace, and these
    // are the areas it was built for.
    const evidenced = await coverage('evidenced')
    const interpreted = await coverage('interpreted')

    expect(evidenced.detail).toContain('Evidence from a source outside KAE')
    expect(evidenced.detail).not.toContain("KAE's reading")
    expect(interpreted.detail).toContain("and KAE's reading of it")
    // The counts stay beside it — a state alone cannot be acted on.
    expect(evidenced.detail).toContain('0 of 2 confirmed')
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

/**
 * `D-29` — blockers survive the mapping they used to die in.
 *
 * Typed `unknown[]` and mapped nowhere, while a critical one already stopped
 * generation. The page half is asserted in `blockersReachAPerson.test.tsx`, and
 * those tests build blockers directly — so they pass with an adapter that drops
 * the field entirely, which is the failure `RFA-2` exists for.
 */
describe('blockers reach the projection', () => {
  const WIRE = {
    id: 'BLK-1',
    project_id: 'p1',
    summary: 'Nobody has confirmed who may approve.',
    severity: 'critical',
    status: 'open',
    area_key: 'approval',
    owner: 'Church leadership',
    resolution_note: null,
  }

  async function blockers(entries: unknown[]) {
    respondWith({ blockers: entries })
    const projection = await createLiveServices('p1').projection.getProjection('p1')
    return projection.blockers
  }

  it('carries what the blocker actually says', async () => {
    const [mapped] = await blockers([WIRE])

    expect(mapped.summary).toBe(WIRE.summary)
    expect(mapped.severity).toBe('critical')
    expect(mapped.owner).toBe('Church leadership')
  })

  it('carries a resolved one with how it was closed', async () => {
    const [mapped] = await blockers([
      { ...WIRE, status: 'resolved', resolution_note: 'Decided at the regional meeting.' },
    ])

    expect(mapped.status).toBe('resolved')
    expect(mapped.resolutionNote).toBe('Decided at the regional meeting.')
  })

  it('leaves a missing severity empty rather than guessing downwards', async () => {
    // A blocker whose grade did not arrive is not a minor one, and guessing is
    // the direction that costs a person the thing they needed to see.
    const [mapped] = await blockers([{ ...WIRE, severity: undefined }])

    expect(mapped.severity).toBe('')
  })

  it('reports no blockers as no blockers', async () => {
    expect(await blockers([])).toEqual([])
  })
})

/**
 * `D-30` — the review survives the mapping that never called it.
 *
 * The panel's own tests build findings directly, so they pass with an adapter
 * that drops the section entirely — `RFA-2`'s lesson, and the reason these sit
 * one layer lower.
 */
describe('the computed review reaches the projection', () => {
  const WIRE = {
    kind: 'open_blocker',
    severity: 'critical',
    summary: 'A blocker is open.',
    recommendedAction: 'Resolve it, or record who owns closing it.',
    areaKey: 'approval',
    subjectKey: 'BLK-01',
  }

  async function review(over: Record<string, unknown>) {
    respondWith({ review: over })
    const projection = await createLiveServices('p1').projection.getProjection('p1')
    return projection.review
  }

  it('carries the finding and its recommended action', async () => {
    const mapped = await review({ available: true, reason: '', findings: [WIRE] })

    expect(mapped.findings[0].summary).toBe(WIRE.summary)
    expect(mapped.findings[0].recommendedAction).toBe(WIRE.recommendedAction)
  })

  it('reads a section the backend could not compute as unavailable', async () => {
    const mapped = await review({
      available: false,
      reason: 'KAE-Memory returned 503.',
      findings: [],
    })

    expect(mapped.available).toBe(false)
    expect(mapped.reason).toContain('503')
  })

  it('treats a backend too old to send one as unavailable, not as clean', async () => {
    // An older Studio never called the route. Defaulting to "available with no
    // findings" would report a clean project on the strength of a call that
    // never happened.
    respondWith({})
    const projection = await createLiveServices('p1').projection.getProjection('p1')

    expect(projection.review.available).toBe(false)
    expect(projection.review.findings).toEqual([])
  })
})

/**
 * `D-33` — what the project is fit for survives the mapping.
 *
 * KAE-Memory computes `draft_eligible` and `implementation_eligible`. Studio's
 * `_health` mapped percentage, status and areas and dropped both.
 */
describe('eligibility reaches the projection', () => {
  async function fit(over: Record<string, unknown>) {
    respondWith({
      health: { percentage: 0, phase: 'discovering', areas: [], ...over },
    })
    const projection = await createLiveServices('p1').projection.getProjection('p1')
    return projection.health
  }

  it('carries both facts', async () => {
    const health = await fit({ draftEligible: true, implementationEligible: true })

    expect(health.draftEligible).toBe(true)
    expect(health.implementationEligible).toBe(true)
  })

  it('keeps them apart', async () => {
    const health = await fit({ draftEligible: true, implementationEligible: false })

    expect(health.draftEligible).toBe(true)
    expect(health.implementationEligible).toBe(false)
  })

  it('reads an absent flag as not eligible', async () => {
    // A Memory too old to send these has told us nothing. Costing somebody a
    // generated package is better than costing them a package they trusted.
    const health = await fit({})

    expect(health.draftEligible).toBe(false)
    expect(health.implementationEligible).toBe(false)
  })
})

/**
 * `D-34` — a superseded statement stops disappearing.
 *
 * `STUDIO_ORCHESTRATION_CONTRACT` requires that Studio *"must not erase the
 * underlying lifecycle"*, and names `rejected/superseded` among six semantics
 * it must preserve. `LifecycleState` has four members; Studio's backend split
 * three ways, and `superseded` — being in the decided set — reached **none** of
 * the collections. It was not mislabelled. It was gone.
 *
 * Driven off Memory's whole lifecycle, so a fifth state cannot arrive and be
 * shown as a candidate somebody has yet to agree with.
 */
describe('every lifecycle state KAE-Memory has survives presentation', () => {
  /** `LifecycleState` in `kae_memory/domain/lifecycle.py`, verbatim. */
  const MEMORY_LIFECYCLE = ['proposed', 'validated', 'rejected', 'superseded'] as const

  function statement(lifecycle: string) {
    return {
      id: `k-${lifecycle}`,
      text: `A statement that is ${lifecycle}.`,
      version: 1,
      kind: 'rule',
      lifecycle,
      updatedAt: '2026-08-12T09:00:00Z',
    }
  }

  async function requirements(over: Record<string, unknown>) {
    respondWith(over)
    const projection = await createLiveServices('p1').projection.getProjection('p1')
    return projection.requirements
  }

  it('carries a superseded statement at all', async () => {
    const mapped = await requirements({ superseded: [statement('superseded')] })

    expect(mapped.map((r) => r.id)).toContain('k-superseded')
  })

  it('calls it superseded rather than proposed', async () => {
    // The harm the old ternary would have done once the backend carried it: a
    // statement the project replaced, offered as one nobody has agreed to yet.
    const mapped = await requirements({ superseded: [statement('superseded')] })

    expect(mapped[0].status).toBe('superseded')
  })

  it.each(MEMORY_LIFECYCLE)('maps %s to a status Studio renders', async (lifecycle) => {
    const key = {
      proposed: 'proposed',
      validated: 'confirmed',
      rejected: 'rejected',
      superseded: 'superseded',
    }[lifecycle]
    const collection = {
      proposed: 'proposed',
      validated: 'confirmed',
      rejected: 'rejected',
      superseded: 'superseded',
    }[lifecycle]
    const mapped = await requirements({ [collection]: [statement(lifecycle)] })

    expect(mapped[0].status).toBe(key)
  })

  it('does not offer a superseded statement for review', async () => {
    // It is decided. A review queue containing it would ask somebody to agree
    // with a sentence the project has already replaced.
    respondWith({ superseded: [statement('superseded')] })
    const projection = await createLiveServices('p1').projection.getProjection('p1')

    expect(projection.findings.map((f) => f.id)).not.toContain('k-superseded')
  })
})

/**
 * `D-37` — the ids a finding is about survive the mapping that dropped them.
 */
describe('a finding carries which statements it is about', () => {
  it('keeps knowledge item ids', async () => {
    respondWith({
      review: {
        available: true,
        reason: '',
        findings: [
          {
            kind: 'unresolved_contradiction',
            severity: 'critical',
            summary: 'Two knowledge items contradict each other.',
            recommendedAction: 'Supersede one item.',
            areaKey: null,
            subjectKey: '',
            knowledgeItemIds: ['k-1', 'k-2'],
          },
        ],
      },
    })
    const projection = await createLiveServices('p1').projection.getProjection('p1')

    expect(projection.review.findings[0].knowledgeItemIds).toEqual(['k-1', 'k-2'])
  })

  it('reads a finding with none as about no statement in particular', async () => {
    respondWith({
      review: {
        available: true,
        reason: '',
        findings: [{ kind: 'missing_area', severity: 'major', summary: 'Empty.' }],
      },
    })
    const projection = await createLiveServices('p1').projection.getProjection('p1')

    expect(projection.review.findings[0].knowledgeItemIds).toEqual([])
  })
})
