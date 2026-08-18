/**
 * Memory's deliverable vocabulary is not Studio's, and the cast hid that.
 *
 * `AUD-023`, which the audit classified `I` — unknown — because nobody had run
 * the page against a project that actually held a deliverable. It is a crash.
 *
 * `listDeliverables` was the only adapter method in `liveServices.ts` with no
 * wire mapping: `return items as Deliverable[]`. Memory returns
 * `deliverable_id`, `purpose`, `state: 'recorded' | 'superseded' | 'withdrawn'`.
 * `Deliverables.tsx` reads `STATE_META[deliverable.state]`, keyed on
 * `not_generated | generated | reviewed | published | outdated`, then reads
 * `meta.label`. Every state missed, and the page died in `RouteError`.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createLiveServices } from './liveServices'

const RECORDED = {
  deliverable_id: 'dlv_1',
  purpose: 'Project context package',
  scope: 'project',
  module: null,
  state: 'recorded',
  knowledge_revision: 62,
  content_hash: 'sha256:abc',
  stale: false,
  artifacts: [{ logical_path: 'docs/context/PROJECT_CONTEXT.md' }],
  source_knowledge: ['k1', 'k2'],
  manifest: {},
  recorded_by: 'operator:cris',
  superseded_by: null,
}

/**
 * The states `Deliverables.tsx` can render. Anything else throws there.
 *
 * Seven since `D-274`, which stopped `superseded` and `withdrawn` arriving as
 * `outdated`. Written out rather than imported from the page: this file's job
 * is to state what the surface accepts where a reader can check it against
 * `STATE_META`, and importing the answer would make the two agree by
 * definition rather than by inspection.
 */
const RENDERABLE = new Set([
  'not_generated',
  'generated',
  'reviewed',
  'published',
  'outdated',
  'superseded',
  'withdrawn',
])

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('deliverables arrive in a shape the page can render', () => {
  it('maps every state Memory can return to one Studio renders', async () => {
    // The assertion the crash needed. Driven off Memory's whole vocabulary
    // rather than the one state a fixture happened to carry.
    for (const state of ['recorded', 'superseded', 'withdrawn']) {
      respond({ deliverables: [{ ...RECORDED, state }] })

      const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

      expect(RENDERABLE.has(mapped.state)).toBe(true)
      vi.restoreAllMocks()
    }
  })

  it('does not invent a state for one it has never seen', async () => {
    respond({ deliverables: [{ ...RECORDED, state: 'a_state_added_next_year' }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    // `not_generated` rather than a guess: an unknown state means Studio cannot
    // say what happened, and the least-claiming answer is the honest one.
    expect(mapped.state).toBe('not_generated')
    expect(RENDERABLE.has(mapped.state)).toBe(true)
  })

  it('carries the fields the page reads, under the names it reads them by', async () => {
    respond({ deliverables: [RECORDED] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.id).toBe('dlv_1')
    expect(mapped.name).toBe('Project context package')
    expect(mapped.includes).toEqual(['docs/context/PROJECT_CONTEXT.md'])
    expect(mapped.sourceMemoryRevision).toBe(62)
    // Both sections filter on this. Under the cast it was Memory's raw string,
    // and a mismatch rendered two empty headings with no message.
    expect(mapped.scope).toBe('project')
  })

  it('reads a module scope from the module Memory named', async () => {
    respond({ deliverables: [{ ...RECORDED, module: 'MOD-AUTH' }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.scope).toBe('module')
    expect(mapped.moduleId).toBe('MOD-AUTH')
  })

  it('treats a stale deliverable as outdated whatever it was recorded as', async () => {
    respond({ deliverables: [{ ...RECORDED, stale: true }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    // Knowledge has moved on since it was assembled, which is the one thing a
    // reader must not miss about an output they are about to hand to somebody.
    expect(mapped.state).toBe('outdated')
  })

  it('survives a bare array, which is the other shape the route may take', async () => {
    respond([RECORDED])

    const mapped = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped).toHaveLength(1)
  })

  /**
   * `D-247`. Every test above passed against `{ results: [...] }`, a key
   * KAE-Memory does not send on this route — `DeliverableListResponse` names
   * its list `deliverables`, while `ProviderConnectionListResponse` names its
   * own `results` and this adapter read the commoner one. So it returned `[]`
   * for every project in every deployment, and the fixtures agreed with it.
   *
   * The two envelope names are written out here because Studio's CI has no
   * KAE-Memory checkout and cannot read the contract at test time. A fixture is
   * a claim about a contract; these state the claim where a reader can check it.
   */
  it('reads the envelope key KAE-Memory sends on this route', async () => {
    respond({ deliverables: [RECORDED] })

    const mapped = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped).toHaveLength(1)
    expect(mapped[0].id).toBe('dlv_1')
  })

  /**
   * `D-252`. `assembly_service.py` calls this rule non-negotiable — an assembly
   * may be incomplete, it may never be silent about being incomplete — and
   * `DeliverableService.record` honours it by putting every gap in the manifest
   * it persists. The adapter typed that manifest `Record<string, unknown>` and
   * read nothing out of it, so a package assembled around an open question was
   * drawn exactly like one assembled around none.
   *
   * `RECORDED` above says `manifest: {}`, which is the silence written into a
   * fixture: every test in this file passed while the field was unread.
   */
  it('carries the gaps the manifest says the package is incomplete about', async () => {
    respond({
      deliverables: [
        {
          ...RECORDED,
          manifest: {
            unresolved_critical_gaps: [
              { area_key: 'authority_model', summary: 'Who may approve is undecided.' },
              { area_key: 'retention', summary: 'How long reports are kept is undecided.' },
            ],
          },
        },
      ],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unresolvedGaps).toEqual([
      { areaKey: 'authority_model', summary: 'Who may approve is undecided.' },
      { areaKey: 'retention', summary: 'How long reports are kept is undecided.' },
    ])
  })

  it('reads no gaps from a deliverable recorded before the rule existed', async () => {
    // The control. An absent key is not an empty package and not a crash: it is
    // no gaps as far as anyone can now tell, which is what the manifest of an
    // older row honestly supports.
    respond({ deliverables: [{ ...RECORDED, manifest: {} }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unresolvedGaps).toEqual([])
  })

  /**
   * `D-253`. `RenderService.render` raises `UnreproducibleError` before it
   * produces anything, and KAE-Memory sends the reason it would raise with.
   * `WireDeliverable` named neither field, so every deliverable in Studio was
   * drawn as one that can be re-rendered — including the ones a render call
   * refuses.
   */
  it('carries the reason KAE-Memory would refuse to re-render this package', async () => {
    respond({
      deliverables: [
        {
          ...RECORDED,
          publication_eligible: false,
          ineligibility_reason: 'recorded before render inputs were captured (N20.1)',
        },
      ],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unreproducibleReason).toBe('recorded before render inputs were captured (N20.1)')
  })

  it('says nothing about reproduction for a package Memory would render', async () => {
    respond({
      deliverables: [{ ...RECORDED, publication_eligible: true, ineligibility_reason: null }],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unreproducibleReason).toBe('')
  })

  it('claims no refusal from a deployment too old to send one', async () => {
    // `RECORDED` carries neither field. A missing pair is not a refusal, and
    // inferring one from the boolean's absence would put words in Memory's
    // mouth on every deliverable a older deployment holds.
    respond({ deliverables: [RECORDED] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unreproducibleReason).toBe('')
  })

  /**
   * `D-254`. `ProvisionalContext` exists so a package reproduces the same
   * *claim* and not only the same bytes: one assembled with open questions
   * said something weaker than the same words say after they were answered.
   * Memory sends the structure and its own derived `rested_on_uncertainty`;
   * `WireDeliverable` named neither.
   */
  it('carries what was unsettled when the package was assembled', async () => {
    respond({
      deliverables: [
        {
          ...RECORDED,
          rested_on_uncertainty: true,
          provisional_context: {
            mode: 'provisional',
            confirmed: 12,
            proposed: 3,
            contested: 1,
            assumption_pins: [{ assumption_id: 'a1' }, { assumption_id: 'a2' }],
            question_pins: [{ clarification_id: 'q1' }],
          },
        },
      ],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.assembledUnderUncertainty).toEqual({
      proposed: 3,
      contested: 1,
      openAssumptions: 2,
      openQuestions: 1,
    })
  })

  it('follows Memory when it says a package rested on nothing unsettled', async () => {
    respond({
      deliverables: [
        {
          ...RECORDED,
          rested_on_uncertainty: false,
          provisional_context: {
            mode: 'confirmed',
            confirmed: 12,
            proposed: 0,
            contested: 0,
            assumption_pins: [],
            question_pins: [],
          },
        },
      ],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.assembledUnderUncertainty).toBeUndefined()
  })

  it('claims no settled ground for a package whose uncertainty was never captured', async () => {
    // `RECORDED` carries no `provisional_context`, which Memory documents as a
    // different claim from carrying an empty one: not recorded is not none, and
    // only none would reassure. Neither is rendered, so the absence says
    // nothing rather than saying the comfortable thing.
    respond({ deliverables: [RECORDED] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.assembledUnderUncertainty).toBeUndefined()
  })

  /**
   * `D-255`. `DeliverableQualification` refuses to be constructed without these
   * where the package rests on unconfirmed statements — *"silence here is the
   * package claiming more than its evidence."* Studio dropped them one layer
   * before the reader they were written for.
   */
  it('carries the sentences the package is forbidden to omit about its evidence', async () => {
    respond({
      deliverables: [
        {
          ...RECORDED,
          qualification: {
            maturity: 'provisional',
            unconfirmed_statements: 4,
            qualifications: [
              'This package rests on 4 statements nobody has confirmed.',
              'Two material assumptions were accepted rather than verified.',
            ],
          },
        },
      ],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.qualifications).toEqual([
      'This package rests on 4 statements nobody has confirmed.',
      'Two material assumptions were accepted rather than verified.',
    ])
  })

  it('reads no qualification from a deliverable recorded before there was one', async () => {
    // The column is nullable for exactly this row, so absence is a state rather
    // than a gap, and an empty list claims nothing either way.
    respond({ deliverables: [RECORDED] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.qualifications).toEqual([])
  })

  /**
   * `D-256`. The case `D-254` leaves silent, in the words Memory has for it.
   * Deliberately not `publication_eligible`'s: such a package re-renders byte
   * for byte, and refusing to publish it would withdraw a capability it has.
   */
  it('carries why the uncertainty behind a package cannot be proven', async () => {
    respond({
      deliverables: [
        {
          ...RECORDED,
          reproduces_uncertainty: false,
          uncertainty_gap_reason: 'recorded before provisional context was captured (N20.2)',
        },
      ],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unreproducibleClaimReason).toBe(
      'recorded before provisional context was captured (N20.2)',
    )
    // The other refusal is a different question and this package does not fail it.
    expect(mapped.unreproducibleReason).toBe('')
  })

  it('says nothing about the claim for a package that reproduces its uncertainty', async () => {
    respond({
      deliverables: [{ ...RECORDED, reproduces_uncertainty: true, uncertainty_gap_reason: null }],
    })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unreproducibleClaimReason).toBe('')
  })

  it('claims no uncertainty gap from a deployment too old to send one', async () => {
    respond({ deliverables: [RECORDED] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.unreproducibleClaimReason).toBe('')
  })

  /**
   * `D-274`. `DELIVERABLE_STATE` mapped `superseded` and `withdrawn` both onto
   * `outdated`, which is the collapse `DeliverableService.withdraw` names in
   * its own docstring: it *"would leave a reader unable to tell 'there is a
   * newer one' from 'do not use this'"*. The card then attached the `outdated`
   * sentence — *regenerate to pick up the current revision* — to both, which is
   * a wrong instruction rather than a thin one.
   */
  it('keeps a replaced package and a disowned one apart', async () => {
    respond({
      deliverables: [
        { ...RECORDED, deliverable_id: 'dlv_old', state: 'superseded', superseded_by: 'dlv_new' },
        {
          ...RECORDED,
          deliverable_id: 'dlv_gone',
          state: 'withdrawn',
          manifest: { withdrawn_reason: 'The engagement it was written for was cancelled.' },
        },
      ],
    })

    const [replaced, disowned] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(replaced.state).toBe('superseded')
    expect(replaced.supersededById).toBe('dlv_new')
    expect(disowned.state).toBe('withdrawn')
    expect(disowned.withdrawnReason).toBe('The engagement it was written for was cancelled.')
    // Neither is the state that tells somebody to regenerate.
    expect(replaced.state).not.toBe('outdated')
    expect(disowned.state).not.toBe('outdated')
  })

  it('does not let a moved revision overwrite a decision somebody recorded', async () => {
    // `stale` outranks `recorded` and must not outrank these two: a package the
    // project disowned is not made current by the knowledge standing still, and
    // *replaced* is what a reader needs before *out of date*.
    respond({
      deliverables: [
        { ...RECORDED, state: 'superseded', stale: true },
        { ...RECORDED, state: 'withdrawn', stale: true },
        { ...RECORDED, state: 'recorded', stale: true },
      ],
    })

    const mapped = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.map((d) => d.state)).toEqual(['superseded', 'withdrawn', 'outdated'])
  })

  it('says only that a package was withdrawn when no reason was recorded', async () => {
    // `withdraw` takes the reason from its caller and writes it into the
    // manifest. A withdrawal that recorded none is a state, not a prompt to
    // author one on the reader's behalf.
    respond({ deliverables: [{ ...RECORDED, state: 'withdrawn', manifest: {} }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.state).toBe('withdrawn')
    expect(mapped.withdrawnReason).toBeUndefined()
  })

  it('names no replacement for a package nothing replaced', async () => {
    respond({ deliverables: [RECORDED] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.supersededById).toBeUndefined()
  })

  it('returns nothing, and says nothing, when the envelope is the sibling one', async () => {
    // The failure mode itself rather than a description of it. `results` is
    // KAE-Memory's connection envelope and never its deliverable envelope; an
    // adapter reading it gets an empty list and no error, which on the page is
    // two headings with nothing under them, indistinguishable from a project
    // that holds no deliverables at all.
    respond({ results: [RECORDED] })

    const mapped = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped).toHaveLength(0)
  })
})
