/**
 * A coverage figure says what it was computed over.
 *
 * PLANNING_MODEL.md: "content loss is reported separately and never folded in.
 * While F-018 is open, a project whose extraction abandoned chunks must say
 * so." F-018 abandons 29–65% of chunks on real corpora, and what survives looks
 * exactly like a complete project.
 *
 * The first slice named this as the thing it owed and did not pay.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentLoss } from '@/pages/rooms/interview/InterviewRoom'

describe('the content-loss disclosure', () => {
  it('says how much was not read, beside the figures it undermines', () => {
    render(
      <ContentLoss
        coverage={{ succeeded: 45, abandoned: 12, notIngested: 0, total: 57, complete: false }}
      />,
    )

    expect(screen.getByText(/12 of 57 submissions could not be fully read/i)).toBeInTheDocument()
    expect(screen.getByText(/less than this project actually said/i)).toBeInTheDocument()
  })

  it('says nothing when nothing was lost', () => {
    // A banner on every project warning that something might be missing is a
    // banner nobody reads — and the previous slice was about not handing people
    // more to sort out.
    const { container } = render(
      <ContentLoss
        coverage={{ succeeded: 45, abandoned: 0, notIngested: 0, total: 45, complete: true }}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('says nothing when the backend cannot tell', () => {
    // Warning on the strength of our own ignorance would be worse than
    // silence: it would appear on every project running against an older
    // Memory, which is the definition of noise.
    const { container } = render(<ContentLoss coverage={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })

  /**
   * `D-232`. Truncation and abandonment are different failures (`AUD-024`), and
   * this banner reported one of them. A document cut off at the ingest ceiling
   * leaves `abandoned` at zero while `complete` goes false, so the one sentence
   * in the product that says how much of a project was never read said
   * **"0 of 3"** in exactly the case it exists for.
   */
  it('never says zero submissions could not be read', () => {
    render(
      <ContentLoss
        coverage={{ succeeded: 3, abandoned: 0, notIngested: 4, total: 7, complete: false }}
      />,
    )

    // The clause is absent rather than zeroed. Nothing was abandoned, so there
    // is nothing to say about abandonment.
    expect(screen.queryByText(/could not be fully read/i)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\b0 of\b/)
  })

  it('names truncation as its own failure, with the true denominator', () => {
    render(
      <ContentLoss
        coverage={{ succeeded: 3, abandoned: 0, notIngested: 4, total: 7, complete: false }}
      />,
    )

    // 7, not 3: a denominator excluding the sections nobody read understates
    // the loss it is the denominator for.
    expect(screen.getByText(/4 of 7 were never read at all/i)).toBeInTheDocument()
  })

  it('keeps the two failures in separate sentences', () => {
    render(
      <ContentLoss
        coverage={{ succeeded: 3, abandoned: 2, notIngested: 4, total: 9, complete: false }}
      />,
    )

    // Summing them would be the conflation `AUD-024` split them to prevent:
    // one is retried, the other needs a bigger ceiling or a smaller document.
    expect(screen.getByText(/2 of 9 submissions could not be fully read/i)).toBeInTheDocument()
    expect(screen.getByText(/4 of 9 were never read at all/i)).toBeInTheDocument()
  })

  it('says loss it cannot size, rather than a zero', () => {
    // An older Memory reports neither figure. Unknown is not zero, and
    // `complete: false` rules out saying nothing was lost.
    render(
      <ContentLoss
        coverage={{ succeeded: 3, abandoned: 0, notIngested: null, total: null, complete: false }}
      />,
    )

    expect(screen.getByText(/does not say how much/i)).toBeInTheDocument()
    expect(screen.queryByText(/0 of/)).not.toBeInTheDocument()
  })
})
