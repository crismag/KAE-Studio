/**
 * The words KAE-Memory can send, transcribed once so two guards can share them.
 *
 * The sets are literal because Studio's CI has no KAE-Memory checkout — the same
 * reason `vocabulary_drift.py` is run deliberately rather than by either
 * pipeline. Each names where it comes from, so a fourth word cannot be typed
 * anywhere without somebody going and looking.
 *
 * They live outside the test file that first held them because a second test
 * file needs them, and importing a `.test.ts` would re-run its suites inside the
 * importer (`D-125`).
 */

/** `KnowledgeKind`, `domain/models.py:112` — what `_require_kind` allows. */
export const KNOWLEDGE_KINDS = [
  'actor',
  'goal',
  'rule',
  'constraint',
  'requirement',
  'decision',
  'unknown',
  'assumption',
]

/**
 * `LifecycleState`, `domain/lifecycle.py:8` — where a *knowledge item* is.
 *
 * Not the enum below. Two vocabularies are called `lifecycle`, they are
 * rendered thirty-eight lines apart in `AttentionRoom.tsx`, and they share one
 * member and one near-homograph (`D-197`).
 */
export const LIFECYCLE_STATES = ['proposed', 'validated', 'rejected', 'superseded']

/** `SynthesizedLifecycle`, `domain/synthesis.py:64` — where an *object* is. */
export const SYNTHESIZED_LIFECYCLES = [
  'working',
  'proposed_change',
  'authoritative',
  'superseded',
  'resolved',
]

/** `Authority`, `domain/synthesis.py:79`. Two members, and only two. */
export const AUTHORITIES = ['working_model', 'human']

/**
 * The lifecycles an object may be at when a person holds it (`D-206`).
 *
 * `SynthesizedObject.__post_init__` (`domain/synthesis.py:212-224`) raises on
 * `human` authority at any other lifecycle, so the pair cannot drift apart in a
 * real object and must not drift apart in a fixture either.
 */
export const LIFECYCLES_A_PERSON_MAY_HOLD = ['authoritative', 'superseded', 'resolved']

/** `AttentionKind`, `domain/synthesis.py:86`. */
export const ATTENTION_KINDS = [
  'decision',
  'conflict',
  'correction',
  'assumption',
  'unknown',
  'material_change',
]

/** `AttentionStatus`, `domain/synthesis.py:97`. */
export const ATTENTION_STATUSES = ['open', 'deferred', 'resolved', 'dismissed']

/** `EvidenceBindingKind`, `domain/synthesis.py:55`. */
export const BINDING_KINDS = ['supports', 'contradicts', 'superseded_by', 'resolved_by']
