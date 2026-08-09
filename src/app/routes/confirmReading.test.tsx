/**
 * Agreeing with a reading, in one click.
 *
 * The defect this closes is semantic. CIE wrote "Confirmed — the core problem
 * is..." while the panel two across reported "0 of 1 confirmed". Both were
 * correct: confirmation worked one item at a time, a turn carried no ids, and
 * the interviewer's word was prose.
 *
 * Every test here is about what a person sees and what it costs them. The
 * mechanics are covered in the backend; what matters at this layer is that the
 * gesture appears only when there is something to agree with, that one click is
 * the whole act, and that a failed write never renders as success.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ConversationMessage } from '@/domain/types'
import { AssistantMessage } from './Workspace'

function message(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'm1',
    author: 'assistant',
    body: 'So the problem is that notes scatter and tasks get lost.',
    createdAt: new Date('2026-08-09T12:00:00Z').toISOString(),
    syncState: 'acknowledged',
    ...overrides,
  }
}

describe('confirming a reading', () => {
  it('offers nothing to agree with when the turn reflected nothing', () => {
    render(
      <AssistantMessage
        message={message({ body: 'Who is this for?' })}
        onSuggestion={() => {}}
        onConfirmReading={() => {}}
      />,
    )

    expect(screen.queryByText(/does that hold/i)).not.toBeInTheDocument()
  })

  it('names how many statements a yes would confirm', () => {
    render(
      <AssistantMessage
        message={message({ provenance: ['k1', 'k2', 'k3'] })}
        onSuggestion={() => {}}
        onConfirmReading={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: /confirm 3/i })).toBeInTheDocument()
  })

  it('confirms exactly the statements the turn reflected, in one click', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn().mockResolvedValue(undefined)
    render(
      <AssistantMessage
        message={message({ provenance: ['k1', 'k2'] })}
        onSuggestion={() => {}}
        onConfirmReading={confirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: /confirm 2/i }))

    expect(confirm).toHaveBeenCalledExactlyOnceWith(['k1', 'k2'])
  })

  it('asks nothing further once the click has answered', async () => {
    const user = userEvent.setup()
    render(
      <AssistantMessage
        message={message({ provenance: ['k1'] })}
        onSuggestion={() => {}}
        onConfirmReading={() => Promise.resolve()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /confirm 1/i }))

    await waitFor(() => expect(screen.getByText(/now part of what this project holds/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
  })

  it('does not report a confirmation that failed', async () => {
    const user = userEvent.setup()
    render(
      <AssistantMessage
        message={message({ provenance: ['k1'] })}
        onSuggestion={() => {}}
        onConfirmReading={() => Promise.reject(new Error('memory unreachable'))}
      />,
    )

    await user.click(screen.getByRole('button', { name: /confirm 1/i }))

    await waitFor(() => expect(screen.getByText(/nothing was recorded/i)).toBeInTheDocument())
    expect(screen.queryByText(/now part of what this project holds/i)).not.toBeInTheDocument()
  })
})
