// Fault injection is confined to a newly created QA package. Permissions are
// restored in finally, including if a UI assertion fails.
import { chromium } from 'playwright'
import { chmod, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
if (!process.env.QA_DRAFTS_DIR) throw new Error('Set QA_DRAFTS_DIR.')
const browser = await chromium.connectOverCDP(process.env.PURECHART_CDP ?? 'http://localhost:9336')
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('http://localhost:5170'))
const f = page?.frames().find(f => f.url().startsWith('http://localhost:5193'))
if (!f) throw new Error('Open PureChart in the desktop dev shell first.')
const title = `PureChart QA save failure ${Date.now()}`
const chartPath = path.join(process.env.QA_DRAFTS_DIR, `${title}.chart`)
const modes = new Map()
const restorePermissions = async () => { for (const [file, mode] of modes) await chmod(file, mode); modes.clear() }
const saved = () => f.waitForFunction(() => document.body.innerText.includes('Saved ·'))
try {
  await f.locator('button[title="Switch documents (⌘O)"]').click()
  await f.getByRole('button', { name: 'New chart' }).click()
  await f.getByRole('textbox', { name: 'Document name', exact: true }).fill(title)
  await f.getByRole('textbox', { name: 'Document name', exact: true }).press('Tab')
  await f.getByRole('button', { name: 'Data', exact: true }).click()
  await f.getByRole('textbox', { name: 'Chart data', exact: true }).fill('region,value\nA,10\nB,20')
  await f.getByRole('button', { name: 'Apply data', exact: true }).click()
  await f.getByRole('textbox', { name: 'Chart name', exact: true }).fill('Last good chart')
  await f.getByRole('textbox', { name: 'Chart name', exact: true }).press('Tab')
  await saved()
  const contentPath = path.join(chartPath, 'chart.json')
  const previous = await readFile(contentPath, 'utf8')
  await page.waitForTimeout(750) // Begin a distinct title-edit history group.
  for (const file of [chartPath, path.join(chartPath, 'manifest.json'), contentPath]) {
    modes.set(file, (await stat(file)).mode & 0o777)
    await chmod(file, file === chartPath ? 0o555 : 0o444)
  }
  await f.getByRole('textbox', { name: 'Chart name', exact: true }).fill('Pending edit survives failure')
  await f.getByRole('textbox', { name: 'Chart name', exact: true }).press('Tab')
  await f.getByRole('button', { name: 'Retry save', exact: true }).waitFor()
  assert.equal(await readFile(contentPath, 'utf8'), previous)
  assert.equal(await f.getByRole('textbox', { name: 'Chart name', exact: true }).inputValue(), 'Pending edit survives failure')
  console.log('Real write failure surfaced; last saved chart and pending edit preserved.')
  await f.locator('button[title="Switch documents (⌘O)"]').click()
  await f.getByRole('button', { name: 'New chart' }).click()
  await f.waitForFunction(() => document.body.innerText.includes('Current chart kept.'))
  assert.equal(await f.getByRole('textbox', { name: 'Chart name', exact: true }).inputValue(), 'Pending edit survives failure')
  assert.equal(await readFile(contentPath, 'utf8'), previous)
  await f.getByRole('button', { name: 'Undo', exact: true }).click()
  assert.equal(await f.getByRole('textbox', { name: 'Chart name', exact: true }).inputValue(), 'Last good chart')
  await f.getByRole('button', { name: 'Redo', exact: true }).click()
  assert.equal(await f.getByRole('textbox', { name: 'Chart name', exact: true }).inputValue(), 'Pending edit survives failure')
  console.log('Outgoing document switch refused and Undo/Redo history preserved.')
  await restorePermissions()
  await f.getByRole('button', { name: 'Retry save', exact: true }).click()
  await saved()
  assert.equal(await f.getByText(/Could not save the outgoing chart:/).count(), 0)
  const recovered = JSON.parse(await readFile(contentPath, 'utf8'))
  assert.equal(recovered.charts[0].spec.title, 'Pending edit survives failure')
  assert.equal(recovered.data.inline.text, 'region,value\nA,10\nB,20')
  console.log(JSON.stringify({ result: 'Save failure, outgoing-switch protection and successful retry passed.', chartPath }))
} finally { await restorePermissions(); await browser.close() }
