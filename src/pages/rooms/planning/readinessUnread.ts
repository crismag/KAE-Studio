/**
 * Whether readiness was read at all, and the backend's reason when it was not.
 *
 * Separate from `FitFor` for the same reason `sectionsNotRead` sits beside
 * `SectionsNotRead`: the question is asked while deciding what to render.
 *
 * A **named** lookup, where the catch-all panel deliberately is not one. That
 * panel renders whatever failed because it cannot know which surfaces claim
 * which sections; this one is composed from exactly one section and knows its
 * name, and a catch-all here would say nothing about the two sentences beside
 * it (`D-236`).
 */

import type { SectionUnavailable } from '@/domain/types'

/** The reason readiness could not be read, or `null` when it was. */
export function readinessUnread(unavailable: SectionUnavailable[] | undefined): string | null {
  const entry = (unavailable ?? []).find((section) => section.section === 'readiness')
  if (entry === undefined) return null
  // Never an empty sentence: the arm exists to say why, and a reason the
  // backend left blank still has to read as a failure rather than as nothing.
  return entry.reason.trim() === '' ? 'No reason was given.' : entry.reason
}
