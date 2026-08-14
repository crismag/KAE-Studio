/**
 * One counting rule, so the same number cannot differ between two pages
 * (`NAV-01` slice N2, `D-96`).
 *
 * ## What the live sweep found
 *
 * `/requirements` showed tabs reading **All 180 · Confirmed 6 · Proposed 174**
 * directly above the line **"120 requirements · 5 confirmed · 115 awaiting
 * review · 60 open questions"**. Both are defensible alone — the tabs count
 * every statement, the summary counts only the ones that are requirements — and
 * adjacent they read as a bug in the product.
 *
 * `/memory` labelled the same 174 **Findings**, which they are not.
 *
 * ## Three different things, and one word for all of them
 *
 * The projection uses *finding* three ways, and telling them apart at a call
 * site is one dot of difference:
 *
 * - `projection.findings` — **statements KAE proposed** that nobody has accepted
 *   or refused. 174 of them, 59 graded critical. This is what the sidebar badge
 *   counts and what `/reviews` lists.
 * - `projection.review.findings` — **what a review of the project found**:
 *   *acceptance criteria has no confirmed knowledge*, *problem and value has 0
 *   of 1*. Seven of them, and a different kind of thing entirely.
 * - `projection.requirements` — every **statement**, of which some are
 *   requirements and some are open questions.
 *
 * So each is named here in words that say what it is, once, and no page
 * recomputes any of them. The names are deliberately long. A short name is what
 * let three counts share one word.
 */

import type { ProjectProjection } from '@/domain/types'

export interface ProjectCounts {
  /** Statements KAE proposed that no person has accepted or refused. */
  awaitingDecision: number
  /**
   * Of those, the ones graded critical.
   *
   * What the sidebar badge shows. Never every proposed statement: a badge that
   * cannot be driven to zero is decoration, and *"81 findings"* on a first
   * project reads as *81 things wrong with your idea*.
   */
  criticalAwaitingDecision: number
  /** What a review of the project found — missing areas, partial areas. */
  reviewFindings: number
  /** Of those, the ones a review graded critical. A different set entirely. */
  criticalReviewFindings: number
  /** Decisions a person has to make, not counting the ones they deferred. */
  openDecisions: number
  unresolvedContradictions: number
  /** Statements that are requirements — **open questions excluded**. */
  requirements: number
  confirmedRequirements: number
  requirementsAwaitingReview: number
  /**
   * Things KAE could not determine, counted apart from requirements.
   *
   * Folding them in overstates what the project has established: *"6
   * requirements, 4 awaiting review"* reads differently when two of the six are
   * questions nobody has answered.
   */
  openQuestions: number
  /** Every statement of any category. What a tab strip over all of them totals. */
  statements: number
}

export function projectCounts(projection: ProjectProjection): ProjectCounts {
  const statements = projection.requirements
  const questions = statements.filter((item) => item.category === 'open_question')
  const requirements = statements.filter((item) => item.category !== 'open_question')
  const proposed = projection.findings
  const review = projection.review?.findings ?? []

  return {
    awaitingDecision: proposed.length,
    criticalAwaitingDecision: proposed.filter((item) => item.severity === 'critical').length,
    reviewFindings: review.length,
    criticalReviewFindings: review.filter((item) => item.severity === 'critical').length,
    openDecisions: projection.openDecisions.filter((decision) => !decision.deferred).length,
    unresolvedContradictions: projection.contradictions.count,
    requirements: requirements.length,
    confirmedRequirements: requirements.filter((item) => item.status === 'confirmed').length,
    requirementsAwaitingReview: requirements.filter((item) => item.status === 'proposed').length,
    openQuestions: questions.length,
    statements: statements.length,
  }
}
