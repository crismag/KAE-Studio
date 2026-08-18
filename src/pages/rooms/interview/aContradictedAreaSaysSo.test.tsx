/**
 * `D-288`, the rendering half.
 *
 * KAE-Memory marks the area whose knowledge contradicts itself, and the panel
 * a person reads to learn what KAE understands showed that area as `strong`,
 * detailed as *"enough for now"*. The project-level contradiction count already
 * on the page says how many there are and can never say which area, which is
 * the only part that can be acted on.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoverageSection } from './InterviewRoom'
import type { CoverageTopic, ProjectProjection } from '@/domain/types'

function area(over: Partial<CoverageTopic> & Pick<CoverageTopic, 'key'>): CoverageTopic {
  return {
    name: over.key,
    state: 'strong',
    detail: '4 confirmed — enough for now',
    weight: 1,
    contradicted: false,
    ...over,
  }
}

function projection(coverage: CoverageTopic[]): ProjectProjection {
  return {
    health: { percentage: 60, phase: 'defining', coverage },
    blockers: [],
  } as unknown as ProjectProjection
}

describe('an area holding a contradiction', () => {
  it('says so on its own row, beside a state it does not change', () => {
    render(
      <CoverageSection
        projection={projection([area({ key: 'users', name: 'Users', contradicted: true })])}
      />,
    )

    expect(screen.getByText(/statements here disagree/i)).toBeInTheDocument()
    // The state stays KAE-Memory's, deliberately (`D-31`).
    expect(screen.getByText('strong')).toBeInTheDocument()
  })

  it('names where the two statements can be read', () => {
    // `UX-16`: a qualified state carries one exact next action rather than
    // standing as a warning with nowhere to go.
    render(
      <CoverageSection
        projection={projection([area({ key: 'users', name: 'Users', contradicted: true })])}
      />,
    )

    expect(screen.getByText(/Reviews room/i)).toBeInTheDocument()
  })

  it('marks only the area that holds one', () => {
    render(
      <CoverageSection
        projection={projection([
          area({ key: 'users', name: 'Users', contradicted: true }),
          area({ key: 'scope', name: 'Scope' }),
        ])}
      />,
    )

    expect(screen.getAllByText(/statements here disagree/i)).toHaveLength(1)
  })

  it('says nothing about an area KAE-Memory made no claim about', () => {
    // `null` is *did not say* and must not render as *no contradiction*
    // confirmed — nothing appears either way, but for the right reason
    // (`D-38`).
    render(
      <CoverageSection
        projection={projection([area({ key: 'users', name: 'Users', contradicted: null })])}
      />,
    )

    expect(screen.queryByText(/statements here disagree/i)).not.toBeInTheDocument()
  })

  it('leaves the ordinary area quiet', () => {
    render(<CoverageSection projection={projection([area({ key: 'users', name: 'Users' })])} />)

    expect(screen.queryByText(/statements here disagree/i)).not.toBeInTheDocument()
  })
})
