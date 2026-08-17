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

import type { AttentionItem, ProjectProjection } from '@/domain/types'

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
   * Those same requirements keyed by the status each is in (`D-201`).
   *
   * The two fields above are the two largest parts and they are not all of
   * them: `rejected` and `superseded` reach the projection (`D-34`) and a
   * fixture can hold `contested`, so *"120 requirements · 5 confirmed · 100
   * awaiting review"* left fifteen rows in neither part, above a tab strip
   * showing exactly those fifteen. Keyed rather than named one field at a time
   * so a status nobody anticipated is counted somewhere instead of nowhere.
   */
  requirementsByStatus: Record<string, number>
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
  const requirementsByStatus: Record<string, number> = {}
  for (const item of requirements) {
    requirementsByStatus[item.status] = (requirementsByStatus[item.status] ?? 0) + 1
  }

  return {
    awaitingDecision: proposed.length,
    criticalAwaitingDecision: proposed.filter((item) => item.severity === 'critical').length,
    reviewFindings: review.length,
    criticalReviewFindings: review.filter((item) => item.severity === 'critical').length,
    openDecisions: projection.openDecisions.filter((decision) => !decision.deferred).length,
    unresolvedContradictions: projection.contradictions.count,
    requirements: requirements.length,
    confirmedRequirements: requirementsByStatus.confirmed ?? 0,
    requirementsAwaitingReview: requirementsByStatus.proposed ?? 0,
    requirementsByStatus,
    openQuestions: questions.length,
    statements: statements.length,
  }
}

/**
 * The attention queue, counted once (`SYN-4b`, `D-166`).
 *
 * A second function rather than a field on `ProjectCounts`, because the queue is
 * **not on the projection** — it is its own query, and a caller holding no
 * answer yet must be able to tell that from a queue of zero (`D-158`). So this
 * takes the items and every caller decides for itself what to render while it
 * has none.
 *
 * It exists because the Dashboard and the Attention Room were each filtering
 * `status !== 'deferred'` at their own call site. That is one rule with two
 * copies, free to disagree the day a third status means *not waiting* — which is
 * the shape of `D-96`, one layer over.
 */
export interface AttentionCounts {
  /** Items asking for a person now. Postponed ones are **not** among them. */
  waiting: number
  /**
   * Items somebody postponed. Still owed, no longer suggested (`D-142`).
   *
   * Counted rather than dropped: a queue that shrinks only by hiding is the
   * queue `/attention` was opened to replace, so the number stays sayable.
   */
  postponed: number
  /**
   * How many waiting items of each kind, in Memory's own words.
   *
   * Keyed by the raw kind — `material_change`, not *material change* — because
   * this is a count and not a sentence. Whoever renders it makes it readable.
   */
  waitingByKind: Record<string, number>
}

/**
 * The queue split into the two compartments a person sees.
 *
 * Exported beside the counts and built from the same predicate on purpose: the
 * Room needs the **items** to render and the summary above them needs the
 * **numbers**, and a page whose heading and list disagree about what is waiting
 * is the defect this file exists to prevent. One predicate, both answers.
 */
export function partitionAttention(items: AttentionItem[]): {
  waiting: AttentionItem[]
  postponed: AttentionItem[]
} {
  return {
    waiting: items.filter((item) => item.status !== 'deferred'),
    postponed: items.filter((item) => item.status === 'deferred'),
  }
}

export function attentionCounts(items: AttentionItem[]): AttentionCounts {
  const { waiting, postponed } = partitionAttention(items)
  const waitingByKind: Record<string, number> = {}
  for (const item of waiting) waitingByKind[item.kind] = (waitingByKind[item.kind] ?? 0) + 1
  return { waiting: waiting.length, postponed: postponed.length, waitingByKind }
}
