/**
 * `D-21` — the reason a source list may be short survives the adapter.
 *
 * The page half of this is asserted in `sourcesRoom.test.tsx`, and those tests
 * inject at the port. So they pass with an adapter that drops `unavailable`
 * entirely — which is the failure `RFA-2` was written for, where a conservation
 * check stopped one layer short of a person and a repair looked right for weeks
 * while delivering nothing.
 *
 * This is that layer.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLiveServices } from './liveServices'

const SOURCE = {
  source_id: '00000000-0000-0000-0000-000000000001',
  project_id: 'p1',
  kind: 'github',
  connection_id: 'con_1',
  location: 'kae/ministry-reporting',
  reference: 'main',
  state: 'pinned',
  scope: {
    include_paths: ['docs/'],
    exclude_paths: [],
    max_file_bytes: 200000,
    documentation_only: false,
  },
  snapshot: null,
  last_error: '',
  analysis: { capability: 'analysis', reason: 'not built', state: 'planned', proved_instead: [] },
}

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

afterEach(() => vi.restoreAllMocks())

describe('a listing that could not be read says so, all the way through', () => {
  it('carries the backend`s reason verbatim', async () => {
    const reason = 'Configured sources could not be read from KAE-Memory: connection refused'
    respond({ sources: [], unavailable: reason })

    const listing = await createLiveServices('p1').acquisition.listSources('p1')

    // Verbatim. A reason paraphrased on the way through is one nobody can act
    // on, and the backend wrote this one to be read.
    expect(listing.unavailable).toBe(reason)
  })

  it('reports nothing missing when nothing was missing', async () => {
    respond({ sources: [SOURCE], unavailable: '' })

    const listing = await createLiveServices('p1').acquisition.listSources('p1')

    expect(listing.unavailable).toBe('')
    expect(listing.sources).toHaveLength(1)
  })

  it('treats a backend too old to answer as nothing missing', async () => {
    // Which is what was true then: before the durable record, an empty list
    // could only ever mean "none". Defaulting the other way would put a
    // warning on every project running against an older Studio.
    respond({ sources: [SOURCE] })

    const listing = await createLiveServices('p1').acquisition.listSources('p1')

    expect(listing.unavailable).toBe('')
  })

  it('keeps the sources it did read beside the reason', async () => {
    // A partial answer is the likely one: the process holds sources it
    // configured this session and could not reach the record for the rest.
    // Dropping them because the read failed would lose work that succeeded.
    respond({ sources: [SOURCE], unavailable: 'KAE-Memory returned 503.' })

    const listing = await createLiveServices('p1').acquisition.listSources('p1')

    expect(listing.sources.map((source) => source.location)).toEqual(['kae/ministry-reporting'])
    expect(listing.unavailable).toContain('503')
  })
})
