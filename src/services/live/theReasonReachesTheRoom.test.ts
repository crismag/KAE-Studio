/**
 * A question says how much it matters *and* why (`D-246`, `D-248`).
 *
 * `D-17` rendered the severity under a *why this matters* label — a grade
 * wearing a reason's label, with the reader supplying the difference. The right
 * fix then was to stop claiming a reason, because KAE-Memory computed none.
 *
 * It computes one now. `D-246` carried `Finding.summary` across five hops to
 * `QuestionCandidateResponse.reason`; this covers the last two, where Studio's
 * adapter dropped it and three accurate comments explained why it could not
 * exist. The severity stays exactly where it is, labelled as a grade, so
 * neither value stands in for the other.
 */

import { describe, expect, it } from 'vitest'
import { toProjection } from './liveServices'

/**
 * KAE-Memory's wording for a finding that offered no summary
 * (`clarification_service.REASON_UNSTATED`). Written out because Studio's CI
 * has no KAE-Memory checkout and cannot import the constant.
 */
const REASON_UNSTATED = 'The finding behind this question gave no reason.'

function backend(question: Record<string, unknown>) {
  return {
    project: { id: 'p1', name: 'Test', phase: 'active', memoryRevision: 3 },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 0, status: 'not_started', areas: [] },
    openQuestions: [question],
    blockers: [],
    contradictions: { count: 0, listable: false, reason: '' },
    preliminary: { warnings: [], materialUnknowns: [] },
    modules: { available: false, gap: { capability: '', reason: '' } },
    unavailable: [],
  } as never
}

const QUESTION = {
  id: 'OD-011',
  question: 'Which role holds approval authority?',
  severity: 'critical',
  disposition: 'open',
  asked: true,
  reason: 'Authorization has no confirmed knowledge.',
}

describe('the reason reaches the room', () => {
  it('carries the sentence KAE-Memory computed', () => {
    const [decision] = toProjection(backend(QUESTION)).openDecisions

    expect(decision.reason).toBe('Authorization has no confirmed knowledge.')
  })

  it('still carries the grade beside it, as a separate value', () => {
    // The control, and the point of `D-17` restated as an assertion: two
    // values, neither derived from the other. A failure here means the fixture
    // stopped reaching the mapper rather than that the reason regressed.
    const [decision] = toProjection(backend(QUESTION)).openDecisions

    expect(decision.severity).toBe('critical')
    expect(decision.reason).not.toBe(decision.severity)
  })

  it("prints the stated absence in KAE-Memory's words rather than its own", () => {
    const [decision] = toProjection(backend({ ...QUESTION, reason: REASON_UNSTATED })).openDecisions

    expect(decision.reason).toBe(REASON_UNSTATED)
  })

  it('invents nothing for a KAE-Memory older than the field', () => {
    // No `reason` at all is not a stated absence, and must not render as one:
    // the row shows what it showed before the field existed.
    const { reason: _dropped, ...withoutReason } = QUESTION
    const [decision] = toProjection(backend(withoutReason)).openDecisions

    expect(decision.reason).toBe('')
    expect(decision.reason).not.toBe(REASON_UNSTATED)
  })
})
