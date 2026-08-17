/**
 * The drawing does not leave out a module-to-module edge without saying so.
 *
 * `D-219`. `ModuleRelation` has six members and the diagram drew one, through a
 * filter comparing against `depends_on`. The file's docstring justified the
 * exclusion for two of the other five — *"`satisfies` and `verified_by` run to
 * statements rather than modules and have no node to point at"* — and that
 * reasoning is right and does not reach `owns`, `exposes` or `consumes`, each of
 * which runs module to module and has a box at both ends. Those three were
 * dropped without a word.
 *
 * `ARC-EDGE-KINDS` recorded this as latent on the grounds that nothing could
 * write such an edge. The producibility check was run against
 * `ModuleService.record_edge`, which does not exist; the method is `relate`, and
 * `kae_relate_modules` has called it from MCP since the tool was registered. The
 * edges are writable, `GET /modules/graph` transmits them verbatim, and the
 * textual half at `/dependencies` already lists them under *Other
 * relationships*. Only the picture was silent — so the two views disagreed,
 * which the diagram's own docstring says would be worse than having one.
 *
 * Drawing them needs a ruling about what a second line style may mean. Saying
 * they exist does not, and the omission is the part that misleads: a drawing
 * that leaves something out without a word is read as a complete drawing.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ArchitectureDiagram } from './ArchitectureDiagram'
import { DRAWN, NOT_DRAWABLE, UNDRAWN_STRUCTURAL } from './drawnRelations'
import { MEMORY_MODULE_RELATIONS } from '@/domain/memorysVocabulary'
import type { ArchitectureGraph } from '@/domain/types'

/** Two modules, so every relation under test has a box at both ends. */
function graphWith(relation: string, targetKnowledge: string | null = null): ArchitectureGraph {
  return {
    available: true,
    reason: '',
    modules: [
      { key: 'ledger', name: 'Ledger', summary: '', status: 'confirmed' },
      { key: 'billing', name: 'Billing', summary: '', status: 'confirmed' },
    ],
    edges: [
      {
        source: 'billing',
        relation,
        targetModule: targetKnowledge ? null : 'ledger',
        targetKnowledge,
      },
    ],
    buildOrder: ['ledger', 'billing'],
    note: '',
  }
}

describe('the filter accounts for every relation KAE-Memory has', () => {
  it('partitions the vocabulary rather than comparing against one word', () => {
    // The `D-213` shape, refused in advance: a seventh relation added upstream
    // would fail the `depends_on` comparison and vanish, failing nothing. It
    // fails here instead, in the file that decides what to do with it.
    expect([...DRAWN, ...NOT_DRAWABLE, ...UNDRAWN_STRUCTURAL].sort()).toEqual(
      [...MEMORY_MODULE_RELATIONS].sort(),
    )
  })

  it('puts each relation in exactly one part, because the parts are reasons', () => {
    const all = [...DRAWN, ...NOT_DRAWABLE, ...UNDRAWN_STRUCTURAL]

    expect(new Set(all).size).toBe(all.length)
  })
})

describe('an edge the picture does not draw is named', () => {
  it.each(UNDRAWN_STRUCTURAL)('says the project records %s', (relation) => {
    render(<ArchitectureDiagram graph={graphWith(relation)} />)

    expect(screen.getByText(new RegExp(`also records[^.]*${relation}`, 'i'))).toBeInTheDocument()
  })

  it('names only the relations this project actually has', () => {
    render(<ArchitectureDiagram graph={graphWith('owns')} />)

    const note = screen.getByText(/also records/i).textContent ?? ''
    expect(note).toContain('owns')
    expect(note).not.toContain('exposes')
    expect(note).not.toContain('consumes')
  })

  it('still draws no arrow for it, so saying so is not drawing it', () => {
    // The opposite mistake, and the worse one: an `owns` arrow among
    // `depends_on` arrows draws a build order that is not one, and
    // `layersFrom` would lay it out confidently.
    const { container } = render(<ArchitectureDiagram graph={graphWith('owns')} />)

    expect(container.querySelectorAll('line')).toHaveLength(0)
  })
})

describe('the note is about edges that exist, not a standing disclaimer', () => {
  it('says nothing when the project records only dependencies', () => {
    render(<ArchitectureDiagram graph={graphWith('depends_on')} />)

    expect(screen.queryByText(/also records/i)).not.toBeInTheDocument()
  })

  it.each(NOT_DRAWABLE)('says nothing for %s, which has no box to point at', (relation) => {
    // Already argued for when the file was written. Naming these would tell a
    // reader something is missing from a picture that could never hold it.
    render(<ArchitectureDiagram graph={graphWith(relation, 'k-1')} />)

    expect(screen.queryByText(/also records/i)).not.toBeInTheDocument()
  })
})
