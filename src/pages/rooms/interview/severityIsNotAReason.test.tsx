/**
 * `D-17` — a field's name may not promise more than its content carries.
 *
 * Found by `G1`, the re-scan that asks of a shipping surface: *what would a
 * user believe here, and is it true?*
 *
 * `OpenDecision.whyItMatters` rendered under every open question, in the
 * position an interface reserves for the reason something matters. The live
 * adapter filled it with `` `Severity: ${q.severity}` ``. Nothing was invented
 * — the severity is real, and Memory grades every clarification candidate. It
 * answered a different question from the one the label asked, and the reader
 * closed the gap.
 *
 * The smaller relative of `AUD-009`, where every requirement carried an
 * attention-toned *"Not verified by any test"* produced by an absent
 * capability. Same shape, and the reason this file exists rather than a commit
 * message: the next person to want a sentence under a question will find one
 * cheap way to produce it, and these say why not to.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SeverityBadge } from '@/components/project/SeverityBadge'
import { openDecisions } from '@/services/mock/fixtures/ministryReporting'
import type { OpenDecision } from '@/domain/types'

describe('a severity is rendered as a severity', () => {
  it('shows the grade Memory sent, and nothing around it', () => {
    render(<SeverityBadge severity="major" />)

    const badge = screen.getByText('major')
    // Not "Severity: major", and not a sentence built around the word. Either
    // would be this component narrating a grade it was only asked to show.
    expect(badge.textContent).toBe('major')
  })

  it('reserves the attention tone for the one grade that means stop', () => {
    const { container: critical } = render(<SeverityBadge severity="critical" />)
    const { container: major } = render(<SeverityBadge severity="major" />)

    // A panel where every question is toned for attention has no way left to
    // say which one actually is.
    expect(critical.firstElementChild?.className).toContain('attention')
    expect(major.firstElementChild?.className).not.toContain('attention')
  })

  it('shows a grade it has never heard of rather than deciding it is minor', () => {
    // Memory owns this vocabulary and may extend it. A component that silently
    // maps an unknown grade to a quiet tone is a claim it has no basis for.
    render(<SeverityBadge severity="catastrophic" />)

    expect(screen.getByText('catastrophic')).toBeInTheDocument()
  })
})

describe('no surface carries a reason KAE does not have', () => {
  it('an open decision has no free-text explanation to render', () => {
    // The structural half. As long as the type has no reason-shaped field,
    // no surface can render one, and no adapter can be tempted to synthesise
    // it from whatever is nearby — which is exactly how `Severity: major`
    // came to sit where a reason belonged.
    const decision: OpenDecision = openDecisions[0]

    expect(decision).not.toHaveProperty('whyItMatters')
    expect(decision).not.toHaveProperty('rationale')
    expect(decision).not.toHaveProperty('explanation')
    expect(typeof decision.severity).toBe('string')
  })

  it('the fixture grades its decisions rather than writing prose the live path cannot', () => {
    // `647b10e` — a fixture that shows more than the product can produce
    // teaches the wrong thing about the product. Memory sends a grade; the
    // fixture sends a grade.
    for (const decision of openDecisions) {
      expect(decision.severity, `${decision.id} carries no severity`).toBeTruthy()
      // A grade is a word. A fixture writing a sentence here has quietly
      // reintroduced the field that was removed.
      expect(decision.severity.split(' ')).toHaveLength(1)
    }
  })
})
