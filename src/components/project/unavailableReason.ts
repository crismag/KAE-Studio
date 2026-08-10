/**
 * Find the reason a named section was not computed, if it was not.
 *
 * Separate from `CapabilityNote` because the two are used at different moments:
 * a page asks this question while deciding *what* to render, and renders the
 * component only if the answer is yes. Keeping them apart also matches how
 * `nextActionFloor` and `stagePrerequisites` sit beside their components.
 *
 * Sections are looked up by key rather than by index because the backend sends
 * only the ones it declined — asking about a section that computed fine gets
 * `undefined`, which is the correct answer and not an error.
 */
export function unavailableReason(
  unavailable: { section: string; reason: string }[] | undefined,
  section: string,
): string | undefined {
  return unavailable?.find((u) => u.section === section)?.reason
}
