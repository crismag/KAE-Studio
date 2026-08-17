/**
 * `D-215` — the adapter half. `actor_type !== 'user'` was not `assistant`.
 *
 * KAE-Memory's `ActorType` (`domain/workspace.py:40-45`) has three members, and
 * `listMessages` read one of them. `system` — the word
 * `clarification_service.py` uses *because* no model run produced the sentence —
 * arrived, failed the `=== 'user'` test, and became `assistant`, which is the
 * author the transcript draws with the AI mark.
 *
 * The message list is the one surface in Studio that attributes sentences to
 * their producer, so a wrong answer here is a claim rather than a rendering
 * detail (`D-185`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLiveServices } from './liveServices'

/**
 * `ActorType` in `kae_memory/domain/workspace.py`, verbatim and in the enum's
 * own order, with the author Studio owes each one.
 *
 * Written out rather than imported — the repositories share no code — so an
 * actor added upstream and left unmapped is a change somebody has to make
 * deliberately. `vocabulary_drift.py`'s second list is what reported this one.
 */
const MEMORY_ACTORS = [
  { actorType: 'user', author: 'user' },
  { actorType: 'agent', author: 'assistant' },
  { actorType: 'system', author: 'system' },
] as const

function respond(messages: Record<string, unknown>[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.endsWith('/messages') ? messages : [{ id: 's1' }]
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

async function authorOf(actorType: string) {
  respond([{ id: 'm1', content: 'Which team owns this?', actor_type: actorType, created_at: '' }])
  const [message] = await createLiveServices('p1').memory.listMessages('p1')
  return message
}

afterEach(() => vi.restoreAllMocks())

describe('every actor KAE-Memory has reaches the author it means', () => {
  it.each(MEMORY_ACTORS)('draws $actorType as $author', async ({ actorType, author }) => {
    expect((await authorOf(actorType)).author).toBe(author)
  })

  it('never calls a system turn an assistant one', async () => {
    // The defect, exactly. `assistant` is the arm carrying the sparkle, so this
    // was Studio saying a model wrote a question deterministic code produced.
    expect((await authorOf('system')).author).not.toBe('assistant')
  })

  it('keeps the word the decision was made from', async () => {
    // So an actor Studio does not recognise can show itself downstream rather
    // than being indistinguishable from `system` (`D-212`).
    expect((await authorOf('system')).actorType).toBe('system')
  })

  it('gives an unrecognised actor the arm that claims no producer', async () => {
    // Not `assistant`. A fourth `ActorType` has not told Studio a model wrote
    // the sentence, and the mark would be Studio asserting one (`D-38`).
    const message = await authorOf('orchestrator')

    expect(message.author).toBe('system')
    expect(message.actorType).toBe('orchestrator')
  })
})
