/**
 * `§16` — every degraded state answers all three of its clauses.
 *
 * > Each empty/degraded state must explain **what belongs there**, **why it is
 * > unavailable**, and **one exact recovery/next action.**
 *
 * The last ten increments built these surfaces by instinct and answered the
 * first two clauses every time. None answered the third. The worst case named
 * the exact fix in prose — *"the connection it uses has not been granted"* —
 * and offered no way to do it, on a page whose connections panel is two below.
 *
 * ## What these do not assert
 *
 * That every note has an action. `§16` asks for the action to be **exact**, not
 * for one to exist, and a 503 from KAE-Memory has none — inventing *"try
 * again"* for somebody else's outage is the same manufacture as inventing a
 * reason. The tests below hold the shape: where an action is offered it goes
 * somewhere real, and where none is offered the note still says what and why.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ActionFailed } from './ActionFailed'
import { CapabilityNote } from './CapabilityNote'

function renderNote(props: React.ComponentProps<typeof CapabilityNote>) {
  return render(
    <MemoryRouter>
      <CapabilityNote {...props} />
    </MemoryRouter>,
  )
}

describe('a note says why, always', () => {
  it('carries the backend`s reason verbatim', () => {
    const reason = 'KAE-Memory did not answer within 5s.'
    renderNote({ reason })

    expect(screen.getByText(reason)).toBeInTheDocument()
  })

  it('shows what was established, when anything was', () => {
    // "Not available" alone reads as nothing happened; a person usually got
    // most of the way.
    renderNote({ reason: 'Analysis is not built.', proved: ['The repository was reachable.'] })

    expect(screen.getByText('The repository was reachable.')).toBeInTheDocument()
  })
})

describe('a note offers one exact action, or none at all', () => {
  it('renders the action as something a person can follow', () => {
    renderNote({
      reason: 'It cannot be reached yet — the connection it uses has not been granted.',
      action: { label: 'Grant the connection in Settings', to: '/settings/project' },
    })

    const link = screen.getByRole('link', { name: /grant the connection in settings/i })
    expect(link).toHaveAttribute('href', '/settings/project')
  })

  it('offers nothing when there is nothing honest to offer', () => {
    // A 503 has no user action. A note that manufactured one would send
    // somebody to a page that cannot help, which is worse than silence because
    // it costs them the trip.
    renderNote({ reason: 'KAE-Memory returned 503.' })

    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('offers one, never a menu', () => {
    // `§16` says *one exact* action. Two suggestions is a question, and a
    // person reading a degraded state is already stuck.
    renderNote({
      reason: 'Something went wrong.',
      action: { label: 'Go to Settings', to: '/settings/project' },
    })

    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('still says why when it offers an action', () => {
    // The action does not replace the reason. A link with no explanation is an
    // instruction nobody can evaluate.
    const reason = 'The connection it uses has not been granted.'
    renderNote({ reason, action: { label: 'Grant it', to: '/settings/project' } })

    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /grant it/i })).toBeInTheDocument()
  })
})

/**
 * `§17` — *"screen-reader announcements for meaningful workflow state
 * changes"*, and a failed action is the most meaningful one.
 *
 * Most of `§17` already held: reduced motion is handled globally, colour is
 * never the only signal, the architecture diagram has a text alternative and
 * links to it. **One failure announced nothing** — the turn that did not send,
 * on the surface this product exists for.
 *
 * It read *"That message did not go through… Nothing was recorded, so sending
 * it again is safe"*: what happened, what it cost, exactly what to do, and
 * inaudible. `§16` was satisfied and `§17` was not, which is why the package
 * lists them separately.
 *
 * **That sentence was also false**, and this file quoting it as the exemplar is
 * part of why it survived (`D-284`). CIE records the message before it asks the
 * model, so the ordinary failure leaves it durable and a resend appends a second
 * copy. The fixture below carries the corrected wording; what `§17` asks of the
 * component — that a recovery is announced and not merely a breakage — is
 * unchanged, because the recovery is still there and is now the true one.
 *
 * **The count was corrected before it landed.** A scan said nine such sites; on
 * reading the components, seven render a `Refusal` that has carried
 * `role="alert"` all along. A scan is evidence of where to look.
 */
describe('a failed action is announced', () => {
  it('is assertive, not polite', () => {
    // The person is waiting on this. A polite region can be swallowed by
    // whatever else is speaking.
    render(<ActionFailed>That message did not go through.</ActionFailed>)

    expect(screen.getByRole('alert')).toHaveTextContent(/did not go through/i)
  })

  it('carries the recovery the sentence names', () => {
    // `§16` and `§17` together: the announcement is worth nothing if it says
    // only that something broke.
    render(
      <ActionFailed>
        Check the conversation above before sending it again. A second send would be a second copy.
      </ActionFailed>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/before sending it again/i)
  })

  it('does not announce a condition of the page', () => {
    // `CapabilityNote` stays quiet: a section that could not be read is not the
    // outcome of a gesture, and announcing every degraded panel on load would
    // make the assertive channel useless for the case it exists for.
    renderNote({ reason: 'KAE-Memory returned 503.' })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
