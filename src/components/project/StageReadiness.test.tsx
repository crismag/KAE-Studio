/**
 * A page that cannot do its work says what it is waiting for.
 *
 * S-1 removed prose that claimed to know why Architecture and Plan were not
 * ready — fixture text about modules belonging to a project that does not
 * exist. Removing it left the pages honest and silent, which is only half of
 * R9: an empty page is not a defect, a page that cannot say what it is waiting
 * for is.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ProjectProjection } from '@/domain/types'
import { StageReadiness, prerequisitesFor } from './StageReadiness'

function projection(definition: Partial<ProjectProjection['definition']> = {}): ProjectProjection {
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
      ...definition,
    },
  } as ProjectProjection
}

function entries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `k${i}`,
    text: `Statement ${i}`,
    name: `Statement ${i}`,
    status: 'confirmed' as const,
  }))
}

describe('what a stage is waiting for', () => {
  it('reads the project rather than asserting anything about it', () => {
    const met = prerequisitesFor(
      projection({ stakeholders: entries(3) as never, objectives: entries(4) as never }),
    )

    expect(met.find((p) => p.label === 'Users understood')?.state).toBe('met')
    expect(met.find((p) => p.label === 'Scope developing')?.state).toBe('met')
  })

  it('distinguishes some evidence from none', () => {
    const partial = prerequisitesFor(projection({ stakeholders: entries(1) as never }))

    expect(partial.find((p) => p.label === 'Users understood')?.state).toBe('developing')
    expect(partial.find((p) => p.label === 'Scope developing')?.state).toBe('absent')
  })

  it('does not claim a project has no problem statement when it cannot tell', () => {
    // The Definition block reports `problem` as uncomputable — it needs area
    // classification Memory does not return per item. Saying "absent" with no
    // explanation would read as a fact about the project.
    const [problem] = prerequisitesFor(projection())

    expect(problem.state).toBe('absent')
    expect(problem.detail).toMatch(/cannot read per statement/i)
  })

  it('says how far along the page is, not just that it is not ready', () => {
    render(
      <StageReadiness
        stage="Architecture"
        prerequisites={prerequisitesFor(projection({ stakeholders: entries(3) as never }))}
      />,
    )

    expect(screen.getByText(/1 of 4 prerequisites met/i)).toBeInTheDocument()
    expect(screen.getByText(/fills in as they are/i)).toBeInTheDocument()
  })

  it('never says which prerequisite matters most', () => {
    // That judgement is CIE's (ADR-0002). This lists; the navigator recommends.
    render(
      <StageReadiness stage="Architecture" prerequisites={prerequisitesFor(projection())} />,
    )

    expect(screen.queryByText(/most important|start with|first/i)).not.toBeInTheDocument()
  })
})
