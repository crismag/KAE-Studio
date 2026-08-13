/**
 * A page folder without a contract is a folder, not an architecture.
 *
 * `§13` asks for a `README.md` per major page/Room covering route, purpose,
 * owns, does not own, services, states and test entry points. That is a good
 * idea for about a month, and then one folder ships without one, and then the
 * rule is advisory.
 *
 * ## Why the "does not own" section is the load-bearing one
 *
 * Every heading here is checkable, but only one of them is hard to write and
 * therefore worth enforcing. *Owns* is a directory listing. **Does not own** is
 * a boundary somebody had to think about — and it is the section that stops a
 * Room absorbing work that belongs elsewhere, which is exactly how `/setup`
 * reached seven responsibilities.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const PAGES = join(process.cwd(), 'src/pages')

/** Every folder holding a page — `pages/<name>` and `pages/rooms/<name>`. */
function pageFolders(): string[] {
  if (!existsSync(PAGES)) return []
  const found: string[] = []
  for (const entry of readdirSync(PAGES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(PAGES, entry.name)
    if (entry.name === 'rooms') {
      for (const room of readdirSync(path, { withFileTypes: true })) {
        if (room.isDirectory()) found.push(join(path, room.name))
      }
      continue
    }
    found.push(path)
  }
  return found
}

/**
 * The directive's Stage 5 contract, in full.
 *
 * It gives nine fields and warns that *"a page is not considered converted
 * merely because its heading says `Room`."* This list checked **four** of them
 * — the ones somebody needed the day a page claimed no boundary — and never
 * grew to the template it was enforcing.
 *
 * `Contextual toolbelt` is the one both contracts were missing, and it is
 * `§9`'s entire subject: *actions specific to a task move into the current
 * Room*. It is the field that separates a Room from a page with a heading, so
 * a contract without it is not describing a Room (`D-47`).
 *
 * Matched on the heading text rather than the exact markdown, so a contract may
 * word its own sections — `Data it consumes` and `Data/projections` are the
 * same promise — while still having to make every promise.
 */
const REQUIRED = [
  'Purpose',
  'Route:',
  'Entry conditions',
  'Contextual toolbelt',
  'Exit conditions',
  'Owns',
  'Does **not** own',
]

describe('every page folder states its contract', () => {
  const folders = pageFolders()

  it('finds page folders to check', () => {
    // Guards the guard. An empty list would make every assertion below pass
    // vacuously, which is the failure mode of any test that iterates.
    expect(folders.length).toBeGreaterThan(0)
  })

  it.each(folders)('has a README in %s', (folder) => {
    expect(existsSync(join(folder, 'README.md'))).toBe(true)
  })

  it.each(folders)('covers the required headings in %s', (folder) => {
    const readme = readFileSync(join(folder, 'README.md'), 'utf8')
    const missing = REQUIRED.filter((heading) => !readme.includes(heading))

    expect(missing, `${folder} omits: ${missing.join(', ')}`).toEqual([])
  })

  it.each(folders)('says what it does not own in more than a word in %s', (folder) => {
    const readme = readFileSync(join(folder, 'README.md'), 'utf8')
    const section = readme.split('Does **not** own')[1]?.split('\n## ')[0] ?? ''

    // The section that is hard to write, and the one that stops a Room
    // absorbing work that belongs somewhere else — which is how `/setup`
    // reached seven responsibilities.
    expect(section.trim().length, `${folder} lists no boundary`).toBeGreaterThan(80)
  })
})
