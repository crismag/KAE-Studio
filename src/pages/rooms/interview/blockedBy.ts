/**
 * Open blockers sitting in one area (`D-31`).
 *
 * Its own module because the Coverage panel renders it and tests assert it
 * directly — the same reason `openBlockers` and `sectionsNotRead` sit beside
 * the components that use them.
 */

import { openBlockers } from '@/components/project/openBlockers'
import type { ProjectBlocker } from '@/domain/types'

export function blockedBy(areaKey: string, blockers: ProjectBlocker[]): ProjectBlocker[] {
  // Only open ones: a blocker somebody closed is not a reason an area is stuck,
  // and showing it would make this panel argue with the Dashboard.
  return openBlockers(blockers).filter((blocker) => blocker.areaKey === areaKey)
}
