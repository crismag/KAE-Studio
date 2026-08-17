/**
 * The prototype may not invent a word KAE-Memory cannot send.
 *
 * `D-196`, and the third time this defect has been found in one file: `D-166`
 * removed `material_unknown` from the attention items and `D-190` removed
 * `missing_decision` from the unknowns. The synthesized model carried three at
 * once — `unknown_theme`, `proposed` and `synthesized` — and none of them can
 * reach a real deployment.
 *
 * Nothing branches on these words, which is exactly why they survived: the
 * cards render whatever arrives, so the demo taught a vocabulary the product
 * does not speak and the words it does speak were rendered by nobody.
 *
 * The sets are literal because Studio's CI has no KAE-Memory checkout — the
 * same reason `vocabulary_drift.py` is run deliberately rather than by either
 * pipeline. Each names where it comes from, so a fourth word cannot be typed
 * into the fixture without somebody going and looking.
 */

import { describe, expect, it } from 'vitest'
import * as fixture from '@/services/mock/fixtures/ministryReporting'

/** `KnowledgeKind`, `domain/models.py:112` — what `_require_kind` allows. */
const KNOWLEDGE_KINDS = [
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
const LIFECYCLE_STATES = ['proposed', 'validated', 'rejected', 'superseded']

/** `SynthesizedLifecycle`, `domain/synthesis.py:64` — where an *object* is. */
const SYNTHESIZED_LIFECYCLES = [
  'working',
  'proposed_change',
  'authoritative',
  'superseded',
  'resolved',
]

/** `Authority`, `domain/synthesis.py:79`. Two members, and only two. */
const AUTHORITIES = ['working_model', 'human']

/** `AttentionKind`, `domain/synthesis.py:86`. */
const ATTENTION_KINDS = [
  'decision',
  'conflict',
  'correction',
  'assumption',
  'unknown',
  'material_change',
]

/** `AttentionStatus`, `domain/synthesis.py:97`. */
const ATTENTION_STATUSES = ['open', 'deferred', 'resolved', 'dismissed']

/** `EvidenceBindingKind`, `domain/synthesis.py:55`. */
const BINDING_KINDS = ['supports', 'contradicts', 'superseded_by', 'resolved_by']

describe('the synthesized model fixture speaks Memory’s vocabulary', () => {
  it('carries objects at all, so the assertions below are not vacuous', () => {
    expect(fixture.synthesizedModel.length).toBeGreaterThan(0)
  })

  it('names a domain that is a knowledge kind', () => {
    // `_require_kind` raises `DomainInvariantError` on anything else, so a
    // value outside this set could not have been written by any run.
    for (const object of fixture.synthesizedModel) {
      expect(KNOWLEDGE_KINDS).toContain(object.domain)
    }
  })

  it('names a lifecycle Memory holds', () => {
    for (const object of fixture.synthesizedModel) {
      expect(SYNTHESIZED_LIFECYCLES).toContain(object.lifecycle)
    }
  })

  it('names an authority Memory holds', () => {
    for (const object of fixture.synthesizedModel) {
      expect(AUTHORITIES).toContain(object.authority)
    }
  })

  it('does not claim a person settled an object without saying who', () => {
    // `authoritative` requires `human` authority by invariant
    // (`domain/synthesis.py:212-224`), so the pair cannot drift apart in a real
    // object and must not drift apart here either.
    for (const object of fixture.synthesizedModel) {
      if (object.lifecycle === 'authoritative') expect(object.authority).toBe('human')
      if (object.authority === 'human') {
        expect(['authoritative', 'superseded', 'resolved']).toContain(object.lifecycle)
      }
    }
  })

  it('binds evidence with a kind Memory holds', () => {
    const bindings = Object.values(fixture.synthesizedEvidence).flat()
    expect(bindings.length).toBeGreaterThan(0)
    for (const binding of bindings) expect(BINDING_KINDS).toContain(binding.kind)
  })

  it('describes each bound observation in words Memory holds', () => {
    // The rows hang off `SynthesizedObjectDetail`, reached by a different query
    // from the objects above, which is why the guard written first walked past
    // them. A vocabulary check that enumerates types rather than fields that
    // reach a screen keeps missing whichever type nobody was looking at.
    const bindings = Object.values(fixture.synthesizedEvidence).flat()
    for (const binding of bindings) {
      expect(KNOWLEDGE_KINDS).toContain(binding.knowledgeKind)
      expect(LIFECYCLE_STATES).toContain(binding.lifecycle)
    }
  })

  it('keeps the two lifecycles apart, since one field name carries both', () => {
    // `superseded` is in both and `proposed` is one underscore from
    // `proposed_change`, so a value from the wrong enum reads as plausible on
    // either row. Asserting the sets are not interchangeable is what makes the
    // two guards above mean different things.
    expect(LIFECYCLE_STATES).not.toEqual(SYNTHESIZED_LIFECYCLES)
    expect(SYNTHESIZED_LIFECYCLES).not.toContain('validated')
    expect(LIFECYCLE_STATES).not.toContain('working')
  })
})

describe('the attention fixture speaks Memory’s vocabulary', () => {
  it('names a kind and a status Memory holds', () => {
    expect(fixture.attentionItems.length).toBeGreaterThan(0)
    for (const item of fixture.attentionItems) {
      expect(ATTENTION_KINDS).toContain(item.kind)
      expect(ATTENTION_STATUSES).toContain(item.status)
    }
  })
})
