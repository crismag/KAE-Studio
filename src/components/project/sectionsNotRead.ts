/**
 * Which reported gaps belong to the catch-all, and which a surface claims.
 *
 * Separate from `SectionsNotRead` for the same reason `unavailableReason` is
 * separate from `CapabilityNote`: a page asks this question while deciding what
 * to render, and `CoverageSection` asks it without rendering the panel at all.
 */

import type { SectionUnavailable } from '@/domain/types'

/**
 * Sections rendered inline, beside the answer they would have been.
 *
 * Only `definition.*`, and by prefix rather than by list: `definition.py`
 * derives them from `_UNCOMPUTABLE`, so enumerating them here would be a second
 * copy of a list that already moves.
 */
export function isRenderedInline(section: string): boolean {
  return section.startsWith('definition.')
}

/** Every reported gap no other surface will state. */
export function sectionsNotRead(
  unavailable: SectionUnavailable[] | undefined,
): SectionUnavailable[] {
  return (unavailable ?? []).filter((entry) => !isRenderedInline(entry.section))
}
