/**
 * `D-30` — the review KAE-Memory computes reaches the Reviews room.
 *
 * `FindingKind` has eight members. Studio named one, and the one it named —
 * `agent_proposal` — is not in Memory's vocabulary at all: Studio invents it
 * from the proposed-statement list. `GET /v1/projects/{id}/review` computes
 * missing areas, partial areas, unclassified and unconfirmed knowledge, open
 * questions, unresolved contradictions, duplicate knowledge and open blockers,
 * each with a recommended action. The client called a neighbouring route and
 * never that one.
 *
 * These hold the three things the panel must not do: dress a diagnostic up as
 * something to accept, paraphrase an instruction, or render an unread review as
 * a clean bill of health.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { QualityReview } from './QualityReview'
import { review as fixture } from '@/services/mock/fixtures/ministryReporting'
import type { ProjectReview } from '@/domain/types'

const EMPTY: ProjectReview = { available: true, reason: '', findings: [] }

describe('a finding says what it is and what would close it', () => {
  it('shows the summary Memory wrote', () => {
    render(<QualityReview review={fixture} />)

    expect(screen.getByText(fixture.findings[0].summary)).toBeInTheDocument()
  })

  it('shows the recommended action verbatim', () => {
    // Memory writes the sentence that says what would make the finding
    // disappear. A paraphrase of an instruction is advice nobody can follow.
    render(<QualityReview review={fixture} />)

    for (const finding of fixture.findings) {
      expect(screen.getByText(finding.recommendedAction)).toBeInTheDocument()
    }
  })

  it('keeps the order Memory returned', () => {
    // Most severe first, which is the reason Memory bothers to sort. A panel
    // that re-sorted would answer a different question from the one asked.
    render(<QualityReview review={fixture} />)

    const rows = screen.getAllByRole('listitem').map((row) => row.textContent ?? '')
    expect(rows[0]).toContain(fixture.findings[0].summary)
    expect(rows[rows.length - 1]).toContain(fixture.findings[fixture.findings.length - 1].summary)
  })

  it('shows Memory`s kind, made readable rather than renamed', () => {
    render(<QualityReview review={fixture} />)

    expect(screen.getByText('open blocker')).toBeInTheDocument()
  })

  it('shows a grade it has never heard of rather than deciding it is minor', () => {
    render(
      <QualityReview
        review={{ ...EMPTY, findings: [{ ...fixture.findings[0], severity: 'catastrophic' }] }}
      />,
    )

    expect(screen.getByText('catastrophic')).toBeInTheDocument()
  })
})

describe('a diagnostic is not a gesture', () => {
  it('offers nothing to accept, refuse or dismiss', () => {
    // `ADR-0015`: findings are derived from state, not stored, so there is
    // nothing stable to address. Acting on one means changing the state that
    // produced it. A control here would be a button that either lies or writes
    // something nobody asked for.
    render(<QualityReview review={fixture} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})

describe('what it says when it has nothing', () => {
  it('does not call an unread review a clean project', () => {
    // The two look identical rendered bare, and one of them is an all-clear
    // nobody earned.
    render(
      <QualityReview
        review={{ available: false, reason: 'KAE-Memory returned 503.', findings: [] }}
      />,
    )

    expect(screen.getByText(/503/)).toBeInTheDocument()
    expect(screen.queryByText(/found nothing/i)).not.toBeInTheDocument()
  })

  it('says a completed review found nothing, and what it did not check', () => {
    // "Nothing found" without scope is an all-clear about the whole project.
    // This review checks coverage and consistency, not whether the idea is any
    // good.
    render(<QualityReview review={EMPTY} />)

    expect(screen.getByText(/found nothing/i)).toBeInTheDocument()
    expect(screen.getByText(/not whether the project is a good idea/i)).toBeInTheDocument()
  })
})
