/**
 * `D-33` — the marking `D-32` promised is visible.
 *
 * Correcting `D-32` left a smaller version of the same defect. The Dashboard
 * says a package generated with a critical blocker standing will be *marked not
 * ready for implementation* — and that marking appeared nowhere in Studio.
 *
 * KAE-Memory computes `draft_eligible` and `implementation_eligible`. Studio's
 * `_health` mapped percentage, status and areas and dropped both, so the one
 * honest thing about generating early — **the output will say what it is** —
 * had never been visible to the person deciding whether to generate.
 *
 * Promising a marking nobody can see is a smaller lie than promising a refusal
 * that does not exist. It is the same lie.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { FitFor } from './FitFor'
import type { ProjectHealth } from '@/domain/types'

function health(over: Partial<ProjectHealth>): ProjectHealth {
  return {
    phase: 'discovering',
    summary: '',
    draftEligible: false,
    implementationEligible: false,
    coverage: [],
    blockingDecisionIds: [],
    recommendedNext: [],
    ...over,
  } as ProjectHealth
}

describe('two facts, not one score', () => {
  it('answers both questions separately', () => {
    // Most projects sit between them for a long time, and that gap is the
    // readiness model's whole subject.
    render(<FitFor health={health({ draftEligible: true, implementationEligible: false })} />)

    expect(screen.getByText(/enough is established to draft from/i)).toBeInTheDocument()
    expect(screen.getByText(/not safe to build from/i)).toBeInTheDocument()
  })

  it('carries no percentage', () => {
    // `ADR-0003`, for the reason it ruled setup: a percentage over two booleans
    // says less than the booleans.
    const { container } = render(
      <FitFor health={health({ draftEligible: true, implementationEligible: true })} />,
    )

    expect(container.textContent).not.toMatch(/%|\d+\s*percent/i)
  })

  it('does not report a project as buildable because it is draftable', () => {
    render(<FitFor health={health({ draftEligible: true, implementationEligible: false })} />)

    expect(screen.queryByText(/safe to build from —/i)).not.toBeInTheDocument()
  })

  it('says so when both hold', () => {
    render(<FitFor health={health({ draftEligible: true, implementationEligible: true })} />)

    expect(screen.getByText(/safe to build from —/i)).toBeInTheDocument()
  })
})

describe('it states, and does not stop', () => {
  it('says a package can still be produced', () => {
    // `D-32`: nothing in the estate refuses on these flags. Saying "you cannot"
    // here would be the claim that had to be withdrawn, made a second time.
    render(<FitFor health={health({ implementationEligible: false })} />)

    expect(screen.getByText(/can still be produced/i)).toBeInTheDocument()
  })

  it('never says generation is prevented', () => {
    const { container } = render(<FitFor health={health({})} />)

    expect(container.textContent).not.toMatch(/will not generate|cannot generate|blocked from/i)
  })
})
