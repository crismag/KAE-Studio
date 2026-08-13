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

  it('offers nothing on an area that is already strong', () => {
    // Nothing to continue. An action that reads "discuss this" against settled
    // work invites the probing that costs trust.
    const strong = projection()
    strong.health.coverage[0].state = 'strong'
    render(<CoverageSection projection={strong} onDiscuss={() => {}} />)

    expect(screen.queryByRole('button', { name: /discuss this/i })).not.toBeInTheDocument()
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
