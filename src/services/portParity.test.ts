/**
 * Every port has both implementations, and they answer the same calls.
 *
 * ## The failure this catches
 *
 * A surface can be built entirely against `createMockServices()` and look
 * finished: the page renders, the states are right, the tests pass. Ship it,
 * and `VITE_STUDIO_API` selects the live adapter instead — where the port does
 * not exist. The surface is then broken in production and green in
 * development, which is the worst arrangement of those two facts.
 *
 * This is the same defect the estate has now found three times from three
 * directions: capabilities declared and uncalled (`test_no_unreachable_capability`),
 * domain fields never reaching a response (`test_no_field_left_behind`), and
 * artifact generators no request can ask for (`test_every_generator_is_reachable`).
 * Each time, unit tests passed because the piece under test was fine — what was
 * missing was the connection to anything.
 *
 * ## Why this is load-bearing for the `VC-` tracks
 *
 * A rapid experience track ships three things or none: the surface, its mock
 * adapter, and a live adapter — even when the live adapter's entire job is to
 * return a `CapabilityGap` saying the capability is not built. That third piece
 * is what lets an unfinished surface ship honestly instead of being hidden
 * behind a flag, and it is the piece easiest to forget, because forgetting it
 * breaks nothing a developer will see.
 *
 * ## What this does not assert
 *
 * That the live adapter *works*. It cannot: calling it would need a backend.
 * It asserts that the seam has two sides, which is the part that can be checked
 * cheaply and is currently checked nowhere.
 */

import { describe, expect, it } from 'vitest'

import { createLiveServices } from './live/liveServices'
import { createMockServices } from './mock/mockServices'
import type { StudioServices } from './interfaces'

/**
 * Not a port — a value, and the only key on the bundle that is one. Listed
 * rather than detected so that adding a second non-port key is a deliberate
 * edit here rather than a silent exemption.
 */
const NOT_A_PORT = new Set<keyof StudioServices>(['projectId'])

function ports(services: StudioServices): string[] {
  return Object.keys(services)
    .filter((key) => !NOT_A_PORT.has(key as keyof StudioServices))
    .sort()
}

/**
 * Walks the prototype chain, because the two adapters are written differently
 * and both spellings are legitimate: the live adapter builds object literals,
 * so its methods are own properties, while the mock uses `class MockAcquisition
 * implements AcquisitionPort`, which puts them on the prototype. Reading own
 * properties alone reports every mock port as empty and every live method as
 * missing from it — a comparison that fails loudly for the wrong reason.
 */
function methods(port: unknown): string[] {
  if (typeof port !== 'object' || port === null) return []

  const found = new Set<string>()
  for (
    let level: object | null = port;
    level && level !== Object.prototype;
    level = Object.getPrototypeOf(level) as object | null
  ) {
    for (const name of Object.getOwnPropertyNames(level)) {
      if (name === 'constructor') continue
      const descriptor = Object.getOwnPropertyDescriptor(level, name)
      if (typeof descriptor?.value === 'function') found.add(name)
    }
  }
  return [...found].sort()
}

describe('the service seam has two sides', () => {
  const live = createLiveServices('parity-check')
  const mock = createMockServices()

  it('every port on the bundle is implemented by both adapters', () => {
    expect(ports(live)).toEqual(ports(mock))
  })

  it.each(ports(createMockServices()))('%s answers the same calls in both', (name) => {
    const key = name as keyof StudioServices

    const missingFromLive = methods(mock[key]).filter((m) => !methods(live[key]).includes(m))
    const missingFromMock = methods(live[key]).filter((m) => !methods(mock[key]).includes(m))

    // Reported as two separate lists because the two directions mean different
    // things. Missing from live is a surface that will break when deployed;
    // missing from mock is a capability no test can reach.
    expect({ missingFromLive, missingFromMock }).toEqual({
      missingFromLive: [],
      missingFromMock: [],
    })
  })

  it('constructing either adapter costs no request', () => {
    // The reason this test can exist at all. Both factories build closures and
    // touch nothing, so parity is checkable without a backend — and a future
    // adapter that fetched during construction would break this file long
    // before it broke a page load.
    expect(() => createLiveServices('parity-check')).not.toThrow()
    expect(() => createMockServices()).not.toThrow()
  })
})
