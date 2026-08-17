/**
 * A port method nothing calls is a capability the product does not have.
 *
 * One layer below `src/hooks/everyHookReachesASurface.test.ts`. That register
 * catches a hook no component calls; this one catches the shape underneath it —
 * a method declared on a port, implemented by both adapters, and invoked by no
 * hook and no page. `SRC-PIN-UNREACHABLE` was exactly that: `pinSource` existed
 * on the port, in both adapters and in a hook, while the Sources room told
 * people pinning fixes what KAE reads and offered no way to do it. It was found
 * by hand, and nothing checked the layer.
 *
 * Both directions fail, as in the hook register. An unreached method nobody
 * wrote down fails, and a registered method that has since gained a caller
 * fails too — an entry describing a solved problem is how a register starts
 * lying.
 *
 * What this deliberately does not do is decide whether the missing callers
 * should exist. Each entry below is a product question or a documented
 * deliberate absence, and the reasons say which.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')
const INTERFACES = join(SRC, 'services/interfaces.ts')

/**
 * Port methods nothing outside the adapters calls, and why each is still here.
 *
 * A reason is not an excuse: every line of it should say what would have to be
 * decided or built for the entry to go away.
 */
const UNREACHED: Record<string, string> = {
  'ArtifactPipeline.getPlan':
    'A real gap whose fix is a product ruling, not a control. The plan lives ' +
    'in useState at GeneratePackage.tsx and nothing anywhere records the ' +
    'planId, so whether a plan outlives one sitting is the owner’s to decide ' +
    '— PORT-METHODS-UNREACHED, D-238.',
  'ProjectMemoryClient.listProjects':
    'Bypassed and says why: ProjectGate renders above ServiceProvider, so the ' +
    'picker cannot take a bundle that does not exist yet and calls the API ' +
    'directly. The method is the same call one layer up.',
  'ProjectMemoryClient.submitMessage':
    'Deliberately uncalled, documented at useProject.ts:62-74. The interview ' +
    'turn already makes the sentence durable; calling this as well would ' +
    'store it twice.',
}

/**
 * A method with a caller, asserted by name.
 *
 * Without it a query that matches nothing — a changed file layout, a regex that
 * stopped compiling the way it reads — reports every method as unreached, and
 * the register looks like it found a catastrophe rather than like it broke.
 */
const CONTROL = 'AcquisitionPort.pinSource'

function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      // The adapters are where these methods are defined, and a definition is
      // not a caller. Including them changes nothing today — a live adapter's
      // `getPlan(planId)` carries no dot and the qualified query walks past it
      // — but a delegating `this.getPlan(...)` would read as a caller, and a
      // port calling itself is not the product reaching it.
      if (path === join(SRC, 'services')) continue
      found.push(...sourceFiles(path))
    } else if (['.ts', '.tsx'].includes(extname(entry.name)) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path)
    }
  }
  return found
}

/**
 * The ports, read off `StudioServices` rather than listed.
 *
 * A tenth port added to the bundle is then covered without anybody remembering
 * this file, which is the failure mode a register has instead of a scan.
 */
function ports(text: string): string[] {
  const bundle = text.slice(text.indexOf('export interface StudioServices {'))
  const declared = [...bundle.slice(0, bundle.indexOf('\n}')).matchAll(/^ {2}\w+: (\w+)$/gm)].map(
    (match) => match[1],
  )
  return declared.filter((name) => text.includes(`export interface ${name} {`))
}

function methodsOf(text: string, port: string): string[] {
  const start = text.indexOf(`export interface ${port} {`)
  const body = text.slice(start, text.indexOf('\n}', start))
  return [...body.matchAll(/^ {2}(\w+)\??\(/gm)].map((match) => match[1])
}

/**
 * Qualified form only — `.pinSource`, never `pinSource`.
 *
 * A bare name matches the mock objects test files build inline and the
 * interface declaration itself; the dot is what makes a match a call on
 * something.
 *
 * The query is by name and the register is by port, so two ports declaring the
 * same method — `listConnections` is on both `SetupPort` and `AcquisitionPort`
 * today — are answered together, and one caller covers both. Narrowing that
 * would mean resolving what each expression is typed as, which is a type
 * checker's job rather than a register's; the looseness costs a false *reached*
 * and never a false *unreached*, which is the safe direction for a check whose
 * failure is a person reading it.
 */
function calledBySomething(method: string, sources: string[]): boolean {
  const call = new RegExp(`\\.${method}\\b`)
  return sources.some((text) => call.test(text))
}

describe('the service ports', () => {
  const declarations = readFileSync(INTERFACES, 'utf8')
  const named = ports(declarations)
  const methods = named.flatMap((port) =>
    methodsOf(declarations, port).map((method) => `${port}.${method}`),
  )
  const callers = sourceFiles(SRC).map((path) => readFileSync(path, 'utf8'))
  const unreached = methods.filter(
    (qualified) => !calledBySomething(qualified.split('.')[1], callers),
  )

  it('reads enough ports and callers for this to be measuring something', () => {
    expect(named.length).toBeGreaterThanOrEqual(9)
    expect(methods.length).toBeGreaterThan(50)
    expect(callers.length).toBeGreaterThan(20)
  })

  it('finds the control method called', () => {
    expect(methods).toContain(CONTROL)
    expect(unreached).not.toContain(CONTROL)
  })

  it('has every port method called somewhere, or written down as not called', () => {
    expect(unreached.sort()).toEqual(Object.keys(UNREACHED).sort())
  })

  it('registers no port method that something now calls', () => {
    const stale = Object.keys(UNREACHED).filter((qualified) => !unreached.includes(qualified))
    expect(stale).toEqual([])
  })
})
