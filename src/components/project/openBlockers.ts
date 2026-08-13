/**
 * Blockers still standing (`D-29`).
 *
 * Its own module because the panel renders it and a test asserts it directly —
 * the same reason `sectionsNotRead` sits beside `SectionsNotRead`.
 */

import type { ProjectBlocker } from '@/domain/types'

export function openBlockers(blockers: ProjectBlocker[]): ProjectBlocker[] {
  // `!== 'resolved'` rather than `=== 'open'`: a status this build has not
  // heard of is still something nobody has closed, and treating an unknown word
  // as resolved would hide the blocker that introduced it.
  return blockers.filter((blocker) => blocker.status !== 'resolved')
}
