/**
 * Nothing the backend says it cannot do may be lost on the way to a screen.
 *
 * ## The defect this pins
 *
 * `AUD-002`. Studio's backend distinguishes *"your project has none"* from
 * *"KAE cannot derive this"* with real care — `projection.py` returns
 * `unavailable: [{section, reason}]`, `definition.py` states a reason for each
 * section it leaves empty, and `modules` arrives as `{available, gap}`. The
 * live adapter folded every one of those reasons into a prose string in
 * `health.recommendedNext`, which no component read. So each gap the backend
 * took care to report arrived at the user as a blank panel.
 *
 * The adapter's own header states the rule it was breaking:
 *
 * > *"Where KAE-Memory has no capability, this surfaces the gap rather than
 * > returning a plausible empty value. A `modules: []` would render 'no modules
 * > yet' about a question that was never asked."*
 *
 * ## Why a conservation check rather than a rendering test
 *
 * A rendering test asserts that one known section shows one known sentence. It
 * passes forever while a *new* section, added to the backend later, is silently
 * dropped — which is exactly how this happened: the fields existed, were
 * populated, and had no reader.
 *
 * So this asserts the property instead: **every reason that arrives is still
 * addressable afterwards.** It fails for a section nobody has thought of yet,
 * which is the only kind of failure worth automating here.
 *
 * Same shape as `test_no_field_left_behind.py` in KAE-Memory and
 * `test_every_generator_is_reachable.py` in KAE-Artifacts — the two checks in
 * this estate that have already caught *built and unreachable*.
 */

import { describe, expect, it } from 'vitest'

import { toProjection } from './liveServices'
import { unavailableReason } from '@/components/project/unavailableReason'

/**
 * The mapper is tested directly rather than through `fetch`.
 *
 * `toProjection` is the whole of the defect: the payload arrives complete and
 * the mapping is where the reasons were lost. Stubbing the network would test
 * the same function through two layers that were never in question.
 */
function payload(over: Record<string, unknown> = {}) {
  return {
    project: { id: 'p1', name: 'Audit', phase: 'discovery', memoryRevision: 3, createdAt: '' },
    confirmed: [],
    proposed: [],
    rejected: [],
    health: { percentage: 12, advisory: true, status: 'discovering', areas: [] },
    openQuestions: [],
    blockers: [],
    contradictions: { count: 2, listable: false, reason: 'Memory does not enumerate these.' },
    preliminary: { warnings: ['a warning that is not a capability gap'], materialUnknowns: [] },
    modules: {
      available: false,
      gap: { capability: 'modules', reason: 'Studio curation is a separate contract (N12).' },
    },
    unavailable: [
      { section: 'value', reason: 'The area covers problem and value together.' },
      { section: 'workflows', reason: 'Memory holds statements, not sequences.' },
      {
        section: 'a_section_nobody_has_written_a_component_for',
        reason: 'Invented for this test.',
      },
    ],
    ...over,
  }
}

describe('capability gaps reach the user', () => {
  it('every unavailable section the backend sends is still addressable', () => {
    const raw = payload()

    const projection = toProjection(raw as never)

    const lost = raw.unavailable
      .map((u) => u.section)
      .filter((section) => !unavailableReason(projection.unavailable, section))

    expect(lost).toEqual([])
  })

  it('carries the reason itself, not a summary of it', () => {
    const projection = toProjection(payload() as never)

    // Verbatim. A reason paraphrased on the way through is one a surface cannot
    // quote, and the backend wrote these to be read by a person.
    expect(unavailableReason(projection.unavailable, 'value')).toBe(
      'The area covers problem and value together.',
    )
  })

  it('reports the modules gap as a gap, not as an empty list', () => {
    const projection = toProjection(payload() as never)

    expect(projection.modules).toEqual([])
    // The distinction the finding is about: an empty array *plus a gap* is "we
    // cannot tell you"; an empty array alone is "you have none".
    expect(projection.modulesGap).not.toBeNull()
    expect(projection.modulesGap?.reason).toContain('separate contract')
  })

  it('leaves modulesGap null when modules are genuinely derivable', () => {
    const projection = toProjection(
      payload({ modules: { available: true, gap: { capability: '', reason: '' } } }) as never,
    )

    // Then an empty `modules` is a fact about the project, and a surface should
    // say "none yet" rather than "cannot be derived".
    expect(projection.modulesGap).toBeNull()
  })

  it('does not smuggle capability gaps back into the advisory list', () => {
    const projection = toProjection(payload() as never)

    // `recommendedNext` is advisory prose, and gaps were flattened into it and
    // lost. If they reappear here someone has restored the old path beside the
    // new one, and two sources of the same fact will drift.
    expect(projection.health.recommendedNext).toEqual(['a warning that is not a capability gap'])
  })
})
