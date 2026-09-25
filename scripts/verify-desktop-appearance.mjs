// Runs against the real desktop settings bridge; restores the prior appearance.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.connectOverCDP(process.env.PURECHART_CDP ?? 'http://localhost:9336')
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('http://localhost:5170'))
const f = page?.frames().find(f => f.url().startsWith('http://localhost:5193'))
if (!f) throw new Error('Open PureChart in the desktop dev shell first.')
const cdp = await page.context().newCDPSession(page)
const original = await f.evaluate(() => document.documentElement.dataset.platformAppearance || 'glass')
async function choose(value) {
  await f.getByRole('button', { name: 'Settings', exact: true }).click()
  await f.getByRole('button', { name: 'Appearance', exact: true }).click()
  const current = await f.evaluate(() => document.documentElement.dataset.platformAppearance || 'glass')
  if (current !== value) {
    await f.getByRole('button', { name: current === 'glass' ? 'Glass' : 'White', exact: true }).click()
    await f.getByText(value === 'glass' ? 'Glass' : 'White', { exact: true }).click()
    await f.waitForFunction(value => document.documentElement.dataset.platformAppearance === value, value)
  }
  await f.getByRole('button', { name: 'Close settings', exact: true }).click()
}
try {
  for (const appearance of ['white', 'glass']) {
    await choose(appearance)
    await f.goto(f.url())
    await f.waitForFunction(value => document.documentElement.dataset.platformAppearance === value, appearance)
  }
  for (const width of [1280, 800]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
    await f.getByRole('button', { name: 'Data', exact: true }).click()
    const hint = f.getByText('Paste a table from a spreadsheet, or import CSV, TSV, or JSON. Data is shared by every chart in this document.', { exact: true })
    assert.equal(await hint.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `Data instructions overflow at ${width}`)
    assert.equal(await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: `/tmp/purechart-glass-${width}.png` })
    const chart = f.locator('[aria-label="Every chart on this sheet"] button[aria-label^="Open "]').first()
    if (await chart.count()) await chart.click()
    await f.getByRole('textbox', { name: 'Chart name', exact: true }).waitFor()
    for (const panel of ['Chart', 'Style', 'Review', 'Export']) {
      await f.getByRole('button', { name: panel, exact: true }).click()
      const rail = f.locator('aside')
      assert.equal(await rail.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${panel} rail overflows at ${width}`)
      await rail.evaluate(el => { el.scrollTop = el.scrollHeight })
      assert.equal(await rail.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, `${panel} lower controls overflow at ${width}`)
      await page.screenshot({ path: `/tmp/purechart-${panel.toLowerCase()}-${width}.png` })
      await rail.evaluate(el => { el.scrollTop = 0 })
    }

  }
  console.log('Desktop Glass/White setting persists after reload; data instructions and all editor rails fit at 1280px and 800px.')
} finally {
  await cdp.send('Emulation.clearDeviceMetricsOverride')
  await choose(original)
  await browser.close()
}
