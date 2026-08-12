/**
 * Is readiness 0 because nothing looked, or because the project is thin?
 *
 * Its own module for the reason `unavailableReason` is: a surface asks this
 * while deciding what to render, which is a different moment from rendering.
 */

import type { ClassificationState } from '@/domain/types'

/**
 * Whether readiness is 0 because nothing has looked, rather than because the
 * project is thin.
 *
 * `undefined` — a backend older than the block — is deliberately **not** this
 * state. Claiming "no review has run" on the strength of a missing field would
 * be the same substitution the whole audit is about.
 */
export function neverClassified(classification: ClassificationState | undefined): boolean {
  return classification?.engine === null
}
