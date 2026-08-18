/**
 * Whether the ranking on screen was reasoned before the project last moved.
 *
 * Derivation rather than rendering, and separate from the component for the
 * same reason `nextActionFloor` is: a file exporting both cannot be
 * hot-reloaded.
 *
 * ## What the comparison is
 *
 * Every CIE turn carries `projectionFingerprint` — a digest of the durable
 * records the turn was reasoned from, computed by CIE and carried through the
 * adapter since `D-287`. Two turns with the same one saw the same durable
 * state; two with different ones did not, and the project moved in between.
 *
 * The recommendation panel shows the newest turn that ranked *anything*, which
 * is not always the newest turn: a reply with no `NEXT:` line produces a move
 * whose `next_action` is empty, and the panel keeps showing the previous
 * ranking. When a later turn saw a different durable state, that ranking
 * predates what the project now holds.
 *
 * ## Why it compares turns rather than asking what is current
 *
 * The stronger check is to build a projection now and compare against that; it
 * would also catch knowledge that moved with no turn after it. It costs several
 * KAE-Memory reads on every transcript load, and how many calls a page load may
 * cost is an operating question rather than an engineering one (`D-287`). This
 * comparison costs nothing: both values are already in the browser.
 *
 * ## Absent is not stale
 *
 * A person's message carries no fingerprint, nor does a system message, nor
 * does any turn recorded before this was carried. None of those is a claim that
 * the project moved (`D-38`), so only two turns that both carry one are ever
 * compared.
 */

import type { ConversationMessage } from '@/domain/types'

/**
 * The fingerprint of the newest message carrying one, or nothing.
 *
 * Newest rather than last-of-a-filter, because the transcript is in order and
 * the question is what the most recent turn saw.
 */
function newestFingerprint(messages: ConversationMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const fingerprint = messages[i].projectionFingerprint
    if (fingerprint) return fingerprint
  }
  return undefined
}

/**
 * Whether the newest ranked turn saw an older project than the newest turn did.
 *
 * `false` whenever the question cannot be answered — no ranked turn, either
 * side missing a fingerprint, or the two agreeing. Saying nothing is the right
 * answer to all of those, and a recommendation is guidance either way.
 */
export function rankingPredatesTheProject(messages: ConversationMessage[]): boolean {
  const ranked = [...messages].reverse().find((m) => (m.nextAction ?? []).length > 0)
  const reasonedFrom = ranked?.projectionFingerprint
  if (!reasonedFrom) return false

  const current = newestFingerprint(messages)
  if (!current) return false

  return current !== reasonedFrom
}
