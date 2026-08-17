/**
 * The areas are not equal, and the list where somebody picks one says so.
 *
 * `COV-UNWEIGHTED` / `D-195`. Readiness is a weighted mean over these areas —
 * the shipped set carries 1.0, 1.5 and 2.0 — and `weight` was dropped in
 * Studio's own backend, so every surface could count areas and none could say
 * that covering one moves readiness twice as far as covering another.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageSection } from './InterviewRoom'
import { readinessShares } from './readinessShares'
import type { CoverageTopic, ProjectProjection } from '@/domain/types'

function area(over: Partial<CoverageTopic> & Pick<CoverageTopic, 'key'>): CoverageTopic {
  return {
    name: over.key,
    state: 'missing',
    detail: 'missing · 0 of 1 confirmed',
    weight: 1,
    ...over,
  }
}

function projection(coverage: CoverageTopic[]): ProjectProjection {
  return {
    health: { percentage: 10, phase: 'discovering', coverage },
    blockers: [],
  } as unknown as ProjectProjection
}

describe('how much of readiness an area accounts for', () => {
  it('is on the row, so a person can tell which gap is worth closing next', () => {
    render(
      <CoverageSection
        projection={projection([
          area({ key: 'functional_requirements', name: 'Functional requirements', weight: 2 }),
          area({ key: 'users_and_stakeholders', name: 'Users and stakeholders', weight: 1 }),
          area({ key: 'problem_and_value', name: 'Problem and value', weight: 1 }),
        ])}
      />,
    )

    expect(screen.getByText('50% of readiness')).toBeInTheDocument()
    expect(screen.getAllByText('25% of readiness')).toHaveLength(2)
  })

  it('denominates over the applicable areas, as the score itself does', () => {
    // `score_areas` drops `NOT_APPLICABLE` from the denominator entirely, so
    // excluding an area neither rewards nor punishes the project. A share over
    // a total that included it would be a second denominator disagreeing with
    // Memory's — which is the defect this row exists to fix, one layer down.
    const shares = readinessShares([
      area({ key: 'a', weight: 3 }),
      area({ key: 'b', weight: 1 }),
      area({ key: 'c', weight: 4, state: 'notApplicable' }),
    ])

    expect(shares?.get('a')).toBe(75)
    expect(shares?.has('c')).toBe(false)
  })

  it('says nothing when every area weighs the same', () => {
    // Every share is `1/n`, which asserts nothing the list of areas does not
    // already say. A figure on every row is noise attached to the ordinary
    // case (`D-193`, `D-194`).
    render(
      <CoverageSection
        projection={projection([area({ key: 'a' }), area({ key: 'b' }), area({ key: 'c' })])}
      />,
    )

    expect(screen.queryByText(/of readiness/)).not.toBeInTheDocument()
  })

  it('says nothing about any area when one weight is unknown', () => {
    // A share of an incomplete total is an invented number, and it would be
    // wrong for the areas whose weight *did* arrive as well as for the one
    // whose did not. Unknown is not zero (`D-38`).
    render(
      <CoverageSection
        projection={projection([
          area({ key: 'a', weight: 2 }),
          area({ key: 'b', weight: 1 }),
          area({ key: 'c', weight: null }),
        ])}
      />,
    )

    expect(screen.queryByText(/of readiness/)).not.toBeInTheDocument()
  })

  it('is not a claim about how covered the area is', () => {
    // A weight is what an area is worth, not what it holds. The two travel
    // beside each other and are never folded: a heavy area nobody has touched
    // and a light one that is finished must not read alike.
    render(
      <CoverageSection
        projection={projection([
          area({ key: 'heavy', name: 'Heavy', weight: 3, state: 'missing' }),
          area({ key: 'light', name: 'Light', weight: 1, state: 'strong' }),
        ])}
      />,
    )

    expect(screen.getByText('75% of readiness')).toBeInTheDocument()
    expect(screen.getByText('missing')).toBeInTheDocument()
    expect(screen.getByText('strong')).toBeInTheDocument()
  })
})
