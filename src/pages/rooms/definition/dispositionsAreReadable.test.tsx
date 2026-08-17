/**
 * `D-199` — *"Asked · assumed_for_generation"*, on the line a person reads.
 *
 * The panel exists to keep *somebody was asked and did not decide* visible, and
 * it said so in KAE-Memory's field values. Same rule as `findingKinds.ts`:
 * whoever renders a key makes it readable, and a key absent from the table
 * renders nothing rather than a guess.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PreliminaryContextPanel } from './PreliminaryContextPanel'
import { readableDisposition } from './questionDispositions'
import type { PreliminaryContext, UnknownEntry } from '@/domain/types'

function unknown(disposition: string): UnknownEntry {
  return {
    clarificationId: 'm-7',
    question: 'Which role holds approval authority?',
    areaKey: 'approval',
    severity: 'critical',
    findingKind: 'missing_area',
    material: true,
    disposition,
  }
}

function panel(disposition: string) {
  const preliminary: PreliminaryContext = {
    composed: true,
    isPreliminary: true,
    statedVerbatim: [],
    assumed: [],
    materialUnknowns: [unknown(disposition)],
    deferrableUnknowns: [],
    warnings: [],
  }
  return render(<PreliminaryContextPanel preliminary={preliminary} />)
}

describe('what happened to a question, in words', () => {
  it('says a choice KAE made for itself in a sentence, not a key', () => {
    panel('assumed_for_generation')

    expect(screen.getByText(/KAE assumed an answer/)).toBeInTheDocument()
    expect(screen.queryByText(/assumed_for_generation/)).not.toBeInTheDocument()
  })

  it('keeps the two KAE-chose dispositions apart', () => {
    panel('delegated')

    expect(screen.getByText(/left to KAE to choose/)).toBeInTheDocument()
    expect(screen.queryByText(/KAE assumed an answer/)).not.toBeInTheDocument()
  })

  it('still separates asked-and-undecided from never asked', () => {
    const { unmount } = panel('open')
    expect(screen.getByText(/not yet asked/i)).toBeInTheDocument()
    unmount()

    panel('deferred')
    expect(screen.getByText(/asked · set aside for now/i)).toBeInTheDocument()
    expect(screen.queryByText(/not yet asked/i)).not.toBeInTheDocument()
  })

  it('says only that it was asked when the word is one it does not know', () => {
    // A settled disposition cannot reach this panel, and a word that did would
    // be a vocabulary change worth noticing rather than paraphrasing (`D-28`).
    panel('answered')

    expect(readableDisposition('answered')).toBeNull()
    expect(screen.getByText('Asked')).toBeInTheDocument()
    expect(screen.queryByText(/answered/)).not.toBeInTheDocument()
  })
})
