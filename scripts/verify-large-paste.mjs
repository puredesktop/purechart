// Exercises bulk text insertion and the actual rectangular-paste event handler
// in an isolated browser, without replacing the user's operating-system clipboard.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const failures = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto(process.env.PURECHART_URL ?? 'http://localhost:5193')
  const source = 'x,y\n' + Array.from({ length: 50_000 }, (_, i) => `${i},${i % 100}`).join('\n')
  await page.getByRole('textbox', { name: 'Chart data', exact: true }).click()
  const start = Date.now()
  await page.getByRole('textbox', { name: 'Chart data', exact: true }).evaluate((element, text) => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', text)
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, source)
  await page.getByText('Import preview · 50000 rows · 2 columns', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Apply data', exact: true }).click()
  await page.getByRole('button', { name: /Table.*50000 rows/ }).click()
  const table = page.getByRole('table', { name: 'Editable source data', exact: true })
  await table.waitFor()
  assert.equal(await table.getAttribute('aria-rowcount'), '50001')
  assert.ok(await table.locator('tbody tr').count() < 40)
  const initialMs = Date.now() - start
  const pasteStart = Date.now()
  await page.getByRole('textbox', { name: 'Row 1, x', exact: true }).evaluate(element => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', Array.from({ length: 50_000 }, (_, i) => `${i}\t${100 + i % 100}`).join('\n'))
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  })
  await page.waitForFunction(() => document.querySelector('input[aria-label="Row 1, y"]')?.value === '100')
  const pasteMs = Date.now() - pasteStart
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('input[aria-label="Row 1, y"]')?.value === '0')
  assert.equal(await table.getAttribute('aria-rowcount'), '50001')
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ rows: 50_000, initialMs, pasteMs, result: 'Bulk text entry, rectangular paste, virtualized table and one-step undo passed.' }))
} finally { await browser.close() }
