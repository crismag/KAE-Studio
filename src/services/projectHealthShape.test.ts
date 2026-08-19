/**
 * `D-191` — every field on `ProjectHealth` has a surface that reads it.
 *
 * `blockingDecisionIds` sat here for the whole of the project's life, filled by
 * both adapters and read by nothing. It could not be filled truthfully either:
 * KAE-Memory's readiness derives `blocked` from critical blockers and mandatory
 * contradictions alone (`readiness_service.py:720`) and models no decision that
 * blocks anything, and `D-29` had already refused the obvious repurposing —
 * blockers are not decisions.
 *
 * The cost was not the dead field. It was the fixture, which supplied two
 * plausible identifiers and so was the only place in the estate asserting that
 * a project *has* blocking decisions — a prototype teaching a concept the
 * product does not hold, which is `D-190` one field along.
 *
 * So this pins the shape rather than the values, and names the reader of each
 * key. A field added to `ProjectHealth` without a surface behind it fails here,
 * and re-adding `blockingDecisionIds` fails it by name.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { health as fixtureHealth } from './mock/fixtures/ministryReporting'
import { createLiveServices } from './live/liveServices'

/**
 * Each key with the surface that reads it, so the pin says *why* the field is
 * allowed to exist rather than only that somebody typed it once.
 */
const READERS: Record<string, string> = {
  phase: 'DashboardPage — the project status strip',
  stage: 'DashboardPage — the journey strip (`D-96`)',
  draftEligible: 'FitFor — is there enough to draft from (`D-33`)',
  implementationEligible: 'FitFor — is this safe to build from (`D-33`)',
  summary: 'DashboardPage — the advisory readiness sentence',
  knowledgeIsStale:
    'ClassificationState — the project moved since the number was measured (`D-278`)',
  coverage: 'CoveragePanel — what each area holds (`D-27`)',
  recommendedNext: 'DashboardPage — the preliminary warnings (AUD-002)',
}

function respond(over: Record<string, unknown> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        ...{
          project: { id: 'p1', name: 'Test', phase: 'active', memoryRevision: 1 },
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

afterEach(() => vi.restoreAllMocks())

describe('ProjectHealth carries only fields a surface reads', () => {
  it('is exactly the pinned shape, live', async () => {
    respond()
    const projection = await createLiveServices('p1').projection.getProjection('p1')

    expect(Object.keys(projection.health).sort()).toEqual(Object.keys(READERS).sort())
  })

  it('is exactly the pinned shape, in the prototype', () => {
    // The two adapters agreeing on the shape is what `portParity` cannot check
    // for a plain object, and the disagreement it missed was this field.
    expect(Object.keys(fixtureHealth).sort()).toEqual(Object.keys(READERS).sort())
  })

  it('holds no field naming a decision that blocks', () => {
    // Named rather than implied: nothing in KAE-Memory produces one, so a key
    // like this can only be filled by invention.
    for (const key of Object.keys(READERS)) {
      expect(key.toLowerCase()).not.toContain('blocking')
    }
  })
})
