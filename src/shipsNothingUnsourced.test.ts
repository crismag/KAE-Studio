/**
 * Nothing that ships may assert project content it cannot source.
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
 *
 * ## Why it moved and widened, 2026-08-10
 *
 * It used to live in `src/app/routes/` and read `readdirSync(__dirname)`, so it
 * saw route files and nothing else. The `VC-` rapid experience tracks fill
 * `src/components/` with surfaces built against fixtures first, which is
 * exactly the directory the old scan could not see — and exactly the working
 * style that produced the original defect. A guard that cannot see the code
 * most likely to break it is not a guard.
 *
 * Two checks now, because the first alone does not scale. `FIXTURE_VOCABULARY`
 * is hand-kept, so it is complete only for fixtures somebody remembered to add
 * to it; one fixture per track makes that a list nobody can trust. The import
 * rule needs no vocabulary at all and holds for fixtures not yet written.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname)

/** The one place fixtures are allowed to be named, imported and read. */
const MOCK_LAYER = 'services/mock'

/**
 * Vocabulary belonging to the prototype's Ministry Reporting fixture. None of
 * it can be derived from a projection, so any occurrence outside the mock layer
 * is a component asserting a project that does not exist.
 *
 * **Additive only, and not the load-bearing check.** A new fixture whose
 * vocabulary nobody adds here is invisible to this list, which is why
 * `nothing outside the mock layer imports a fixture` exists below.
 */
const FIXTURE_VOCABULARY = [
  'Approval Workflow',
  'Identity and Access',
  'Report Management',
  'MOD-APR',
  'OD-011',
  'Draft → submit → approve or reject → publish',
]

interface Source {
  file: string
  text: string
}

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      walk(path, found)
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(path)
    }
  }
  return found
}

/**
 * Everything that can reach a live bundle: all of `src/` except the mock layer
 * itself and the tests. Test files are excluded because a test naming fixture
 * vocabulary is asserting against it, which is the opposite of the defect.
 */
function shippingSources(): Source[] {
  return walk(SRC)
    .map((path) => ({ file: relative(SRC, path), text: readFileSync(path, 'utf8') }))
    .filter(({ file }) => !file.startsWith(MOCK_LAYER))
}

/** Comments are the record of what was removed and why; the user never sees them. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('what ships asserts nothing it cannot source', () => {
  it('scans more than the routes directory', () => {
    // The widening is the point of this file, so it is asserted rather than
    // assumed. A refactor that quietly narrowed the scan back to routes would
    // otherwise leave every test below passing over almost nothing.
    const files = shippingSources().map((s) => s.file)

    expect(files.some((f) => f.startsWith('components/'))).toBe(true)
    // `pages/`, not `app/routes/`. `STAGE-2b` moved every page into a Room or
    // page folder, so `app/routes/` now holds only tests and this assertion
    // stopped being true of a directory that had stopped having pages in it.
    //
    // The claim is unchanged — the scan must reach the surfaces a person sees —
    // and it is re-anchored to where they now live rather than relaxed.
    expect(files.some((f) => f.startsWith('pages/'))).toBe(true)
    expect(files.some((f) => f.startsWith('services/live/'))).toBe(true)
    expect(files.every((f) => !f.startsWith(MOCK_LAYER))).toBe(true)
  })

  it.each(FIXTURE_VOCABULARY)('nothing shipping states %j as this project’s content', (phrase) => {
    const offending = shippingSources()
      .filter(({ text }) => withoutComments(text).includes(phrase))
      .map(({ file }) => file)

    expect(offending).toEqual([])
  })

  it('nothing outside the mock layer imports a fixture', () => {
    // The check that does not need a vocabulary, and therefore the one that
    // holds for fixtures nobody has written yet. A surface built fixture-first
    // is fine; a surface that still reaches for the fixture when it ships is
    // the defect, and this catches it whatever the fixture happens to say.
    const offending = shippingSources()
      .filter(({ text }) => /from\s+['"][^'"]*services\/mock\/fixtures/.test(withoutComments(text)))
      .map(({ file }) => file)

    expect(offending).toEqual([])
  })
})
