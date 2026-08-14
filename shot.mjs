import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage()
await p.goto('http://127.0.0.1:5199/#/setup', { waitUntil: 'networkidle' })
await p.waitForTimeout(2000)
const pick = p.getByText('Cris Test 2: existing project')
if (await pick.count()) { await pick.click(); await p.waitForTimeout(3000) }
await p.goto('http://127.0.0.1:5199/#/setup', { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)
await p.screenshot({ path: '/tmp/shots/setup-full.png', fullPage: true })
const m = await p.evaluate(() => {
  const seen = {}
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length === 0 && el.textContent.trim()) {
      const s = getComputedStyle(el)
      const k = `${s.fontSize} w${s.fontWeight}`
      seen[k] = (seen[k] || 0) + 1
    }
  })
  const main = document.querySelector('main')
  return { typeScale: seen, mainWidth: main && Math.round(main.getBoundingClientRect().width) }
})
console.log(JSON.stringify(m))
await b.close()
