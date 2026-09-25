// Run with PureChart's Vite server running. Uses a separate browser; no user document is touched.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 380, height: 850 } })
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto(process.env.PURECHART_URL ?? 'http://localhost:5193')
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/ChartProposalPanel.tsx')).text()
    const main = await (await fetch('/src/main.tsx')).text()
    const { default: React } = await import(source.match(/from "([^" ]*\/react\.js[^" ]*)"/)[1])
    const { default: { createRoot } } = await import(main.match(/from "([^" ]*\/react-dom_client\.js[^" ]*)"/)[1])
    const { useChartSession } = await import('/src/hooks/useChartSession.ts')
    const { ChartProposalPanel } = await import('/src/components/ChartProposalPanel.tsx')
    document.body.innerHTML = '<div id="proposal-fixture"></div>'
    const node = document.getElementById('proposal-fixture')
    node.style.cssText = 'padding:16px;max-width:340px;font-family:sans-serif;--purechart-border:#ccd3db;--purechart-panel:white;--purechart-text:#202633;--purechart-muted:#56616d'
    function Fixture() {
      const session = useChartSession({ ready: false, appSettings: {}, resource: null, onResourceHandled() {} })
      window.proposalTestSession = session
      return React.createElement(ChartProposalPanel, { session, key: session.proposal?.id })
    }
    createRoot(node).render(React.createElement(Fixture))
  })
  await page.waitForFunction(() => !!window.proposalTestSession)
  await page.evaluate(() => {
    const s = window.proposalTestSession
    s.setPastedText('year,value\n2022,10\n2023,20\n2024,30')
    s.focusChart(s.liveSheet().charts[0].id)
    s.resetHistory()
    window.proposalTestBefore = JSON.stringify(s.liveSheet())
    s.proposeChart({ patch: { title: 'Measured trend', style: { grid: true } }, explanation: 'Name the measure and add gridlines for comparison.' })
  })
  await page.getByRole('button', { name: 'Apply proposal' }).waitFor()
  assert.equal(await page.evaluate(() => JSON.stringify(window.proposalTestSession.liveSheet()) === window.proposalTestBefore), true)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: '/tmp/purechart-proposal-review.png', fullPage: true })
  await page.getByRole('button', { name: 'Apply proposal' }).click()
  assert.equal(await page.evaluate(() => window.proposalTestSession.liveSpec().title), 'Measured trend')
  await page.evaluate(() => window.proposalTestSession.undo())
  assert.equal(await page.evaluate(() => JSON.stringify(window.proposalTestSession.liveSheet()) === window.proposalTestBefore), true)
  await page.evaluate(() => {
    const s = window.proposalTestSession
    s.proposeChart({ patch: { title: 'Stale title' }, explanation: 'Proposed rename.' })
    s.setChartName('New manual edit')
  })
  assert.equal(await page.getByRole('button', { name: 'Apply proposal' }).isDisabled(), true)
  await page.getByRole('button', { name: 'Discard proposal' }).click()
  assert.equal(await page.evaluate(() => window.proposalTestSession.proposal), null)
  assert.equal(await page.evaluate(() => window.proposalTestSession.liveSpec().title), 'New manual edit')
  assert.deepEqual(failures, [])
  console.log('Proposal preview, narrow layout, apply, undo, stale guard and discard passed.')
} finally { await browser.close() }
