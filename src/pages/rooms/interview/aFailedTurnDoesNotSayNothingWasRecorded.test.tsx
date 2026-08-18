/**
 * `D-284` — the room told people nothing was recorded, and it was.
 *
 * The sentence read *"That message did not go through: … Nothing was recorded,
 * so sending it again is safe."* Both halves were false in the ordinary
 * failure. `cie_slim/kae/conversation.py:644-652` calls `memory.record(...)`
 * **before** `model.complete(...)`, so a cold Ollama, an unpulled model, an
 * empty completion or a Bedrock error all leave the person's message durably in
 * KAE-Memory — and `useSendMessage`'s own comment, one file away, says so.
 *
 * The second half is the one that costs something. Studio passes no
 * idempotency key, so `converse` mints a fresh one per call and a resend
 * appends a **second copy**. Memory is append-only, and two other places in this
 * codebase were written to prevent exactly that: `api.py:1068-1072` (*"two
 * pieces of evidence where a person said one thing, and every count downstream
 * is wrong"*) and the hook. The room offered it as the safe option.
 *
 * ## Why *may*, and not the opposite certainty
 *
 * Three failures reach that catch and arrive as the same 503 string: no
 * interviewer configured, a provider or profile refusal raised before `converse`
 * runs, and a model failure inside it. Only the third records. `D-38`'s rule
 * cuts both ways — replacing "nothing was recorded" with "your message was
 * recorded" would be a new confident falsehood in the other two cases.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TurnFailed } from './InterviewRoom'

function draw() {
  return render(<TurnFailed reason="the interviewer could not be reached" />)
}

describe('a turn that did not go through', () => {
  it('does not claim the message was not recorded', () => {
    draw()

    expect(screen.getByRole('alert')).not.toHaveTextContent(/nothing was recorded/i)
  })

  it('does not offer sending it again as the safe thing to do', () => {
    // The specific harm, asserted on its own: a resend appends a duplicate to
    // an append-only store, which is the defect two comments in this codebase
    // exist to prevent.
    draw()

    expect(screen.getByRole('alert')).not.toHaveTextContent(/again is safe/i)
  })

  it('says a second send would be a second copy', () => {
    draw()

    expect(screen.getByRole('alert')).toHaveTextContent(/second send would be a second copy/i)
  })

  it('does not claim the message was recorded either', () => {
    // The other direction. Two of the three failures record nothing, and Studio
    // cannot tell which one it has (`D-38`).
    draw()

    expect(screen.getByRole('alert')).toHaveTextContent(/may already be recorded/i)
  })

  it('names where to look instead of leaving the person to guess', () => {
    // Paired with the transcript being refreshed on failure. Advice to check a
    // conversation Studio deliberately did not refresh would not be followable.
    draw()

    expect(screen.getByRole('alert')).toHaveTextContent(/check the conversation above/i)
  })

  it('still says what happened, in the words the failure arrived in', () => {
    draw()

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be reached/i)
  })
})
