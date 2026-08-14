import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } })
await p.goto('http://localhost:5199/studio/#/dashboard', { waitUntil: 'networkidle' })
await p.waitForTimeout(1300)
if (await p.locator('text=Choose a project').count()) {
  await p.locator('button', { hasText: 'Cris Test1' }).first().click(); await p.waitForTimeout(1600)
}
for (const r of ['reviews','workspace','definition']) {
  await p.goto(`http://localhost:5199/studio/#/${r}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const hits = await p.evaluate(() => {
    const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/
    const KEY = /^question:|^[a-z]+_[a-z_]+$/
    const out = []
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length) continue
      const t = (el.innerText || '').trim()
      if (!t || !(UUID.test(t) || KEY.test(t))) continue
      const vis = el.getBoundingClientRect().height > 0
      out.push({ t: t.slice(0, 60), cls: (el.className||'').toString().slice(0,40), parent: el.parentElement?.className?.toString().slice(0,40), vis })
    }
    return out.slice(0, 6)
  })
  console.log('==', r); console.log(JSON.stringify(hits, null, 1))
}
await b.close()
