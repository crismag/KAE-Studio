/**
 * One count, one meaning, wherever it is read (`NAV-01` N2, `D-96`).
 *
 * The live sweep found `/requirements` showing tabs reading **All 180 ·
 * Confirmed 6 · Proposed 174** directly above **"120 requirements · 5 confirmed
 * · 115 awaiting review · 60 open questions"**, and `/memory` labelling the same
 * 174 statements **Findings**. Nothing was lying. Three pages each counted the
 * same payload their own way, and the projection uses the word *finding* for
 * three unrelated things.
 *
 * These assert the distinctions survive, because the way this defect returns is
 * somebody reaching for the shorter name.
 */

import { describe, expect, it } from 'vitest'

import { attentionCounts, partitionAttention, projectCounts } from './counts'
import type { AttentionItem, ProjectProjection } from '@/domain/types'

function projection(over: Partial<ProjectProjection> = {}): ProjectProjection {
  return {
    findings: [],
    requirements: [],
    openDecisions: [],
    contradictions: { count: 0 },
    review: { available: true, reason: '', findings: [] },
    ...over,
  } as unknown as ProjectProjection
}

const statement = (over: Record<string, unknown>) =>
  ({ category: 'functional', status: 'proposed', ...over }) as never

describe('what the counts mean', () => {
  it('never counts an open question as a requirement', () => {
    /**
     * The distinction the summary line already drew and the tab strip did not.
     * Folding questions in overstates what a project has established: *"6
     * requirements, 4 awaiting review"* reads differently when two of the six
     * are things nobody has answered.
     */
    const counts = projectCounts(
      projection({
        requirements: [
          statement({ category: 'functional', status: 'confirmed' }),
          statement({ category: 'functional', status: 'proposed' }),
          statement({ category: 'open_question', status: 'proposed' }),
        ],
      }),
    )

    expect(counts.requirements).toBe(2)
    expect(counts.openQuestions).toBe(1)
    expect(counts.confirmedRequirements).toBe(1)
    expect(counts.requirementsAwaitingReview).toBe(1)
    // And the total that a tab strip over everything is entitled to show.
    expect(counts.statements).toBe(3)
  })

  it('keeps proposed statements and review findings apart', () => {
    /**
     * The root of the drift. `projection.findings` is *statements KAE proposed*;
     * `projection.review.findings` is *what a review found*. One dot apart at
     * every call site, and 174 versus 7 in the live project.
     */
    const counts = projectCounts(
      projection({
        findings: [
          { severity: 'critical' } as never,
          { severity: 'critical' } as never,
          { severity: 'major' } as never,
        ],
        review: {
          available: true,
          reason: '',
          findings: [{ severity: 'critical' } as never],
        },
      }),
    )

    expect(counts.awaitingDecision).toBe(3)
    expect(counts.criticalAwaitingDecision).toBe(2)
    expect(counts.reviewFindings).toBe(1)
    expect(counts.criticalReviewFindings).toBe(1)
  })

  it('leaves a deferred decision out of what is open', () => {
    // Somebody said "not now". Counting it as open makes the badge unclearable,
    // which is the one property that turns a queue back into decoration.
    const counts = projectCounts(
      projection({
        openDecisions: [{ deferred: false } as never, { deferred: true } as never],
      }),
    )

    expect(counts.openDecisions).toBe(1)
  })

  it('survives a Memory too old to send a review', () => {
    // Absent is not zero-shaped by accident: `review` may be missing entirely,
    // and a crash here would take out every page that shows a count.
    const counts = projectCounts(projection({ review: undefined as never }))

    expect(counts.reviewFindings).toBe(0)
    expect(counts.criticalReviewFindings).toBe(0)
  })
})

describe('what the attention queue counts', () => {
  const item = (over: Partial<AttentionItem> = {}) =>
    ({ id: Math.random().toString(), kind: 'unknown', status: 'open', ...over }) as AttentionItem

  it('keeps what is waiting apart from what somebody postponed', () => {
    // The rule the Dashboard and the Room were each applying at their own call
    // site (`D-166`). Two copies of one predicate is how the same queue comes to
    // be two different numbers on two pages, which is `D-96` exactly.
    const counts = attentionCounts([
      item(),
      item({ status: 'deferred' }),
      item({ status: 'deferred' }),
    ])

    expect(counts.waiting).toBe(1)
    expect(counts.postponed).toBe(2)
  })

  it('counts kinds over what is waiting and not over what was postponed', () => {
    const counts = attentionCounts([
      item({ kind: 'unknown' }),
      item({ kind: 'unknown' }),
      item({ kind: 'conflict' }),
      item({ kind: 'conflict', status: 'deferred' }),
    ])

    expect(counts.waitingByKind).toEqual({ unknown: 2, conflict: 1 })
  })

  it('splits the queue by the same rule it counts it with', () => {
    // The page renders the items and the sentence above them states the number.
    // If those came from two predicates, a heading disagreeing with the list
    // beneath it would be one status away.
    const items = [item(), item({ status: 'deferred' }), item({ status: 'resolved' })]
    const split = partitionAttention(items)
    const counts = attentionCounts(items)

    expect(split.waiting).toHaveLength(counts.waiting)
    expect(split.postponed).toHaveLength(counts.postponed)
  })
})
