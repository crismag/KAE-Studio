/**
 * A shape in the contract that nothing names is not a plan, it is a claim.
 *
 * `D-188`. `MemoryRecord` sat in `types.ts` from the prototype commit to this
 * one: neither adapter filled it, no surface read it, no other shape composed
 * it. It cost nothing to run and it read, to anyone scanning the file, as a
 * memory view Studio was partway to having. It was not.
 *
 * The deletion is worth little by itself. What the defect showed is that the
 * contract can carry a shape nothing names for the whole life of the repository
 * without anything saying so — so the scan that found it stays.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const CONTRACT = join(SRC, 'domain/types.ts')

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(path))
    else if (['.ts', '.tsx'].includes(extname(entry.name))) found.push(path)
  }
  return found
}

/** Names exported as `interface` or `type` from the contract. */
function exportedShapes(contract: string): string[] {
  return [...contract.matchAll(/^export (?:interface|type) (\w+)/gm)].map((match) => match[1])
}

/** Occurrences of an identifier as a whole word, across the estate's sources. */
function timesNamed(name: string, files: string[]): number {
  const word = new RegExp(`\\b${name}\\b`, 'g')
  return files.reduce(
    (total, path) => total + (readFileSync(path, 'utf8').match(word) ?? []).length,
    0,
  )
}

describe('the shared contract', () => {
  it('exports no shape that only its own declaration names', () => {
    const contract = readFileSync(CONTRACT, 'utf8')
    const files = sourceFiles(SRC)
    const shapes = exportedShapes(contract)
    expect(shapes.length).toBeGreaterThan(50)

    const unnamed = shapes.filter((shape) => timesNamed(shape, files) < 2)
    expect(unnamed).toEqual([])
  })
})
