/**
 * A hook no surface calls is a capability the product does not have.
 *
 * `useArtifactContent` says, in its own docstring, that it reads a generated
 * document *"so a person can read before approving"*. No component calls it,
 * so nobody reads anything before approving — the sentence describes an
 * intention rather than the product, which is `D-32`'s shape in a hook.
 *
 * Finding that costs a `G3` pass every time, and a pass answers only for the
 * day it is run: the register below answers by construction. A new unreached
 * hook fails this test until somebody either calls it or writes down why it is
 * here, and a registered hook that gains a caller fails it too — an entry
 * describing a solved problem is how a register starts lying.
 *
 * What this deliberately does not do is decide whether those surfaces should
 * exist. Whether approval is meant to be content-level is a product question
 * (`ART-HOOKS-UNCALLED`) and it is the owner's.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const HOOKS = join(SRC, 'hooks/useProject.ts')

/**
 * Hooks nothing calls, and the reason each is still here.
 *
 * A reason is not an excuse: every line of it should say what would have to be
 * decided or built for the entry to go away.
 */
const UNREACHED: Record<string, string> = {
  useArtifactContent:
    'Reads one generated document. Nothing renders artifact content because ' +
    'whether approval is content-level rather than path-level is undecided — ' +
    'ART-HOOKS-UNCALLED, and the owner’s.',
  useProvenance:
    'Reads a publication’s provenance. The same undecided question one hop ' +
    'later: what a person may inspect about a publication after it lands.',
  useConnections:
    'AUD-005 connections, D-22. /api/connections is kept deliberately and no ' +
    'page reads it, because nothing yet verifies the replacement that would ' +
    'let it go.',
  useAddConnection: 'The write half of useConnections, unreached for the same reason.',
  useCheckConnectivity: 'The probe half of useConnections, unreached for the same reason.',
}

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(path))
    else if (['.ts', '.tsx'].includes(extname(entry.name))) found.push(path)
  }
  return found
}

/**
 * Whether anything outside the hook module names it.
 *
 * Tests are excluded on purpose. A hook exercised only by its own test is
 * reached by nobody a person can see, which is the state this checks for.
 */
function reachedBySomething(name: string, files: string[]): boolean {
  const word = new RegExp(`\\b${name}\\b`)
  return files.some((path) => word.test(readFileSync(path, 'utf8')))
}

describe('the project hooks', () => {
  const exported = [...readFileSync(HOOKS, 'utf8').matchAll(/^export function (use\w+)/gm)].map(
    (match) => match[1],
  )
  const callers = sourceFiles(SRC).filter((path) => path !== HOOKS && !/\.test\.tsx?$/.test(path))

  it('exports enough hooks for this to be measuring something', () => {
    expect(exported.length).toBeGreaterThan(20)
    expect(callers.length).toBeGreaterThan(20)
  })

  it('has every hook called by a surface, or written down as not called', () => {
    const unreached = exported.filter((name) => !reachedBySomething(name, callers))
    expect(unreached.sort()).toEqual(Object.keys(UNREACHED).sort())
  })

  it('registers no hook that something now calls', () => {
    const stale = Object.keys(UNREACHED).filter((name) => reachedBySomething(name, callers))
    expect(stale).toEqual([])
  })
})
