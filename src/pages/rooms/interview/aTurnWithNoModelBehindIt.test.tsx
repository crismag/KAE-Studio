/**
 * `D-215` — a question deterministic code wrote is not a model reply.
 *
 * KAE-Memory's `ActorType` has three members and `clarification_service.py:522`
 * writes `SYSTEM` deliberately, with the reason in a comment above it: an agent
 * message must name the run that produced it, and a question derived from
 * findings has no run behind it. `_LazySession` then records that question in
 * the person's **own** session, because a clarification belongs in the
 * conversation they are having — the same session Studio's `/messages` reads.
 *
 * Studio mapped `actor_type !== 'user'` to `assistant`, so every one of them was
 * drawn by `AssistantMessage`: sparkle, assistant prose, indistinguishable from
 * something CIE said. `D-185`'s class — a provenance claim that was not true —
 * and the direction that matters, since the false attribution is the one that
 * adds a producer rather than the one that omits one.
 *
 * The routing lives in `TranscriptTurn` rather than inside the room so these can
 * assert the decision itself. A guard that cannot reach the branch asserts
 * something beside it and stays green through the defect (`D-213`).
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MEMORY_ACTOR_TYPES } from '@/domain/memorysVocabulary'
import type { ConversationMessage } from '@/domain/types'
import { TranscriptTurn } from './InterviewRoom'

function turn(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'm1',
    author: 'system',
    actorType: 'system',
    body: 'Which team owns the reporting pipeline?',
    createdAt: new Date('2026-08-17T12:00:00Z').toISOString(),
    syncState: 'acknowledged',
    ...overrides,
  }
}

function draw(message: ConversationMessage) {
  return render(<TranscriptTurn message={message} onSuggestion={() => {}} />)
}

describe('a turn KAE recorded with no model behind it', () => {
  it('says no model produced it', () => {
    draw(turn())

    expect(screen.getByText(/no model produced this/i)).toBeInTheDocument()
  })

  it('does not carry the mark that means a model spoke', () => {
    const { container } = draw(turn())

    // The sparkle is `aria-hidden`, so it is reachable only as the class
    // `lucide-sparkle`. That is the whole of what said "CIE wrote this", which
    // is why its absence is asserted rather than inferred from the prose.
    expect(container.querySelector('.lucide-sparkle')).toBeNull()
  })

  it('offers nothing to agree with, because nothing reflected anything back', () => {
    // A system turn can carry `provenance` no more than it carries a run. The
    // assistant arm would have offered "Does that hold?" over it; asserting the
    // absence here is what stops the arm being widened back by accident.
    draw(turn({ provenance: ['k1', 'k2'] }))

    expect(screen.queryByText(/does that hold/i)).not.toBeInTheDocument()
  })

  it('still draws the sentence a person has to read', () => {
    draw(turn())

    expect(screen.getByText(/which team owns the reporting pipeline/i)).toBeInTheDocument()
  })
})

describe('the arm each of Memory’s actors reaches', () => {
  it('gives the model mark to `agent` and to nothing else', () => {
    for (const actorType of MEMORY_ACTOR_TYPES) {
      const author = actorType === 'user' ? 'user' : actorType === 'agent' ? 'assistant' : 'system'
      const { container, unmount } = draw(turn({ author, actorType }))

      expect(container.querySelector('.lucide-sparkle') !== null).toBe(actorType === 'agent')
      unmount()
    }
  })

  it('shows an actor it does not recognise rather than absorbing it', () => {
    // `D-212`'s rule. The arm is decided — an unknown actor has not said a model
    // produced the sentence — but which word arrived is a fact, and hiding it
    // would make a fourth `ActorType` indistinguishable from `system`.
    draw(turn({ actorType: 'orchestrator' }))

    expect(screen.getByText(/orchestrator/)).toBeInTheDocument()
    expect(screen.queryByText(/no model produced this/i)).not.toBeInTheDocument()
  })
})
