/**
 * Pressing classify has two outcomes and one status code (`D-275`).
 *
 * `POST /api/projects/{id}/classify` enqueues a review run, or refuses because
 * the classification already covers what the project holds and the reviewer
 * that produced it is still the configured one (`D-271`). The refusal is not an
 * error — it exists so that pressing twice does not buy a second model pass
 * over every statement — so it is answered 200, with `{"status":
 * "already_current"}` and no run.
 *
 * The adapter discarded the body, so the two arrived at the surface identical,
 * and the surface described both as a worker starting.
 *
 * **Discriminated on `run_id`, not on the refusal word.** `EnqueueReviewResponse`
 * carries no status field, so a client testing for the absence of
 * `already_current` would read any future body — including an empty one — as a
 * queued run.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createLiveServices } from './liveServices'

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

async function classify(body: unknown) {
  respond(body)
  return createLiveServices('p1').projection.classify('p1')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('what the press did', () => {
  it('reports a run that was enqueued', async () => {
    // The control: Memory's `EnqueueReviewResponse`, which is what the
    // backend passes through on every path that did enqueue something.
    expect(
      await classify({ run_id: 'run_9', outstanding_extraction_runs: 0, warnings: [] }),
    ).toEqual({ queued: true })
  })

  it('reports that a refused press queued nothing', async () => {
    expect(
      await classify({
        status: 'already_current',
        engine: 'reviewed_by_model',
        knowledge_revision: 12,
      }),
    ).toEqual({ queued: false })
  })

  it('does not read a body with no run in it as a queued run', async () => {
    // The reason the discriminator is `run_id` rather than the refusal word. A
    // body that names neither is not evidence that a worker is running.
    expect(await classify({})).toEqual({ queued: false })
    expect(await classify({ run_id: '' })).toEqual({ queued: false })
  })
})
