import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 380, height: 850 } })
  await page.goto(process.env.PURECHART_URL ?? 'http://localhost:5193')
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/ChartProposalPanel.tsx')).text()
    const main = await (await fetch('/src/main.tsx')).text()
    const { default: React } = await import(source.match(/from "([^" ]*\/react\.js[^" ]*)"/)[1])
    const { default: { createRoot } } = await import(main.match(/from "([^" ]*\/react-dom_client\.js[^" ]*)"/)[1])
    const { useChartSession } = await import('/src/hooks/useChartSession.ts')
    const { PresentationPanel } = await import('/src/components/PresentationPanel.tsx')
    document.body.innerHTML = '<div id="fixture" style="padding:16px;font-family:sans-serif"></div><div id="platform-menu-portal"></div>'
    function Fixture() {
      const session = useChartSession({ ready: false, appSettings: {}, resource: null, onResourceHandled() {} })
      window.styleTest = session
      return React.createElement(PresentationPanel, { session })
    }
    createRoot(document.getElementById('fixture')).render(React.createElement(Fixture))
  })
  await page.waitForFunction(() => !!window.styleTest)
  await page.evaluate(() => {
    const s = window.styleTest
    s.setPastedText('x,y\n1,10\n2,20')
    s.focusChart(s.liveSheet().charts[0].id)
    s.setStyle({ strokeWidth: 3 })
    s.setAxis('y', { max: 100 })
    window.styleTestData = JSON.stringify(s.liveSpec().data)
  })
  await page.getByText('Reusable styles', { exact: true }).click()
  await page.getByRole('textbox', { name: 'Style name', exact: true }).fill('Report')
  await page.getByRole('button', { name: 'Save style', exact: true }).click()
  await page.getByRole('button', { name: 'Delete style Report', exact: true }).waitFor()
  await page.evaluate(() => { window.styleTest.setStyle({ strokeWidth: 1 }); window.styleTest.resetHistory() })
  await page.getByRole('button', { name: 'Apply saved style', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Report', exact: true }).click()
  assert.equal(await page.evaluate(() => window.styleTest.liveSpec().chart.style.strokeWidth), 3)
  assert.equal(await page.evaluate(() => window.styleTest.liveSpec().chart.axes.y.max), 100)
  assert.equal(await page.evaluate(() => JSON.stringify(window.styleTest.liveSpec().data) === window.styleTestData), true)
  await page.evaluate(() => window.styleTest.undo())
  assert.equal(await page.evaluate(() => window.styleTest.liveSpec().chart.style.strokeWidth), 1)
  await page.waitForFunction(() => !window.styleTest.canUndo)
  await page.getByRole('button', { name: 'Delete style Report', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Apply saved style', exact: true }).isDisabled(), true)
  assert.equal(await page.evaluate(() => window.styleTest.liveSpec().chart.style.strokeWidth), 1)
  assert.equal(await page.evaluate(() => localStorage.getItem('purechart:chart-styles:v1')), '[]')
  console.log('Saved style UI: save, apply, one-step undo, data/axis preservation and deletion passed.')
} finally { await browser.close() }
