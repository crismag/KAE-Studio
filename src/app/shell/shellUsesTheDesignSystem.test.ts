/**
 * The first screens a person sees must look like the product behind them.
 *
 * `SignInGate` and `ProjectGate` are what a live user meets before anything
 * else, and they were built with inline `style={{}}` objects and hand-rolled
 * inputs while the rest of Studio used a design system. Two screens in a
 * different visual language, in the position where a product makes its first
 * claim about itself.
 *
 * ## Why a test rather than a note
 *
 * Because the same thing will happen again. A gate is written in a hurry, in
 * isolation, usually while debugging something else — and it never comes back
 * through review with the rest of the shell. The rule is cheap to state and
 * cheap to check, so it is checked.
 *
 * ## And one that has already bitten
 *
 * `text-danger` was used in `AppShell` and **no `--color-danger` token exists**;
 * the semantic family is `blocking`. Those spans rendered at inherited colour
 * for as long as they existed — the failure mode of a utility class that looks
 * plausible, which no type checker and no linter can see.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SHELL = join(process.cwd(), 'src/app/shell')
const GATES = ['SignInGate.tsx', 'ProjectGate.tsx']

function read(file: string): string {
  return readFileSync(join(SHELL, file), 'utf8')
}

describe('the gates use the design system', () => {
  it.each(GATES)('has no inline style objects in %s', (file) => {
    // `style={{` — the tell. A gate that styles itself is a gate that drifts
    // from everything else the moment a token changes.
    expect(read(file)).not.toMatch(/style=\{\{/)
  })

  it.each(GATES)('uses the shared primitives in %s', (file) => {
    const source = read(file)
    expect(source).toMatch(/from '@\/components\/ui\/(primitives|form)'/)
  })

  it.each(GATES)('hand-rolls no bare input or textarea in %s', (file) => {
    const source = read(file)
    // `<input` and `<textarea` without the shared components means a control
    // labelled by proximity rather than by `htmlFor`, which looks identical and
    // is not the same for anybody using a screen reader.
    expect(source).not.toMatch(/<input\s/)
    expect(source).not.toMatch(/<textarea\s/)
  })
})

describe('no utility class names a token that does not exist', () => {
  it('defines every colour utility the shell uses', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')
    const declared = new Set(
      [...tokens.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1]),
    )

    const families = ['text', 'bg', 'border', 'ring', 'fill', 'stroke']
    const used = new Set<string>()
    for (const file of [...GATES, 'AppShell.tsx']) {
      const source = read(file)
      for (const family of families) {
        for (const match of source.matchAll(new RegExp(`\\b${family}-([a-z][a-z0-9-]*)\\b`, 'g'))) {
          used.add(match[1])
        }
      }
    }

    // Tailwind's own scale is legitimate; only names that look like ours and
    // are not ours are the defect. `danger` was exactly this.
    const ours = [
      'canvas',
      'surface',
      'line',
      'ink',
      'accent',
      'confirmed',
      'attention',
      'blocking',
      'pending',
      'danger',
    ]
    const invented = [...used].filter(
      (name) =>
        ours.some((prefix) => name === prefix || name.startsWith(`${prefix}-`)) &&
        !declared.has(name),
    )

    expect(invented, 'these classes name a token that does not exist').toEqual([])
  })
})
