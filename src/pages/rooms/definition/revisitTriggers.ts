/**
 * What brings an assumption back, in words (`D-199`, `D-290`).
 *
 * KAE-Memory keys `RevisitTrigger` rather than phrasing it, and the same rule
 * as `questionDispositions.ts` and `findingKinds.ts` applies: whoever renders a
 * KAE-Memory value makes it readable. *"Revisit: on_conflicting_evidence"* is a
 * key beside a guess somebody is deciding whether to trust.
 *
 * **All five members named.** A word that falls through renders nothing, which
 * is the failure the vocabulary-drift scan exists to catch — something drawn
 * and wrong is worse than something absent (`D-28`).
 *
 * **`on_request` is not suppressed as uninteresting.** It is the default and
 * the weakest promise, and that is exactly what a reader should be able to see.
 * Hiding it would render *nothing brings this back on its own* as silence.
 *
 * **Indexed, never defaulted.** An empty string — a backend too old to send the
 * field — renders no line at all, rather than a confident sentence about when a
 * question returns that Memory never made.
 */
const READABLE: Record<string, string> = {
  // Memory's domain refuses this outright on a material assumption, so it can
  // only reach here on a cosmetic or reworkable one — still worth saying,
  // because a guess nothing brings back is a decision made by default.
  never: 'Nothing brings this back',
  on_request: 'Comes back only if somebody asks',
  before_build: 'Comes back before anything is built on it',
  before_production: 'Comes back before this goes to production',
  on_conflicting_evidence: 'Comes back if something contradicts it',
}

export function readableRevisit(revisit: string): string | null {
  return READABLE[revisit] ?? null
}
