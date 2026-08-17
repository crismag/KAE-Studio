import type { ExtractionCoverage } from '@/domain/types'

/**
 * What was lost, in the words for each way of losing it.
 *
 * Two failures, never summed (`AUD-024`, `D-232`). Extraction failing on
 * content and extraction never seeing it call for different responses — retry
 * the first, raise the ingest ceiling or split the document for the second —
 * so one figure covering both would be a number nobody can act on.
 *
 * Empty when nothing was lost, so a caller renders nothing rather than a
 * reassurance. Every surface reporting loss reads this, because the sentence
 * was fixed on one of them once and left wrong on the others.
 */
export function contentLossClauses(coverage: ExtractionCoverage): string[] {
  if (coverage.complete) return []

  const { succeeded, abandoned, notIngested, total } = coverage
  // The true denominator when the backend sends one. The fallback is today's
  // behaviour on a backend that does not, and it undercounts by exactly the
  // sections nobody read — which is why it is the fallback and not the rule.
  const submitted = total ?? abandoned + succeeded
  const clauses: string[] = []

  if (abandoned > 0) {
    clauses.push(`${abandoned} of ${submitted} submissions could not be fully read.`)
  }
  if (notIngested !== null && notIngested > 0) {
    clauses.push(
      `${notIngested} of ${submitted} were never read at all — those documents were cut short before extraction saw them.`,
    )
  }
  // Loss the backend reports without naming. A count of zero here would say
  // nothing was lost, which is the one thing `complete: false` rules out.
  if (clauses.length === 0) {
    clauses.push('Part of what was submitted never became statements, and this backend does not say how much.')
  }
  return clauses
}
