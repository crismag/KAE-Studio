/**
 * `STAGE_6_ACTION_MODEL.md` describes the product, so it can go stale.
 *
 * The document records which of the directive's seven action entities reach a
 * person, which routing-envelope fields are carried, and — the load-bearing
 * claim — that **an implementation task does not exist anywhere**. Stage 6 gates
 * a board on exactly that, and `§19` gates it again: *add a board when Studio
 * has meaningful work items to manage.*
 *
 * A document making a claim about the product that quietly stops being true is
 * this estate's most repeated defect, and the reason `test_capability_matrix_is_current`
 * and `pagesHaveContracts` exist. This is the same guard for the same reason.
 *
 * It asserts the claims, not the prose: a rewrite that keeps the facts should
 * not fail, and a change that makes a fact false should.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const MODEL = readFileSync('docs/planning/STAGE_6_ACTION_MODEL.md', 'utf8')

/** Every shipping source file, so a claim can be checked against the code. */
function sources(dir = 'src', found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) sources(path, found)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      found.push(readFileSync(path, 'utf8'))
    }
  }
  return found
}

const CODE = sources().join('\n')

describe('the six entities it says reach a person still do', () => {
  // Named by the surface that owns each, because "the word appears somewhere"
  // is what made the first version of the vocabulary scan useless.
  const SURFACES: [string, string][] = [
    ['recommended action', 'NextAction'],
    ['blocker', 'Blockers'],
    ['review item', 'QualityReview'],
    ['open question', 'PreliminaryContextPanel'],
    ['gap', 'CoverageSection'],
  ]

  it.each(SURFACES)('%s is rendered by %s', (_entity, component) => {
    // The open paren matters. Without it `QualityReview` matches
    // `QualityReviewPanel`, and renaming the component away would pass — the
    // same substring flaw the vocabulary scan's first version had.
    expect(CODE).toContain(`export function ${component}(`)
  })
})

describe('the envelope fields it says are carried still are', () => {
  // Checked **in the adapter**, which is the layer that carries them. Asserting
  // the word exists anywhere in `src` passes on a type declaration alone, which
  // is a field nothing fills — the shape of half this run's findings.
  const ADAPTER = readFileSync('src/services/live/liveServices.ts', 'utf8')

  it('carries the entity ids a finding is about', () => {
    // `D-37`. The field that makes a contradiction's recommended action
    // followable rather than an instruction naming no subject.
    expect(ADAPTER).toContain('knowledgeItemIds:')
  })

  it('carries the blocking state', () => {
    // `D-33`. Two facts, never one score.
    expect(ADAPTER).toContain('implementationEligible:')
  })

  it('carries the revision each projection is pinned to', () => {
    expect(ADAPTER).toContain('memoryRevision')
  })
})

describe('the claim a board is gated on', () => {
  it('still says no implementation task exists', () => {
    // If this sentence is edited out, the guard below stops meaning anything —
    // so the document is required to keep making the claim it is checked on.
    expect(MODEL).toMatch(/\*\*An implementation task does not exist\.\*\*/i)
  })

  it('and no implementation task exists', () => {
    // The load-bearing fact. `§19`: add a board when Studio has meaningful work
    // items to manage. If something starts producing them, this fails and the
    // document — and the board question — get looked at again.
    expect(CODE).not.toMatch(/\bWorkItem\b|\bImplementationTask\b/)
  })
})
