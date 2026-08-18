/**
 * One recommended action, always present, with its reason.
 *
 * R12 asks for guidance rather than a gate, and ADR-0002 decides who may
 * produce it. These cover the two ways this panel could go wrong: showing
 * nothing when nothing has been ranked, and passing a stage-derived guess off
 * as a reasoned recommendation.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ProjectProjection } from '@/domain/types'
import { NextAction } from './NextAction'
import { floorAction } from './nextActionFloor'

function projection(overrides: Partial<ProjectProjection> = {}): ProjectProjection {
  return {
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
    },
    requirements: [],
    ...overrides,
  } as ProjectProjection
}

describe('the recommended next action', () => {
  it('always shows the reason, not only the instruction', () => {
    render(
      <NextAction
        action={{
          kind: 'decide',
          label: 'Choose an MVP direction',
          reason: 'everything downstream waits on it',
        }}
      />,
    )

    expect(screen.getByText('Choose an MVP direction')).toBeInTheDocument()
    expect(screen.getByText('everything downstream waits on it')).toBeInTheDocument()
  })

  it('says when it is a stage-derived guess rather than a ranked recommendation', () => {
    // Different claims. A reader who cannot tell them apart over-trusts the
    // weaker one, and the weaker one is the panel's own arithmetic.
    render(<NextAction action={floorAction(projection())} derived />)

    expect(screen.getByText(/has not weighed it against anything else/i)).toBeInTheDocument()
  })

  it('does not hedge a recommendation CIE actually ranked', () => {
    render(
      <NextAction
        action={{ kind: 'review', label: 'Review 3 requirements', reason: 'oldest work' }}
      />,
    )

    expect(screen.queryByText(/has not weighed it against anything else/i)).not.toBeInTheDocument()
  })

  it('says when a ranking was reasoned before the project last changed', () => {
    // The third grade of claim (`D-287`). Still guidance, and probably still
    // right — what a reader cannot otherwise tell is that it was decided
    // before the last thing that landed.
    render(
      <NextAction
        action={{ kind: 'review', label: 'Review 3 requirements', reason: 'oldest work' }}
        predatesTheProject
      />,
    )

    expect(screen.getByText(/weighed before the project last changed/i)).toBeInTheDocument()
  })

  it('offers the way out rather than only the qualification', () => {
    // `UX-16`: a qualified state carries one exact next action. Here it is to
    // say something, in the composer on the same screen.
    render(
      <NextAction
        action={{ kind: 'review', label: 'Review 3 requirements', reason: 'oldest work' }}
        predatesTheProject
      />,
    )

    expect(screen.getByText(/say something and KAE will weigh it again/i)).toBeInTheDocument()
  })

  it('does not hedge a current ranking', () => {
    render(
      <NextAction
        action={{ kind: 'review', label: 'Review 3 requirements', reason: 'oldest work' }}
      />,
    )

    expect(screen.queryByText(/weighed before the project last changed/i)).not.toBeInTheDocument()
  })

  it('never stacks the two qualifications on one action', () => {
    // A derived action was computed from the projection as it is now, so it
    // cannot be behind it. Both lines together would be the panel arguing
    // with itself about which claim it is making.
    render(<NextAction action={floorAction(projection())} derived predatesTheProject />)

    expect(screen.getByText(/has not weighed it against anything else/i)).toBeInTheDocument()
    expect(screen.queryByText(/weighed before the project last changed/i)).not.toBeInTheDocument()
  })
})

describe('the floor', () => {
  it('asks for a description when the project holds nothing', () => {
    const action = floorAction(projection())

    expect(action.kind).toBe('answer')
    expect(action.reason).toMatch(/nothing has been established/i)
  })

  it('points at review when statements are waiting on a decision', () => {
    const action = floorAction(projection({ requirements: [{ id: 'r1' }, { id: 'r2' }] as never }))

    expect(action.kind).toBe('review')
  })

  it('never names which area matters most', () => {
    // That judgement is CIE's. A floor that ranked areas would be Studio
    // ranking — the thing ADR-0002 exists to prevent, arriving as a fallback.
    const action = floorAction(
      projection({
        definition: {
          ...projection().definition,
          objectives: [{ id: 'k1', text: 'A goal.', status: 'confirmed' }],
        },
      } as never),
    )

    expect(action.label).not.toMatch(/problem|users|scope|requirements/i)
  })
})
