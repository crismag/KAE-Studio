import { chromium } from '@playwright/test'

const routes = [
  ['workspace', '/#/workspace'],
  ['definition', '/#/definition'],
  ['modules', '/#/modules'],
  ['requirements', '/#/requirements'],
  ['interfaces', '/#/interfaces'],
  ['dependencies', '/#/dependencies'],
  ['deliverables', '/#/deliverables'],
  ['reviews', '/#/reviews'],
  ['architecture', '/#/architecture'],
  ['plan', '/#/plan'],
  ['memory', '/#/memory'],
]

const browser = await chromium.launch()
const issues = []
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') issues.push(`[console] ${m.text()}`)
})
page.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`))

for (const [name, path] of routes) {
  await page.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `screenshots/desktop-${name}.png` })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (overflow) issues.push(`[overflow] desktop ${name}`)
  const unnamed = await page.evaluate(
    () =>
      [...document.querySelectorAll('button')].filter(
        (b) =>
          !(b.textContent || '').trim() &&
          !b.getAttribute('aria-label') &&
          !b.querySelector('.sr-only'),
      ).length,
  )
  if (unnamed) issues.push(`[a11y] ${name}: ${unnamed} buttons without accessible name`)
  const h1 = await page.locator('h1').count()
  if (h1 !== 1) issues.push(`[a11y] ${name}: ${h1} h1 elements`)
}

await page.goto('http://localhost:4173/#/workspace', { waitUntil: 'networkidle' })
await page.fill('#composer', 'Only leadership should read published reports.')
await page.getByRole('button', { name: 'Send' }).click()
await page.waitForTimeout(2500)
await page.screenshot({ path: 'screenshots/desktop-workspace-after-send.png' })
const msgCount = await page.locator('article').count()
if (msgCount < 4) issues.push(`[interaction] assistant did not reply (articles=${msgCount})`)

await page.goto('http://localhost:4173/#/modules', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Accept', exact: true }).first().click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'screenshots/desktop-modules-accepted.png' })

await page.goto('http://localhost:4173/#/deliverables', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const outdated = await page.getByText('Outdated').count()
if (outdated === 0) issues.push('[interaction] deliverables did not go outdated after a decision')
await page.screenshot({ path: 'screenshots/desktop-deliverables-outdated.png' })

await page
  .getByRole('button', { name: /^Publish$/ })
  .first()
  .click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'screenshots/desktop-publish-dialog.png' })

const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const mpage = await mctx.newPage()
mpage.on('pageerror', (e) => issues.push(`[mobile pageerror] ${e.message}`))
for (const [name, path] of routes) {
  await mpage.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' })
  await mpage.waitForTimeout(500)
  const overflow = await mpage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (overflow) issues.push(`[overflow] mobile ${name}`)
  if (['workspace', 'modules', 'deliverables', 'reviews'].includes(name)) {
    await mpage.screenshot({ path: `screenshots/mobile-${name}.png` })
  }
}
await mpage.goto('http://localhost:4173/#/workspace', { waitUntil: 'networkidle' })
await mpage.getByRole('button', { name: 'Open navigation' }).click()
await mpage.waitForTimeout(600)
await mpage.screenshot({ path: 'screenshots/mobile-navigation.png' })

const tctx = await browser.newContext({ viewport: { width: 900, height: 1100 } })
const tpage = await tctx.newPage()
for (const [name, path] of [
  ['workspace', '/#/workspace'],
  ['modules', '/#/modules'],
]) {
  await tpage.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' })
  await tpage.waitForTimeout(500)
  const overflow = await tpage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  if (overflow) issues.push(`[overflow] tablet ${name}`)
  await tpage.screenshot({ path: `screenshots/tablet-${name}.png` })
}

await browser.close()
console.log(
  issues.length
    ? 'ISSUES:\n' + issues.join('\n')
    : 'PASS: no console errors, no overflow at 1600/900/390, all buttons named, one h1 per route, interactions work',
)
