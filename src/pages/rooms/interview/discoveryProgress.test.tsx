/**
 * Clicking an area begins work, rather than offering to.
 *
 * PPA-20. "Discuss this" prefilled the composer: a user had to notice the text
 * had appeared, send it, answer, and the card still read
 * `missing · 0 of 1 confirmed`. Three deliberate acts to start one, and the
 * first two did nothing.
 *
 * The second half matters as much as the first. A focused activity must
 * *continue* from what the area already holds — inviting the interview to begin
 * a subject from nothing, on a project forty messages old, is the version of
 * unhelpful that feels like being unheard.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoverageSection } from './InterviewRoom'
import type { ProjectProjection } from '@/domain/types'

function projection(): ProjectProjection {
  return {
    health: {
      percentage: 10,
      phase: 'discovering',
      coverage: [
        {
          key: 'scope_and_boundaries',
          name: 'Scope and boundaries',
          state: 'thin',
          detail: 'missing · 0 of 1 confirmed',
        },
      ],
    },
    // Present because the panel reads it. The cast below silences the type,
    // so a field this component depends on has to be supplied deliberately —
    // omitting it crashed the panel rather than rendering it without blockers.
    blockers: [],
  } as unknown as ProjectProjection
}

describe('starting work on an area', () => {
  it('sends, rather than filling a box for the user to send', async () => {
    const user = userEvent.setup()
    const onDiscuss = vi.fn()
    render(<CoverageSection projection={projection()} onDiscuss={onDiscuss} />)

    await user.click(screen.getByRole('button', { name: /discuss this/i }))

    expect(onDiscuss).toHaveBeenCalledExactlyOnceWith('Scope and boundaries')
  })

  it('offers nothing on an area that does not apply', () => {
    // The one exclusion with an argument of its own: there is nothing to
    // discuss about an area KAE has been told is out of play, and offering it
    // invites somebody to fill a gap KAE does not think exists.
    const na = projection()
    na.health.coverage[0].state = 'notApplicable'
    render(<CoverageSection projection={na} onDiscuss={() => {}} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

/**
 * `WS-REVISIT` — a finished area keeps its route back.
 *
 * Doc 15 invariant 1: *"Every project/discovery area remains revisit-able
 * regardless of status"*, and invariant 2 names the mechanism: *"`Discuss this`
 * must not disappear as the only route back to a completed topic."* It was the
 * only route, and it disappeared — `strong` sat on the same line as
 * `notApplicable`, sharing an exclusion whose reason does not reach it.
 *
 * Both halves are asserted, because the fix is not "show the button again". A
 * finished area offers a different act, and saying "discuss this" about settled
 * work is the probing that costs trust.
 */
describe('an area that is already strong', () => {
  function strong(): ProjectProjection {
    const p = projection()
    p.health.coverage[0].state = 'strong'
    return p
  }

  it('still leads back into the conversation', async () => {
    const user = userEvent.setup()
    const onDiscuss = vi.fn()
    render(<CoverageSection projection={strong()} onDiscuss={onDiscuss} />)

    await user.click(screen.getByRole('button', { name: /revisit/i }))

    expect(onDiscuss).toHaveBeenCalledExactlyOnceWith('Scope and boundaries')
  })

  it('calls it revisiting rather than discussing', () => {
    render(<CoverageSection projection={strong()} onDiscuss={() => {}} />)

    expect(screen.queryByRole('button', { name: /discuss this/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revisit' })).toBeInTheDocument()
  })
})

/**
 * `D-31` — an area with an open blocker says so.
 *
 * `PLANNING_MODEL.md` specifies seven area states with prescribed behaviour,
 * including `blocked`: *"another decision is required first — dimmed, states
 * the blocker."* KAE-Memory's `AreaState` has four and cannot produce one, so
 * this arrives as a **caveat beside the state** rather than a sixth state.
 *
 * Inventing one here would have made a fourth vocabulary for a concept that
 * already has three — the contract's seven, Memory's four, and Studio's five.
 */
describe('an area that is waiting on a person', () => {
  function withBlockers(blockers: unknown[]): ProjectProjection {
    return { ...projection(), blockers } as unknown as ProjectProjection
  }

  const BLOCKER = {
    id: 'BLK-1',
    summary: 'Nobody has confirmed which officer signs off.',
    severity: 'critical',
    status: 'open',
    areaKey: 'scope_and_boundaries',
    owner: 'Church leadership',
    resolutionNote: null,
  }

  it('names the blocker sitting in that area', () => {
    render(<CoverageSection projection={withBlockers([BLOCKER])} />)

    expect(screen.getByText(/nobody has confirmed which officer signs off/i)).toBeInTheDocument()
  })

  it('leaves an area alone when the blocker belongs to another', () => {
    render(<CoverageSection projection={withBlockers([{ ...BLOCKER, areaKey: 'approval' }])} />)

    expect(screen.queryByText(/nobody has confirmed/i)).not.toBeInTheDocument()
  })

  it('does not report a closed blocker as still blocking', () => {
    // A blocker somebody closed is not a reason an area is stuck, and showing
    // it here would make this panel argue with the Dashboard.
    render(<CoverageSection projection={withBlockers([{ ...BLOCKER, status: 'resolved' }])} />)

    expect(screen.queryByText(/nobody has confirmed/i)).not.toBeInTheDocument()
  })

  it('says nothing when nothing is blocked', () => {
    render(<CoverageSection projection={withBlockers([])} />)

    expect(screen.queryByText(/^Blocked:/)).not.toBeInTheDocument()
  })

  it('does not invent a sixth state to carry it', () => {
    // The caveat sits beside the state. A state Memory cannot produce would be
    // a fourth vocabulary for one concept.
    render(<CoverageSection projection={withBlockers([BLOCKER])} />)

    expect(screen.getByText('thin')).toBeInTheDocument()
    expect(screen.queryByText(/^blocked$/i)).not.toBeInTheDocument()
  })
})
