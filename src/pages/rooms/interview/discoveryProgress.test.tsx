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
