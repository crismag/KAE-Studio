/**
 * No route may assert project content it cannot source.
 *
 * This is a source scan rather than a rendering test, and deliberately so. The
 * defect it guards against is not "the wrong thing appeared for some input" —
 * it is a sentence hard-coded into a component, which renders identically for
 * every project and therefore has no input that reveals it. A behavioural test
 * can only catch it by knowing in advance which project the fixture describes.
 *
 * What went wrong. `Workspace.tsx` stated a Core workflow of
 * "Draft → submit → approve or reject → publish" for every project, and named
 * "Report Management" and "Approval Workflow" as generatable packages — while
 * counting, correctly, the open decisions blocking the fixture module key
 * `MOD-APR`. Real derived data wrapped around invented names is the most
 * misleading form of this: the reader has no way to tell which half is real.
 * `Plan.tsx`, `Architecture.tsx` and `Dependencies.tsx` carried matching prose
 * about a dependency between two modules and an undecided authority model
 * `OD-011`.
 *
 * The ecosystem's founding rule is that inference must never pass as fact.
 * Fiction passing as fact is the same failure with less excuse.
 *
 * Fixtures themselves are legitimate — the mock service layer exists to hold
 * them, and this scan covers only what ships to a live project.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Vocabulary belonging to the prototype's Ministry Reporting fixture. None of
 * it can be derived from a projection, so any occurrence outside the mock layer
 * is a component asserting a project that does not exist.
 */
const FIXTURE_VOCABULARY = [
  'Approval Workflow',
  'Identity and Access',
  'Report Management',
  'MOD-APR',
  'OD-011',
  'Draft → submit → approve or reject → publish',
]

const ROUTES = join(__dirname)

function routeSources(): { file: string; text: string }[] {
  return readdirSync(ROUTES)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((file) => ({ file, text: readFileSync(join(ROUTES, file), 'utf8') }))
}

describe('routes assert nothing they cannot source', () => {
  it.each(FIXTURE_VOCABULARY)('no route states %j as this project’s content', (phrase) => {
    const offending = routeSources()
      .filter(({ text }) =>
        // Occurrences inside a comment are the record of what was removed and
        // why. Stripping them first keeps that history writable without
        // weakening the check on anything the user can see.
        text
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
          .includes(phrase),
      )
      .map(({ file }) => file)

    expect(offending).toEqual([])
  })
})
