/**
 * A machine identifier is never the first thing a person reads (`NAV-01` N4,
 * `D-98`).
 *
 * The live sweep found `/definition` — the page that explains what the project
 * *is* — opening each objective with `07975a71-5831-4a4f-b678-ea8c37ab49e2` in
 * the leftmost column, and `/memory` doing the same for all 180 statements.
 * Elsewhere: `question:partial_area:problem_and_value:-` above the question it
 * belongs to, `artifacts_not_configured` under a sentence that already said
 * what it says, and one review finding rendering **174 UUIDs** as a chip cloud
 * longer than the rest of the page combined.
 *
 * None of it is wrong. All of it is first.
 *
 * ## What these assert
 *
 * Not that identifiers disappear — they are how a person names one statement to
 * somebody else, and every one is still reachable. That the **sentence leads**,
 * and that a list of identifiers stops being a list once it stops helping.
 */

import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { QualityReview } from './rooms/review/QualityReview'
import type { ProjectReview } from '@/domain/types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function review(findings: ProjectReview['findings']): ProjectReview {
  return { available: true, reason: '', findings }
}

function ids(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `0313dea0-5334-402b-8dd3-${String(i).padStart(12, '0')}`,
  )
}

const finding = (over: Record<string, unknown>) =>
  ({
    kind: 'unconfirmed_knowledge',
    severity: 'major',
    areaKey: null,
    subjectKey: 'k',
    summary: 'Candidates await human review.',
    recommendedAction: '',
    knowledgeItemIds: [],
    ...over,
  }) as never

describe('identifiers stop being a list once they stop helping', () => {
  it('names the statements a contradiction is about', () => {
    /**
     * `D-37`, unchanged and deliberately preserved: *"supersede one item"*
     * names nothing without them, and an instruction a reader cannot locate is
     * not advice. Two identifiers are information.
     */
    render(<QualityReview review={review([finding({ knowledgeItemIds: ids(2) })])} />)

    for (const id of ids(2)) {
      expect(screen.getByText(id)).toBeInTheDocument()
    }
  })

  it('counts them instead, once there are too many to read', () => {
    // 174 UUIDs is not provenance, it is a wall wearing provenance's clothes.
    render(<QualityReview review={review([finding({ knowledgeItemIds: ids(174) })])} />)

    expect(screen.getByText(/About 174 statements, listed below\./)).toBeInTheDocument()
    expect(screen.queryByText(ids(174)[0])).not.toBeInTheDocument()
  })

  it('never renders a bare UUID as the first text of a finding', () => {
    const { container } = render(
      <QualityReview review={review([finding({ knowledgeItemIds: ids(174) })])} />,
    )

    const first = [...container.querySelectorAll('*')]
      .filter((el) => el.children.length === 0)
      .map((el) => (el.textContent ?? '').trim())
      .filter(Boolean)[0]

    expect(first).not.toMatch(UUID)
  })

  it('translates Memory area keys rather than printing them', () => {
    // `problem_and_value` beside a sentence that already names the area is a
    // machine word asking the reader to translate it.
    render(
      <QualityReview
        review={review([finding({ kind: 'partial_area', areaKey: 'problem_and_value' })])}
      />,
    )

    expect(screen.getByText(/problem and value/)).toBeInTheDocument()
    expect(screen.queryByText(/problem_and_value/)).not.toBeInTheDocument()
  })

  it('keeps the identifier reachable when it stops being visible', () => {
    // Removed from the line, not from the page. Support still needs it.
    const { container } = render(
      <QualityReview review={review([finding({ knowledgeItemIds: ids(174) })])} />,
    )
    const group = within(container)

    expect(group.getByText(/174 statements/)).toBeInTheDocument()
  })
})
