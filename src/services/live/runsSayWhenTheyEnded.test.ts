/**
 * A run that failed has an end time, and it is not in `completed_at` (`D-249`).
 *
 * KAE-Memory writes the two on disjoint paths: `succeed()` sets `completed_at`
 * and never `failed_at`; `fail()` and `abandon()` set `failed_at` and never
 * `completed_at`. `RunResponse` carries both and says why in its own docstring
 * — *"a client watching a run could see that it failed and not when"*.
 *
 * Studio's `runs:` mapper read nine fields and not that one, so a failed run
 * reached the room with no end at all — which is exactly how the intake row
 * renders a run that is still going.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'

import { createLiveServices } from './liveServices'

const RUN = {
  id: 'run_1',
  role: 'ingestion',
  status: 'failed',
  attempt_number: 1,
  error_code: 'PARSE_FAILED',
  error_message: 'boom',
  started_at: '2026-08-17T10:00:00Z',
  completed_at: null,
  failed_at: '2026-08-17T10:00:12Z',
  output_summary: {},
}

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

async function mapped(run: Record<string, unknown>) {
  respond([run])
  const [record] = await createLiveServices('p1').ingestion.runs('p1')
  return record
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a run carries the end it actually has', () => {
  it('reads the moment a failed run stopped', async () => {
    expect((await mapped(RUN)).failedAt).toBe('2026-08-17T10:00:12Z')
  })

  it('still reads the other one, on a run that succeeded', async () => {
    // The control. Both fields are read; a failure here means the fixture
    // stopped reaching the mapper rather than that `failedAt` regressed.
    const record = await mapped({
      ...RUN,
      status: 'succeeded',
      completed_at: '2026-08-17T10:00:20Z',
      failed_at: null,
    })

    expect(record.completedAt).toBe('2026-08-17T10:00:20Z')
    expect(record.failedAt).toBeNull()
  })

  it('invents no end for a KAE-Memory older than the column', async () => {
    // Absent is not zero (`D-38`). A deployment that never wrote `failed_at`
    // sends no key, and the run renders as it rendered before the field.
    const { failed_at: _dropped, ...withoutIt } = RUN

    expect((await mapped(withoutIt)).failedAt).toBeNull()
  })
})
