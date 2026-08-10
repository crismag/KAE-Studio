/**
 * RFA-1 · A turn changes the project, and the change survives.
 *
 * *The heartbeat.* Its middle beat was missing, and this file is the half of
 * the journey that can be proved without a live stack.
 *
 * ## What the journey asks for
 *
 *     send a message → confirm a candidate → **readiness recalculates** →
 *     a new session sees the same state
 *
 * The third step could not happen. Readiness counts statements per discovery
 * area; a statement reaches an area only when a review run classifies it; and
 * **Studio never asked for one**. `EM-5` found the capability had no caller
 * outside a unit test and exposed it over HTTP and MCP — and the only interface
 * a person uses still did not call it.
 *
 * Measured on the deployed system rather than argued: the acceptance project
 * `Cris Test 2` holds **five successful extraction runs, zero review runs**,
 * and `0% · not_started`. Confirming every statement in it would not have moved
 * the number by one point (`AUD-041`).
 *
 * ## What is asserted here, and what is not
 *
 * A percentage moving is a claim about a worker, a model and a database, so it
 * belongs in `e2e/acceptance/journey.py` against the live stack. What belongs
 * here is the part that made the movement impossible: that the product **asks**,
 * that it says so when nothing has, and that it does not pretend a queued run
 * has finished.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClassificationState } from '@/components/project/ClassificationState'
import { neverClassified } from '@/components/project/neverClassified'
import type { ClassificationState as Classification } from '@/domain/types'

const NEVER: Classification = {
  engine: null,
  degraded: false,
  note: 'No review has run. Areas reflect whatever links already exist.',
  reviewedAt: null,
}

const OFFLINE: Classification = {
  engine: 'offline_by_kind_after_reviewer_error',
  degraded: true,
  note: 'Classification fell back to the offline rule for some or all statements, which assigns only unambiguous kinds. This percentage is lower than a model would have reached, for a reason that is not about the project.',
  reviewedAt: '2026-08-09T14:41:48Z',
}

const BY_MODEL: Classification = {
  engine: 'reviewed_by_model',
  degraded: false,
  note: 'Classified by the configured review model.',
  reviewedAt: '2026-08-10T10:00:00Z',
}

describe('a project nothing has classified says so', () => {
  it('distinguishes never-classified from a thin project', () => {
    // The distinction the whole finding rests on. Both render `0%`, and only
    // one of them is about the user's project.
    expect(neverClassified(NEVER)).toBe(true)
    expect(neverClassified(OFFLINE)).toBe(false)
    expect(neverClassified(BY_MODEL)).toBe(false)
  })

  it('does not claim it from a missing field', () => {
    // A backend older than the classification block has told us nothing. The
    // strong claim — "no review has run" — from an absent field would be the
    // substitution this audit exists to remove.
    expect(neverClassified(undefined)).toBe(false)
    expect(neverClassified({ ...NEVER, engine: 'unknown' })).toBe(false)
  })

  it('says the zero is about the review, not about the project', () => {
    render(<ClassificationState classification={NEVER} onClassify={() => {}} />)

    expect(screen.getByText(/nothing has classified this project/i)).toBeInTheDocument()
    expect(screen.getByText(/about the review, not about your project/i)).toBeInTheDocument()
  })

  it('offers the pass, because a person cannot ask for it any other way', async () => {
    const user = userEvent.setup()
    const onClassify = vi.fn()
    render(<ClassificationState classification={NEVER} onClassify={onClassify} />)

    await user.click(screen.getByRole('button', { name: /classify what the project holds/i }))

    expect(onClassify).toHaveBeenCalledOnce()
  })

  it('says queued rather than done', () => {
    // A worker runs it. A surface that showed the areas changing on click
    // would be inventing the one thing this journey is about.
    render(<ClassificationState classification={NEVER} onClassify={() => {}} queued />)

    expect(screen.getByText(/queued/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('a project that was classified', () => {
  it('carries Memory`s own words about a degraded pass', () => {
    render(<ClassificationState classification={OFFLINE} onClassify={() => {}} />)

    // Verbatim, including the clause that says the cause is not the project.
    // A client that summarised this would be deciding how alarmed to be.
    expect(screen.getByText(/not about the project/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('says nothing at all when a model classified it', () => {
    const { container } = render(
      <ClassificationState classification={BY_MODEL} onClassify={() => {}} />,
    )

    // The half that keeps this honest. A standing notice on every project is
    // a notice nobody reads, and this one has to be believed the once it
    // appears.
    expect(container).toBeEmptyDOMElement()
  })

  it('says nothing on a backend that does not report classification', () => {
    const { container } = render(
      <ClassificationState classification={undefined} onClassify={() => {}} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
