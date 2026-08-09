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
import { ContentLoss } from './Workspace'

describe('the content-loss disclosure', () => {
  it('says how much was not read, beside the figures it undermines', () => {
    render(<ContentLoss coverage={{ succeeded: 45, abandoned: 12, complete: false }} />)

    expect(screen.getByText(/12 of 57 submissions could not be fully read/i)).toBeInTheDocument()
    expect(screen.getByText(/less than this project actually said/i)).toBeInTheDocument()
  })

  it('says nothing when nothing was lost', () => {
    // A banner on every project warning that something might be missing is a
    // banner nobody reads — and the previous slice was about not handing people
    // more to sort out.
    const { container } = render(
      <ContentLoss coverage={{ succeeded: 45, abandoned: 0, complete: true }} />,
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
})
