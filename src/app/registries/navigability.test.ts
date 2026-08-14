/**
 * A primary destination can be operated (`NAV-01`, `D-95`).
 *
 * The live sweep counted the interactive controls on all fourteen routes with a
 * real project loaded. Six of them — Definition, Modules, Architecture,
 * Dependencies, Plan, Memory — had **two buttons each, and both belonged to the
 * shell**. Nothing on those pages could be operated. They sat in the sidebar
 * with the same weight as the four rooms where work happens, so a first-time
 * reader met fourteen equal choices and no way to tell which four were the
 * product.
 *
 * These assert the grouping stays a rule rather than a one-time tidy: the
 * primary list stays short, nothing is deleted to achieve that, and every
 * grouped page is still reachable at the path it always had.
 */

import { describe, expect, it } from 'vitest'

import { REDIRECTS, SURFACES, surfacesInGroup } from './rooms'
import { ROUTES } from './routes'

describe('the navigation has a shape a person can hold', () => {
  it('offers five primary destinations', () => {
    /**
     * Not "few". Five, because the number is the point — one home and the four
     * places work happens. A sixth is a decision somebody has to defend, and
     * this is where they will meet it.
     */
    expect(surfacesInGroup('primary').map((s) => s.id)).toEqual([
      'dashboard',
      'interview',
      'sources',
      'review',
      'deliverables',
    ])
  })

  it('puts every surface in exactly one group', () => {
    const grouped = [
      ...surfacesInGroup('primary'),
      ...surfacesInGroup('understanding'),
      ...surfacesInGroup('settings'),
    ]

    expect(grouped).toHaveLength(SURFACES.length)
    expect(new Set(grouped.map((s) => s.id)).size).toBe(SURFACES.length)
  })

  it('deletes nothing to achieve the shorter list', () => {
    /**
     * `§18`'s guardrail, and the whole difference between grouping and
     * removing. Every route still resolves; a bookmark into Architecture from
     * six weeks ago still lands on Architecture.
     */
    expect(ROUTES).toHaveLength(SURFACES.length)

    for (const surface of SURFACES) {
      expect(ROUTES.some((route) => route.surface.id === surface.id)).toBe(true)
      // And nothing was quietly turned into a redirect instead.
      expect(REDIRECTS.some((redirect) => redirect.from === surface.route)).toBe(false)
    }
  })

  it('keeps ordering in the registry, so the sidebar cannot disagree with it', () => {
    // `surfacesInGroup` filters rather than re-sorts. A second ordering array in
    // the shell would be the fourth place surface identity lives, which is what
    // this registry exists to have replaced.
    const order = SURFACES.map((s) => s.id)
    for (const group of ['primary', 'understanding', 'settings'] as const) {
      const ids = surfacesInGroup(group).map((s) => s.id)
      const positions = ids.map((id) => order.indexOf(id))
      expect(positions).toEqual([...positions].sort((a, b) => a - b))
    }
  })

  it('reviews comes before deliverables, because you accept before you package', () => {
    const primary = surfacesInGroup('primary').map((s) => s.id)

    expect(primary.indexOf('review')).toBeLessThan(primary.indexOf('deliverables'))
  })

  it('still says why every grouped surface cannot do more', () => {
    // Grouping does not excuse a page from `§16`. A reader who opens
    // Understanding and finds Modules is owed the same sentence they were owed
    // when it sat in the primary list.
    for (const surface of surfacesInGroup('understanding')) {
      if (surface.readiness === 'live') continue
      expect(surface.limit ?? '').not.toBe('')
    }
  })
})
