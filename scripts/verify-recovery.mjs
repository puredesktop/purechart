// Integration check with genuine cross-window Web Locks and shared storage.
// Run against the Vite server in an isolated browser; it never opens user files.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
const context = await browser.newContext()
const failures = []
async function fixture() {
  const page = await context.newPage()
  page.on('pageerror', error => failures.push(error.message))
  await page.goto(process.env.PURECHART_URL ?? 'http://localhost:5193')
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/ChartProposalPanel.tsx')).text()
    const main = await (await fetch('/src/main.tsx')).text()
    const { default: React } = await import(source.match(/from "([^" ]*\/react\.js[^" ]*)"/)[1])
    const { default: { createRoot } } = await import(main.match(/from "([^" ]*\/react-dom_client\.js[^" ]*)"/)[1])
    const { useChartRecovery } = await import('/src/hooks/useChartRecovery.ts')
    const { emptySheet } = await import('/src/lib/chartSheet.ts')
    window.makeRecoverySheet = emptySheet
    const node = document.createElement('div')
    document.body.append(node)
    function Fixture() {
      window.recoveryTest = useChartRecovery()
      return React.createElement('p', null, `Recovery candidates: ${window.recoveryTest.entries.length}`)
    }
    createRoot(node).render(React.createElement(Fixture))
  })
  await page.waitForFunction(() => !!window.recoveryTest)
  return page
}
try {
  const first = await fixture()
  await first.evaluate(() => window.recoveryTest.capture(window.makeRecoverySheet('Unsaved work'), '/original.chart'))
  const id = await first.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('purechart:recovery:')).slice('purechart:recovery:'.length))
  const second = await fixture()
  await second.evaluate(() => window.dispatchEvent(new Event('focus')))
  assert.equal(await second.evaluate(() => window.recoveryTest.entries.length), 0)
  await second.evaluate(id => window.recoveryTest.discard(id), id)
  await second.waitForFunction(() => window.recoveryTest.error?.includes('another open window'))
  assert.equal(await second.evaluate(id => localStorage.getItem(`purechart:recovery:${id}`) !== null, id), true)
  await first.close()
  await second.evaluate(() => window.dispatchEvent(new Event('focus')))
  await second.waitForFunction(id => window.recoveryTest.entries.some(entry => entry.id === id), id)
  // A failed backup of the recovered draft must leave the original recoverable.
  await second.evaluate(async id => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
    try { await window.recoveryTest.recover(id, () => { window.recoveryApplied = true }) }
    finally { Storage.prototype.setItem = original }
  }, id)
  assert.equal(await second.evaluate(() => !!window.recoveryApplied), false)
  assert.equal(await second.evaluate(id => localStorage.getItem(`purechart:recovery:${id}`) !== null, id), true)
  await second.evaluate(id => window.recoveryTest.recover(id, sheet => { window.recoveryApplied = sheet }), id)
  assert.equal(await second.evaluate(() => window.recoveryApplied.title), 'Unsaved work — recovered')
  assert.equal(await second.evaluate(id => localStorage.getItem(`purechart:recovery:${id}`), id), null)
  const backup = await second.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith('purechart:recovery:')))))
  assert.equal(backup.path, null)
  assert.equal(backup.sheet.title, 'Unsaved work — recovered')
  const third = await fixture()
  await third.evaluate(() => window.dispatchEvent(new Event('focus')))
  assert.equal(await third.evaluate(() => window.recoveryTest.entries.length), 0)
  assert.deepEqual(failures, [])
  console.log('Live-owner exclusion, action-time ownership, crash release, quota preservation and recovered-draft isolation passed.')
} finally { await browser.close() }
