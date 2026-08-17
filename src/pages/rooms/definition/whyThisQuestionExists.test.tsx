/**
 * `D-190` — the last of `CONTRACT-UNREAD`'s four fields.
 *
 * `findingKind` arrived on every unknown and reached nobody: the row rendered
 * the question, a grade and a disposition, and drew an area with nothing in it
 * exactly like a blocker somebody raised. Memory records four askable kinds and
 * they are four different situations.
 *
 * The kind is not a rationale — `WHY-1` is still open — so the assertions here
 * are about a caveat beside the question, never a replacement for it.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreliminaryContextPanel } from './PreliminaryContextPanel'
import { ASKABLE_FINDING_KINDS, readableFindingKind } from './findingKinds'
import * as fixture from '@/services/mock/fixtures/ministryReporting'
import type { PreliminaryContext, UnknownEntry } from '@/domain/types'

function unknown(overrides: Partial<UnknownEntry> = {}): UnknownEntry {
  return {
    clarificationId: 'question:missing_area:approval:-',
    question: 'Which role holds approval authority?',
    areaKey: 'approval',
    severity: 'critical',
    findingKind: 'missing_area',
    material: true,
    disposition: 'open',
    ...overrides,
  }
}

function preliminary(entry: UnknownEntry): PreliminaryContext {
  return {
    composed: true,
    isPreliminary: true,
    statedVerbatim: [],
    assumed: [],
    materialUnknowns: [entry],
    deferrableUnknowns: [],
    warnings: [],
  }
}

describe('an undecided question says what kind of gap it came from', () => {
  it('names the kind beside the question', () => {
    render(<PreliminaryContextPanel preliminary={preliminary(unknown())} />)

    expect(screen.getByText(/nothing recorded here yet/i)).toBeInTheDocument()
  })

  it('tells two kinds apart rather than drawing them alike', () => {
    const { unmount } = render(<PreliminaryContextPanel preliminary={preliminary(unknown())} />)
    unmount()
    render(
      <PreliminaryContextPanel
        preliminary={preliminary(unknown({ findingKind: 'open_blocker' }))}
      />,
    )

    expect(screen.getByText(/a blocker somebody raised/i)).toBeInTheDocument()
    expect(screen.queryByText(/nothing recorded here yet/i)).not.toBeInTheDocument()
  })

  it('keeps the question itself the thing a person reads', () => {
    render(<PreliminaryContextPanel preliminary={preliminary(unknown())} />)

    expect(screen.getByText('Which role holds approval authority?')).toBeInTheDocument()
  })

  it('renders no label for a kind it does not recognise', () => {
    // A default word here would be `D-28`: something renders, and it is wrong
    // rather than absent, beside a question somebody is about to act on.
    render(<PreliminaryContextPanel preliminary={preliminary(unknown({ findingKind: 'sr-42' }))} />)

    expect(readableFindingKind('sr-42')).toBeNull()
    expect(screen.getByText('Which role holds approval authority?')).toBeInTheDocument()
    expect(screen.queryByText(/sr-42/)).not.toBeInTheDocument()
  })
})

describe('the fixture speaks Memory’s vocabulary', () => {
  it('carries no kind Memory cannot produce', () => {
    // It carried `missing_decision`, which is in no Memory enum. The mock is
    // the only place this panel can be developed against, so a word invented
    // here is a vocabulary the product does not speak (`D-190`).
    const kinds = [
      ...fixture.preliminary.materialUnknowns,
      ...fixture.preliminary.deferrableUnknowns,
    ].map((entry) => entry.findingKind)

    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) expect(ASKABLE_FINDING_KINDS).toContain(kind)
  })
})
