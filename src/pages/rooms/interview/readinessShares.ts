import type { CoverageTopic } from '@/domain/types'

/**
 * How much of readiness each area accounts for, or nothing at all.
 *
 * Readiness is a **weighted** mean (`readiness_service.score_areas`), so a list
 * of states treats as equal what the score does not — covering *Functional
 * requirements* moves it twice as far as covering *Users and stakeholders*
 * (`D-195`). This is the only decision a weight participates in: which gap is
 * worth closing next.
 *
 * The denominator is the applicable areas, exactly as `score_areas` excludes
 * the ones that do not apply — a share over a different total would be the
 * defect this fixes, one layer down.
 *
 * Returns `null`, meaning *say nothing*, in the two cases where a share would
 * mislead: any applicable area whose weight KAE-Memory did not send, since a
 * share of an incomplete total is a made-up number; and areas that all weigh
 * the same, where every share is `1/n` and asserts nothing the list beside it
 * does not already say.
 */
export function readinessShares(topics: readonly CoverageTopic[]): Map<string, number> | null {
  const applicable = topics.filter((topic) => topic.state !== 'notApplicable')
  if (applicable.length === 0) return null
  const weights = applicable.map((topic) => topic.weight)
  if (weights.some((weight) => weight === null)) return null
  const known = weights as number[]
  if (known.every((weight) => weight === known[0])) return null
  const total = known.reduce((sum, weight) => sum + weight, 0)
  return new Map(applicable.map((topic, index) => [topic.key, (100 * known[index]) / total]))
}
