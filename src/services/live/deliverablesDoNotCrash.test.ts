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

/** The five states `Deliverables.tsx` can render. Anything else throws there. */
const RENDERABLE = new Set(['not_generated', 'generated', 'reviewed', 'published', 'outdated'])

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
      respond({ results: [{ ...RECORDED, state }] })

      const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

      expect(RENDERABLE.has(mapped.state)).toBe(true)
      vi.restoreAllMocks()
    }
  })

  it('does not invent a state for one it has never seen', async () => {
    respond({ results: [{ ...RECORDED, state: 'a_state_added_next_year' }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    // `not_generated` rather than a guess: an unknown state means Studio cannot
    // say what happened, and the least-claiming answer is the honest one.
    expect(mapped.state).toBe('not_generated')
    expect(RENDERABLE.has(mapped.state)).toBe(true)
  })

  it('carries the fields the page reads, under the names it reads them by', async () => {
    respond({ results: [RECORDED] })

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
    respond({ results: [{ ...RECORDED, module: 'MOD-AUTH' }] })

    const [mapped] = await createLiveServices('p1').artifacts.listDeliverables('p1')

    expect(mapped.scope).toBe('module')
    expect(mapped.moduleId).toBe('MOD-AUTH')
  })

  it('treats a stale deliverable as outdated whatever it was recorded as', async () => {
    respond({ results: [{ ...RECORDED, stale: true }] })

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
})
