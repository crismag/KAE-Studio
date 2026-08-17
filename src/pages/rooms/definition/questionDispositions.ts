/**
 * What happened to a question, in words (`D-199`).
 *
 * KAE-Memory keys the disposition rather than phrasing it, and the panel was
 * rendering the key: *"Asked · assumed_for_generation"* beside the question it
 * describes. Same rule as `findingKinds.ts` — whoever renders a KAE-Memory
 * value makes it readable.
 *
 * **Only the unsettled ones can arrive.** `ClarificationService.candidates`
 * drops everything `settles()` accepts before this panel's service sees it, and
 * `suggested` is a member of `Disposition` that nothing writes. `open` is
 * handled by the caller, which has a different sentence for it: nobody was
 * asked at all.
 *
 * **Indexed, never defaulted.** A word absent from this table renders `Asked`
 * on its own. A fallback phrase would be `D-28` again — something renders, and
 * it is wrong rather than missing — next to a question somebody is deciding
 * whether to act on.
 */
const READABLE: Record<string, string> = {
  deferred: 'set aside for now',
  unknown_by_user: 'nobody knows yet',
  // Two sentences rather than one for the two KAE-chose dispositions: both
  // require an assumption to exist, and only one of them records that a person
  // handed the choice over.
  delegated: 'left to KAE to choose',
  assumed_for_generation: 'KAE assumed an answer',
}

export function readableDisposition(disposition: string): string | null {
  return READABLE[disposition] ?? null
}
