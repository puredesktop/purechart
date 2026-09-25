import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://localhost:5193')
  const button = name => page.getByRole('button', { name, exact: true })
  await button('Data').click()
  await page.getByRole('textbox', { name: 'Chart data' }).fill('year,north,south\n2022,10,12\n2023,14,18\n2024,19,22')
  await button('Apply data').click()
  if (await page.getByRole('button', { name: /^Open / }).count()) await page.getByRole('button', { name: /^Open / }).first().click()
  await button('Style').click()
  const pane = page.getByRole('complementary', { name: 'Chart controls' })
  await page.getByRole('slider', { name: 'Pane width' }).fill('500')
  await page.waitForFunction(() => localStorage.getItem('purechart.panelWidth') === '500')
  assert(Math.abs((await pane.boundingBox()).width - 500) < 2)
  const canvas = page.locator('svg[role=img]').first()
  const before = (await canvas.boundingBox()).width
  await button('Hide controls').click()
  assert.equal(await pane.isVisible(), false)
  await page.waitForFunction(width => document.querySelector('svg[role=img]').getBoundingClientRect().width > width, before)
  await button('Export…').click()
  assert.equal(await pane.isVisible(), true)
  await button('Export SVG').waitFor()
  const download = page.waitForEvent('download')
  await button('Export SVG').click()
  assert((await download).suggestedFilename().endsWith('.svg'))
  await button('Data').click()
  const draft = 'year,north,south\n2022,1,2'
  await page.getByRole('textbox', { name: 'Chart data' }).fill(draft)
  await button('Hide controls').click(); await button('Show controls').click()
  assert.equal(await page.getByRole('textbox', { name: 'Chart data' }).inputValue(), draft)
  for (const width of [1280, 800, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const panel of ['Data', 'Chart', 'Style', 'Review', 'Export']) {
      await button(panel).click()
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${panel} at ${width} overflows`)
      assert(await pane.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${panel} pane at ${width} overflows`)
    }
    await page.screenshot({ path: `/tmp/purechart-workspace-${width}.png` })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.reload()
  assert.equal(await page.getByRole('slider', { name: 'Pane width' }).inputValue(), '500')
  assert.deepEqual(errors, [])
  console.log('PASS workspace: pane resize/persistence, collapse and canvas reflow, Export reopens controls, SVG download, retained data draft, 1280/800/390px panels.')
} finally { await browser.close() }
