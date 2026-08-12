/**
 * The registries are only worth having if something checks them.
 *
 * `§13` asks for one route registry and one Room registry so that navigation
 * identity is not duplicated across unrelated files. A registry nobody verifies
 * is a fourth place for identity to live, which is worse than the three it
 * replaced.
 *
 * These assert the properties that make it a single source: ids are unique,
 * routes are unique, every entry renders something, every entry the navigation
 * offers exists, and — the one that matters most — **an unavailable surface
 * says why.**
 */

import { describe, expect, it } from 'vitest'

import { ROUTES } from './routes'
import { REDIRECTS, ROOMS, SURFACES, surfaceById, surfaceByRoute } from './rooms'

describe('the surface registry is a single source of identity', () => {
  it('has a unique id per surface', () => {
    const ids = SURFACES.map((surface) => surface.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a unique route per surface', () => {
    const routes = SURFACES.map((surface) => surface.route)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('gives every surface a page that renders it', () => {
    // `routes.tsx` throws at module load for a surface with no page, so
    // importing ROUTES at all is half this assertion. The count is the other
    // half: a page silently dropped would shorten the list.
    expect(ROUTES).toHaveLength(SURFACES.length)
  })

  it('routes with a leading slash and paths without one', () => {
    // The registry speaks in what a person sees; the router wants a relative
    // path. Getting this wrong produces `//sources`, which resolves and looks
    // almost right.
    for (const { surface, path } of ROUTES) {
      expect(surface.route.startsWith('/')).toBe(true)
      expect(path.startsWith('/')).toBe(false)
      expect(`/${path}`).toBe(surface.route)
    }
  })

  it('can be looked up by id and by route', () => {
    for (const surface of SURFACES) {
      expect(surfaceById(surface.id)).toBe(surface)
      expect(surfaceByRoute(surface.route)).toBe(surface)
    }
  })

  it('returns nothing for a surface that does not exist', () => {
    // Rather than a default. A lookup that invents an entry would let a
    // Dashboard card point at a Room nobody built.
    expect(surfaceById('does-not-exist')).toBeUndefined()
    expect(surfaceByRoute('/does-not-exist')).toBeUndefined()
  })
})

describe('a surface that cannot do its job says why', () => {
  it('requires a limit wherever readiness is not live', () => {
    // `UXA-10`: no surface claims state it does not have. A Dashboard launcher
    // reading `awaiting-capability` has to be able to say what it is waiting
    // for *before* somebody clicks it — otherwise the page is a dead end with
    // good typography.
    const silent = SURFACES.filter(
      (surface) => surface.readiness !== 'live' && !surface.limit?.trim(),
    ).map((surface) => surface.id)

    expect(silent, 'these surfaces report a limit and do not name it').toEqual([])
  })

  it('does not put a limit on a surface that has none', () => {
    // The other direction. A standing caveat on a working page is a caveat
    // nobody reads, which spends the credibility the real ones need.
    const overclaiming = SURFACES.filter(
      (surface) => surface.readiness === 'live' && surface.limit,
    ).map((surface) => surface.id)

    expect(overclaiming).toEqual([])
  })

  it('gives every purpose a sentence', () => {
    for (const surface of SURFACES) {
      expect(surface.purpose.trim().length, `${surface.id} has no purpose`).toBeGreaterThan(10)
    }
  })
})

describe('Rooms are user intent, not backend services', () => {
  it('offers Rooms as a subset of surfaces', () => {
    expect(ROOMS.length).toBeGreaterThan(0)
    expect(ROOMS.every((room) => room.kind === 'room')).toBe(true)
  })

  it('has no Room named after a KAE service', () => {
    // `§8`: *"There should not be a Memory Room merely because KAE-Memory
    // exists, or an Artifacts Room merely because KAE-Artifacts exists."*
    const services = ['memory', 'artifacts', 'cie', 'studio']
    const named = ROOMS.filter((room) => services.includes(room.id)).map((room) => room.id)

    expect(named).toEqual([])
  })

  it('points every subflow at a Room that exists', () => {
    for (const surface of SURFACES) {
      if (!surface.partOf) continue
      const parent = surfaceById(surface.partOf)
      expect(
        parent,
        `${surface.id} belongs to "${surface.partOf}", which is not a surface`,
      ).toBeDefined()
      expect(parent?.kind, `${surface.id} belongs to a non-Room`).toBe('room')
    }
  })
})

describe('a merged surface keeps its path', () => {
  it('redirects every retired route somewhere that exists', () => {
    // `§18`: do not remove an old route until its replacement is verified. A
    // redirect pointing at a path no surface serves is the same broken link
    // with an extra hop.
    for (const redirect of REDIRECTS) {
      expect(
        surfaceByRoute(redirect.to),
        `${redirect.from} redirects to ${redirect.to}, which no surface serves`,
      ).toBeDefined()
    }
  })

  it('never redirects a path that is still a surface', () => {
    // Both would match, and which one wins depends on router ordering — a
    // route that works today and stops working when the array is sorted.
    for (const redirect of REDIRECTS) {
      expect(surfaceByRoute(redirect.from)).toBeUndefined()
    }
  })

  it('says why each path was retired', () => {
    // A redirect with no reason is one nobody can safely delete later, because
    // deleting it means knowing what it was for.
    for (const redirect of REDIRECTS) {
      expect(redirect.because.trim().length).toBeGreaterThan(10)
    }
  })
})
