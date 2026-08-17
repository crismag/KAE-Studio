/**
 * What kind of gap produced a question, in words (`D-190`).
 *
 * Memory keys the kind rather than phrasing it — `finding_kind` is a value, not
 * a sentence, and `D-158` settled that whoever renders one makes it readable.
 * Only four kinds can reach a person: `clarification_service.py`'s `_ASKABLE`
 * allowlist restricts questions to findings describing something somebody can
 * answer, so the other five members of Memory's `FindingKind` never arrive
 * here.
 *
 * **Indexed, never defaulted.** A kind absent from this table renders no label
 * at all. A fallback word would be `D-28` again — something renders, and it is
 * wrong rather than missing — and this label sits beside a question a person is
 * about to act on.
 */
const READABLE: Record<string, string> = {
  missing_area: 'Nothing recorded here yet',
  partial_area: 'This area is partly covered',
  open_question: 'Raised in the conversation',
  open_blocker: 'A blocker somebody raised',
}

/** The four kinds a question can carry. Memory's `_ASKABLE`, named here so a
 *  fixture cannot quietly teach a fifth. */
export const ASKABLE_FINDING_KINDS = Object.keys(READABLE)

export function readableFindingKind(kind: string): string | null {
  return READABLE[kind] ?? null
}
