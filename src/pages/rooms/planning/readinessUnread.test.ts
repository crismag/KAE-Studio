/**
 * `D-236` — the lookup that decides whether `FitFor` may answer at all.
 */

import { describe, expect, it } from 'vitest'

import { readinessUnread } from './readinessUnread'

describe('readinessUnread', () => {
  it('is null when nothing failed', () => {
    expect(readinessUnread([])).toBeNull()
  })

  it('is null on a backend too old to send the list', () => {
    expect(readinessUnread(undefined)).toBeNull()
  })

  it("returns the backend's own reason", () => {
    expect(readinessUnread([{ section: 'readiness', reason: 'timed out' }])).toBe('timed out')
  })

  it('names a failure even when the reason is blank', () => {
    // A blank reason still has to read as a failure. Returning it unchanged
    // would render the arm with no sentence in it.
    expect(readinessUnread([{ section: 'readiness', reason: '  ' }])).toBe('No reason was given.')
  })

  it('ignores other failed sections', () => {
    expect(readinessUnread([{ section: 'blockers', reason: 'timed out' }])).toBeNull()
  })
})
