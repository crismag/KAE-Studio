/**
 * The sweep `NAV-01` was written from, re-run.
 *
 * Same measurements as the first pass: how many controls a page offers, how
 * many machine identifiers a reader meets, whether anything overflows the
 * window. Kept out of `src/` deliberately — it drives a browser against a
 * running deployment and is not part of the bundle.
 */

import { chromium } from 'playwright'

const ROUTES = [
  'dashboard',
  'setup',
  'workspace',
  'sources',
  'definition',
  'requirements',
  'modules',
  'architecture',
  'dependencies',
  'plan',
  'deliverables',
  'reviews',
  'settings/project',
  'memory',
]

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:5199/studio/#/dashboard', { waitUntil: 'networkidle' })
await p.waitForTimeout(1300)
if (await p.locator('text=Choose a project').count()) {
  await p.locator('button', { hasText: 'Cris Test1' }).first().click()
  await p.waitForTimeout(1600)
}

console.log('route            visible-buttons  uuids  overflow')
for (const route of ROUTES) {
  await p.goto(`http://localhost:5199/studio/#/${route}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1300)
  const m = await p.evaluate(() => {
    const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
    const de = document.documentElement
    // `checkVisibility` rather than a bounding box: a closed `<details>` keeps
    // its contents laid out and merely skips painting them, so geometry alone
    // reports a collapsed group as though every row were on screen.
    const visible = (el) =>
      el.checkVisibility({
        contentVisibilityAuto: true,
        opacityProperty: true,
        visibilityProperty: true,
      })
    const text = []
    const walk = (node) => {
      for (const child of node.children) {
        if (child.tagName === 'DETAILS' && !child.open) {
          const summary = child.querySelector('summary')
          if (summary) walk(summary)
          continue
        }
        if (child.children.length === 0) {
          // Rect as well as visibility: a screen-reader-only reference is
          // clipped to a pixel, which is present for anybody who needs it and
          // not something a reader meets.
          const r = child.getBoundingClientRect()
          if (visible(child) && r.width > 2 && child.innerText?.trim()) {
            text.push(child.innerText.trim())
          }
        } else walk(child)
      }
    }
    walk(document.body)
    return {
      buttons: [...document.querySelectorAll('button')].filter(visible).length,
      uuids: new Set(text.join('\n').match(UUID) ?? []).size,
      overflow: de.scrollWidth > de.clientWidth,
    }
  })
  console.log(
    route.padEnd(17),
    String(m.buttons).padEnd(16),
    String(m.uuids).padEnd(6),
    m.overflow ? 'YES' : 'no',
  )
}
await b.close()
