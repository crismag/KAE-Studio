/**
 * What a run's error code means, in words a person can act on.
 *
 * `VC-10/E`. Memory records a typed `error_code` on every failed run —
 * `provider_timeout`, `unverifiable_output`, `output_truncated` — and Studio
 * rendered none of them, so a failed ingestion showed either nothing at all or
 * a raw identifier. *"unverifiable_output"* tells a person that something is
 * wrong and nothing about whether it is their fault, whether retrying helps, or
 * what they might change.
 *
 * ## Each entry says three things
 *
 * **What happened**, in the product's terms rather than the model's. **Whose
 * problem it is** — because "the provider was busy" and "your document has a
 * table KAE could not read" call for opposite responses. And **whether retrying
 * is worth it**, which is the first question and the one a code cannot answer.
 *
 * ## Why a map rather than sentences from the backend
 *
 * Memory's message is the *technical* detail and it is carried verbatim
 * alongside this — a summarised error is one a person cannot search for. What
 * this adds is the reading, which is a product decision about how alarmed to
 * be, and belongs on the surface that knows what the person was trying to do.
 */

export interface RunFailure {
  /** One sentence, in the product's terms. */
  meaning: string
  /** Whether trying again is likely to help. */
  retry: 'worth-retrying' | 'will-recur' | 'needs-a-change'
  /** What to do, when there is something. */
  next?: string
}

export const RUN_FAILURES: Record<string, RunFailure> = {
  provider_unavailable: {
    meaning: 'The language model could not be reached.',
    retry: 'worth-retrying',
    next: 'Nothing was lost. The document is stored and can be read again.',
  },
  provider_timeout: {
    meaning: 'The language model did not answer in time.',
    retry: 'worth-retrying',
    next: 'Long documents are more likely to time out. A shorter section usually succeeds.',
  },
  provider_refused: {
    meaning: 'The language model declined to process this content.',
    retry: 'will-recur',
    next: 'Retrying sends the same text and gets the same answer.',
  },
  output_truncated: {
    meaning: 'The model’s answer was cut off before it finished.',
    retry: 'worth-retrying',
    next: 'Part of this section may not have been read. Splitting it usually helps.',
  },
  invalid_output: {
    meaning: 'The model’s answer did not have the shape KAE requires.',
    retry: 'worth-retrying',
  },
  unverifiable_output: {
    meaning:
      'The model quoted text that is not in the source, so nothing from this section was recorded.',
    retry: 'worth-retrying',
    // The rule this enforces is worth stating, because a person reading
    // "nothing was recorded" will otherwise think KAE simply failed.
    next: 'Every statement KAE records has to be traceable to words you actually wrote. A quote it cannot find is discarded rather than kept.',
  },
  extraction_failed: {
    meaning: 'Reading this section did not complete.',
    retry: 'worth-retrying',
  },
  missing_run_input: {
    meaning: 'The work was queued without anything to read.',
    retry: 'will-recur',
    next: 'This is a defect rather than something you did. Worth reporting.',
  },
  role_not_implemented: {
    meaning: 'This deployment cannot perform that kind of work.',
    retry: 'will-recur',
  },
  review_failed: {
    meaning: 'Classifying the project’s statements into areas did not complete.',
    retry: 'worth-retrying',
    next: 'Readiness stays where it was. Nothing was misfiled.',
  },
  invalid_review_output: {
    meaning: 'The classifier’s answer did not have the shape KAE requires.',
    retry: 'worth-retrying',
  },
  unverifiable_review: {
    meaning: 'The classifier referred to statements that do not exist in this project.',
    retry: 'worth-retrying',
  },
  embedding_failed: {
    meaning: 'This statement could not be indexed for search.',
    retry: 'worth-retrying',
    next: 'It is still recorded, and still readable. Only similarity search is affected.',
  },
  embedding_provider_unavailable: {
    meaning: 'The indexing service could not be reached.',
    retry: 'worth-retrying',
  },
  embedding_timeout: {
    meaning: 'The indexing service did not answer in time.',
    retry: 'worth-retrying',
  },
  invalid_embedding: {
    meaning: 'The indexing service returned something unusable.',
    retry: 'worth-retrying',
  },
}

/**
 * The reading for a code, or an honest absence.
 *
 * **Returns `null` for an unknown code rather than inventing a sentence.** A new
 * error code from a newer Memory must render as the code itself plus whatever
 * message came with it — which is less useful and still true. A default like
 * *"Something went wrong"* would be worse than the raw identifier, because it
 * throws away the one piece of information the identifier carries.
 */
export function readFailure(errorCode: string | null | undefined): RunFailure | null {
  if (!errorCode) return null
  return RUN_FAILURES[errorCode] ?? null
}

/** Run roles, in the words the product uses for them. */
export const RUN_ROLE: Record<string, string> = {
  requirements: 'Reading what you said',
  discovery: 'Reading a document',
  review: 'Classifying statements into areas',
  architecture: 'Deriving decisions',
}

export function readRole(role: string): string {
  return RUN_ROLE[role] ?? role
}
