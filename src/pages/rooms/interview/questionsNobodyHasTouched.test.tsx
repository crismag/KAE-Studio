/**
 * `D-189` — the count with no denominator.
 *
 * The header said *"8 answered · 2 deferred"*. Answered and deferred are the
 * two dispositions somebody acted on, so the remainder — the questions nobody
 * has touched — was the one number a discovery room exists to report and the
 * one it could not show. `questionsAsked` was on the contract, filled by both
 * adapters, and read by nothing.
 *
 * Three assertions, because the fix is not only a render: the two adapters were
 * counting different things, and under the mock the remainder would have gone
 * negative as soon as somebody typed.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionProgress } from './InterviewRoom'
import { createLiveServices } from '@/services/live/liveServices'
import { createMockServices } from '@/services/mock/mockServices'
import type { InterviewSession } from '@/domain/types'

function session(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    interviewType: 'Clarification queue',
    objective: 'Resolve the gaps this project actually has.',
    questionsUnanswered: 3,
    questionsRespondedUnsettled: 8,
    questionsDeferred: 2,
    ...overrides,
  }
}

describe('what the discovery header reports', () => {
  it('says how many questions nobody has touched', () => {
    render(<SessionProgress session={session()} />)

    expect(screen.getByText(/3 unanswered/)).toBeInTheDocument()
  })

  it('leads with the untouched count, because it is the only actionable one', () => {
    render(<SessionProgress session={session()} />)

    expect(
      screen.getByText(/^3 unanswered · 8 answered without deciding · 2 deferred$/),
    ).toBeInTheDocument()
  })

  it('shows nothing rather than zeros before the counts arrive', () => {
    // `0 unanswered` on a project with questions is a claim, not a placeholder.
    const { container } = render(<SessionProgress session={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('the live adapter', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function projectionWith(dispositions: string[]) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        project: { id: 'p1', name: 'Ministry reporting', phase: 'discovery' },
        confirmed: [],
        proposed: [],
        areas: [],
        blockers: [],
        contradictions: { count: 0, listable: false, reason: '' },
        health: { draftEligible: false, implementationEligible: false },
        preliminary: { warnings: [] },
        modules: { available: false, gap: { capability: 'modules', reason: '' } },
        unavailable: [],
        definition: {
          problem: '',
          value: '',
          objectives: [],
          stakeholders: [],
          inScope: [],
          outOfScope: [],
          workflows: [],
          assumptions: [],
          constraints: [],
          mappingVersion: 1,
        },
        openQuestions: dispositions.map((disposition, index) => ({
          id: `q${index}`,
          question: 'Who approves?',
          severity: 'major',
          disposition,
        })),
      }),
    })
  }

  it('counts only the open ones as untouched', async () => {
    // Every word here is one `ClarificationService.candidates` can actually
    // return. `answered` is not among them — it settles the question, and a
    // settled question is dropped before the projection is built, which is why
    // the count that read it was a permanent zero (`D-198`).
    projectionWith(['open', 'open', 'deferred', 'delegated', 'unknown_by_user'])

    const result = await createLiveServices('p1').memory.getInterviewSession('p1')

    expect(result.questionsUnanswered).toBe(2)
    expect(result.questionsRespondedUnsettled).toBe(2)
    expect(result.questionsDeferred).toBe(1)
  })

  it('partitions the queue, so the three counts are the whole of it', async () => {
    projectionWith(['open', 'deferred', 'assumed_for_generation', 'suggested'])

    const result = await createLiveServices('p1').memory.getInterviewSession('p1')

    expect(
      result.questionsUnanswered + result.questionsRespondedUnsettled + result.questionsDeferred,
    ).toBe(4)
  })

  it('calls a question deferred only when somebody deferred it', async () => {
    // `!== 'open'` badged a question KAE answered for itself as one a person
    // set aside (`D-198`).
    projectionWith(['deferred', 'delegated', 'assumed_for_generation', 'open'])

    const projection = await createLiveServices('p1').projection.getProjection('p1')

    expect(projection.openDecisions.filter((decision) => decision.deferred)).toHaveLength(1)
  })
})

describe('the prototype', () => {
  it('does not count typing as answering', async () => {
    // It did: `questionsAnswered` was the number of user messages, so the
    // remainder would have gone negative on the twelfth one. The prototype has
    // no write that answers a question, and now says so by reporting none.
    const services = createMockServices()
    const before = await services.memory.getInterviewSession('p1')

    await services.memory.submitMessage('p1', 'Approval sits with the treasurer.', 'k1')
    const after = await services.memory.getInterviewSession('p1')

    expect(before.questionsRespondedUnsettled).toBe(0)
    expect(after.questionsRespondedUnsettled).toBe(0)
    expect(after.questionsUnanswered).toBe(before.questionsUnanswered)
  })

  it('moves the counts on the one decision write it has', async () => {
    const services = createMockServices()
    const before = await services.memory.getInterviewSession('p1')

    await services.memory.deferDecision('p1', 'OD-011', true)
    const after = await services.memory.getInterviewSession('p1')

    expect(after.questionsDeferred).toBe(before.questionsDeferred + 1)
    expect(after.questionsUnanswered).toBe(before.questionsUnanswered - 1)
  })
})
