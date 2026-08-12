/**
 * Markdown, and the two things rendering it must never do.
 *
 * `VC-03/E`: *"the turn shape is rich; the renderer is a `<p>`."* CIE has
 * specified Markdown since the first slice and Studio printed it flat, so a
 * reply comparing three options arrived as one paragraph with literal pipe
 * characters in it.
 *
 * The security half matters more than the typography. Assistant prose is model
 * output rendered into an authenticated page, and the model reads the user's
 * repository — so raw HTML here is a script injection whose payload is written
 * by whatever it just read.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AssistantProse } from './AssistantProse'

describe('a reply is rendered as what it is', () => {
  it('renders a list as a list, not as literal dashes', () => {
    const { container } = render(
      <AssistantProse>{'Three things:\n\n- first\n- second\n- third'}</AssistantProse>,
    )

    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('renders a table, which is why remark-gfm is here at all', () => {
    // Comparing options is what a planning assistant does. A flattened
    // comparison is worse than no comparison, because the user asks again and
    // the interview repeats itself for a reason nobody can see.
    const { container } = render(
      <AssistantProse>
        {'| Option | Cost |\n| --- | --- |\n| Managed | higher |\n| Self-hosted | lower |'}
      </AssistantProse>,
    )

    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.getByText('Self-hosted')).toBeInTheDocument()
  })

  it('renders a fenced block as code', () => {
    const { container } = render(
      <AssistantProse>{'Set it:\n\n```\nKAE_REVIEW=bedrock\n```'}</AssistantProse>,
    )

    expect(container.querySelector('pre')).toBeInTheDocument()
    expect(screen.getByText(/KAE_REVIEW=bedrock/)).toBeInTheDocument()
  })

  it('keeps ordinary prose as ordinary prose', () => {
    render(<AssistantProse>{'Invoices go out within three days.'}</AssistantProse>)

    expect(screen.getByText('Invoices go out within three days.')).toBeInTheDocument()
  })

  it('preserves a line break inside a paragraph', () => {
    // A model separating two sentences by a newline means it. Collapsing them
    // is a small loss that compounds across a long reply.
    const { container } = render(<AssistantProse>{'First line\nsecond line'}</AssistantProse>)

    expect(container.querySelector('p')).toHaveClass('whitespace-pre-wrap')
  })
})

describe('what it refuses to render', () => {
  it('escapes raw HTML instead of executing it', () => {
    // The boundary. `react-markdown` escapes by default and `rehype-raw` is
    // deliberately absent — model output reaches this component after the model
    // has read a repository, so the payload is not hypothetical.
    const { container } = render(
      <AssistantProse>{'<img src=x onerror="alert(1)"> and <b>bold</b>'}</AssistantProse>,
    )

    // No elements were created from it...
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    // ...and the payload survives as *text*, which is what escaping means. An
    // assertion that `onerror` is absent entirely would pass just as well
    // against a renderer that silently dropped content, so it asserts the
    // opposite: the characters are all there, inert.
    expect(container.innerHTML).toContain('&lt;img')
    expect(screen.getByText(/onerror/)).toBeInTheDocument()
  })

  it('drops a markdown image rather than fetching it', () => {
    // An `![](url)` in model output is a third-party request issued from inside
    // an authenticated page. Nothing in a planning conversation needs one.
    const { container } = render(
      <AssistantProse>{'![tracker](https://example.invalid/p.gif)'}</AssistantProse>,
    )

    expect(container.querySelector('img')).toBeNull()
  })

  it('opens a link in a new tab, with the opener severed', () => {
    render(<AssistantProse>{'See [the docs](https://example.invalid/docs).'}</AssistantProse>)

    const link = screen.getByRole('link', { name: 'the docs' })
    // A conversation is state a person is mid-way through. Same-tab navigation
    // discards whatever is in the composer, and the link never says so.
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('does not let a heading compete with the page', () => {
    // A heading inside a turn is a model organising a long answer, not page
    // structure. Rendered as an `h1` it would outrank the route's own title.
    const { container } = render(<AssistantProse>{'# Deployment\n\nSome prose.'}</AssistantProse>)

    expect(container.querySelector('h1')).toBeNull()
    expect(screen.getByText('Deployment')).toBeInTheDocument()
  })
})
