/**
 * Advice you can act on, and a conclusion you can see the weight of.
 *
 * KAE can advise (C-3) and conclude (C-4), and both arrived as prose — so
 * taking the advice meant retyping it. This product already measured that cost
 * when "Discuss this" prefilled a box nobody sent.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConcludedList, RecommendationCard } from './RecommendationCard'

const advice = {
  advice: 'Defer mobile to a second release',
  reason: 'the web build proves the idea faster',
  consequence: 'mobile users wait a release',
}

describe('a recommendation', () => {
  it('says what accepting would commit to', () => {
    render(<RecommendationCard recommendation={advice} onDecide={() => {}} />)

    // Advice whose cost is not stated asks for agreement rather than a decision.
    expect(screen.getByText(/if you accept: mobile users wait a release/i)).toBeInTheDocument()
    expect(screen.getByText(/the web build proves the idea faster/i)).toBeInTheDocument()
  })

  it('makes disagreeing exactly as cheap as agreeing', async () => {
    // If accepting were a click and disagreeing a paragraph, the interface
    // would have a thumb on the scale, and the agreement it collected would
    // mean less for it.
    render(<RecommendationCard recommendation={advice} onDecide={() => {}} />)

    expect(screen.getByRole('button', { name: /^accept$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^modify$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^keep open$/i })).toBeInTheDocument()
  })

  it('records acceptance as a decision KAE suggested, not one the user stated', async () => {
    const user = userEvent.setup()
    const onDecide = vi.fn().mockResolvedValue(undefined)
    render(<RecommendationCard recommendation={advice} onDecide={onDecide} />)

    await user.click(screen.getByRole('button', { name: /^accept$/i }))

    expect(onDecide).toHaveBeenCalledExactlyOnceWith('accept', undefined)
    await waitFor(() =>
      expect(screen.getByText(/KAE noted as having suggested it/i)).toBeInTheDocument(),
    )
  })

  it('keeps the wording a person edited', async () => {
    const user = userEvent.setup()
    const onDecide = vi.fn().mockResolvedValue(undefined)
    render(<RecommendationCard recommendation={advice} onDecide={onDecide} />)

    await user.click(screen.getByRole('button', { name: /^modify$/i }))
    const box = screen.getByLabelText(/edit the recommendation/i)
    await user.clear(box)
    await user.type(box, 'Defer mobile until after the pilot')
    await user.click(screen.getByRole('button', { name: /save my wording/i }))

    // Recording the original would be recording agreement with something they
    // explicitly did not agree with.
    expect(onDecide).toHaveBeenCalledExactlyOnceWith('modify', 'Defer mobile until after the pilot')
  })

  it('says an open option will come back', async () => {
    const user = userEvent.setup()
    render(<RecommendationCard recommendation={advice} onDecide={() => Promise.resolve()} />)

    await user.click(screen.getByRole('button', { name: /^keep open$/i }))

    await waitFor(() =>
      expect(screen.getByText(/raise it again before building/i)).toBeInTheDocument(),
    )
  })

  it('never reports a decision that failed to save', async () => {
    const user = userEvent.setup()
    render(
      <RecommendationCard
        recommendation={advice}
        onDecide={() => Promise.reject(new Error('memory unreachable'))}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^accept$/i }))

    await waitFor(() => expect(screen.getByText(/nothing was saved/i)).toBeInTheDocument())
    expect(screen.queryByText(/KAE noted as having suggested it/i)).not.toBeInTheDocument()
  })
})

describe('what a turn settled on its own account', () => {
  it('sets a material conclusion apart and invites disagreement', () => {
    render(
      <ConcludedList
        concluded={[
          {
            statement: 'Single tenant for v1',
            consequence: 'architectural',
            revisitWhen: 'before_build',
            material: true,
          },
        ]}
      />,
    )

    expect(screen.getByText(/say if you disagree/i)).toBeInTheDocument()
    expect(screen.getByText(/revisited before building/i)).toBeInTheDocument()
  })

  it('leaves a routine conclusion quiet', () => {
    // Interrupting for everything is what produced eighty-one review items on
    // a first project.
    render(
      <ConcludedList
        concluded={[
          {
            statement: 'Reports are weekly',
            consequence: 'cosmetic',
            revisitWhen: 'on_request',
            material: false,
          },
        ]}
      />,
    )

    expect(screen.queryByText(/say if you disagree/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Reports are weekly/)).toBeInTheDocument()
  })

  it('says when each will be looked at again, in words', () => {
    // A conclusion nobody looks at again is a guess with tenure, and
    // "on_conflicting_evidence" is not a sentence.
    render(
      <ConcludedList
        concluded={[
          {
            statement: 'Weekly cadence',
            consequence: 'rework',
            revisitWhen: 'on_conflicting_evidence',
            material: false,
          },
        ]}
      />,
    )

    expect(screen.getByText(/revisited if something contradicts it/i)).toBeInTheDocument()
  })
})
