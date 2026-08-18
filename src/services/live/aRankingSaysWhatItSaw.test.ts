/**
 * `D-287` — CIE computes a marker so a stale ranking can be spotted, Studio's
 * turn route stores it, and until now nothing read it back.
 *
 * `api.py` has written `projection_fingerprint` into every turn's metadata
 * since the route was built, with a comment saying exactly why: "a ranking
 * reasoned against a projection the project has since moved past is still
 * guidance, but a reader deserves to know which." The adapter dropped it, so
 * the reader never could.
 *
 * Two halves here: the adapter carrying the value, and the comparison that
 * turns two of them into a claim. The rendering half is in
 * `components/project/NextAction.test.tsx`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ConversationMessage } from '@/domain/types'
import { rankingPredatesTheProject } from '@/components/project/reasonedBefore'
import { createLiveServices } from './liveServices'

function respond(messages: Record<string, unknown>[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.endsWith('/messages') ? messages : [{ id: 's1' }]
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

async function loaded(messages: Record<string, unknown>[]) {
  respond(messages)
  return createLiveServices('p1').memory.listMessages('p1')
}

function turn(id: string, metadata: Record<string, unknown>) {
  return { id, content: 'A reply.', actor_type: 'agent', created_at: '', metadata }
}

const RANKED = [{ kind: 'answer', label: 'Name the users', reason: 'nothing else can be sized' }]

afterEach(() => vi.restoreAllMocks())

describe('the projection a turn was reasoned from reaches the browser', () => {
  it('carries the digest the backend wrote', async () => {
    const [message] = await loaded([turn('m1', { projection_fingerprint: 'abc123' })])

    expect(message.projectionFingerprint).toBe('abc123')
  })

  it('leaves it absent for a turn recorded before the field existed', async () => {
    // Not the empty string, which would compare unequal to a later turn's
    // digest and read as a claim that the project moved (`D-38`).
    const [message] = await loaded([turn('m1', {})])

    expect(message.projectionFingerprint).toBeUndefined()
  })

  it('leaves it absent when the backend wrote no projection', async () => {
    // `api.py` stores `""` when the turn had no projection to digest. That is
    // the same absence, spelled the way the route spells it.
    const [message] = await loaded([turn('m1', { projection_fingerprint: '' })])

    expect(message.projectionFingerprint).toBeUndefined()
  })
})

describe('whether the ranking on screen predates the project', () => {
  function messages(...turns: Partial<ConversationMessage>[]): ConversationMessage[] {
    return turns.map(
      (t, i) => ({ id: `m${i}`, body: '', createdAt: '', ...t }) as ConversationMessage,
    )
  }

  it('says so when a later turn saw durable state the ranked one did not', () => {
    const predates = rankingPredatesTheProject(
      messages(
        { nextAction: RANKED as never, projectionFingerprint: 'before' },
        { projectionFingerprint: 'after' },
      ),
    )

    expect(predates).toBe(true)
  })

  it('says nothing when the two turns saw the same durable state', () => {
    expect(
      rankingPredatesTheProject(
        messages(
          { nextAction: RANKED as never, projectionFingerprint: 'same' },
          { projectionFingerprint: 'same' },
        ),
      ),
    ).toBe(false)
  })

  it('compares the newest turn that ranked anything, not the newest turn', () => {
    // A reply with no `NEXT:` line produces a move whose `next_action` is
    // empty and the panel keeps showing the previous ranking — which is the
    // only way a ranking on screen can be behind at all.
    expect(
      rankingPredatesTheProject(
        messages(
          { nextAction: RANKED as never, projectionFingerprint: 'before' },
          { nextAction: [], projectionFingerprint: 'after' },
        ),
      ),
    ).toBe(true)
  })

  it('says nothing when the ranked turn carries no fingerprint', () => {
    // Absent is not stale (`D-38`). A ranking recorded before the field was
    // carried has made no claim about what it saw.
    expect(
      rankingPredatesTheProject(
        messages({ nextAction: RANKED as never }, { projectionFingerprint: 'after' }),
      ),
    ).toBe(false)
  })

  it('says nothing when nothing later carries one', () => {
    expect(
      rankingPredatesTheProject(
        messages({ nextAction: RANKED as never, projectionFingerprint: 'before' }, { body: 'Hi.' }),
      ),
    ).toBe(false)
  })

  it('says nothing when no turn ranked anything', () => {
    expect(rankingPredatesTheProject(messages({ projectionFingerprint: 'after' }))).toBe(false)
  })

  it('says nothing about an empty transcript', () => {
    expect(rankingPredatesTheProject([])).toBe(false)
  })

  it('is unmoved by a person answering after the ranking', () => {
    // A person's message carries no fingerprint. The newest one that does is
    // still the ranked turn's own, so nothing has been shown to have moved.
    expect(
      rankingPredatesTheProject(
        messages(
          { nextAction: RANKED as never, projectionFingerprint: 'same' },
          { body: 'Sales and support.' },
        ),
      ),
    ).toBe(false)
  })
})
