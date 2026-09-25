// Exercises the real shell router -> viewport -> app handler -> completion bridge.
// Only tool-record lookup/result persistence are test doubles; no model is called.
import { chromium } from 'playwright'
import { readFile, writeFile, mkdtemp, chmod, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
const browser = await chromium.connectOverCDP(process.env.PURECHART_CDP ?? 'http://localhost:9336')
const page = browser.contexts()[0].pages().find(p => p.url().startsWith('http://localhost:5170'))
const f = page?.frames().find(f => f.url().startsWith('http://localhost:5193'))
if (!f) throw new Error('Open PureChart in the desktop dev shell first.')
const title = `PureChart QA tools ${Date.now()}`
let original
const modes = new Map()
const restorePermissions = async () => { for (const [file, mode] of modes) await chmod(file, mode); modes.clear() }
try {
  original = await page.evaluate(async () => {
    const { api } = await import('/src/renderer/workspace/api.ts')
    return (await api.get()).tabs.find(t => t.appId === 'chart').resource.path
  })
  const prior = await readFile(`${original}/chart.json`, 'utf8')
  await page.evaluate(async () => {
    const { router } = await import('/src/renderer/assistants/toolCalls/appTools/Router.ts')
    const { toolCalls } = await import('/src/renderer/assistants/toolCalls/api.ts')
    const { api } = await import('/src/renderer/workspace/api.ts')
    const tab = (await api.get()).tabs.find(t => t.appId === 'chart')
    const records = new Map(), pending = new Map()
    const get = toolCalls.get, complete = toolCalls.complete
    toolCalls.get = id => records.has(id) ? Promise.resolve(records.get(id)) : get(id)
    toolCalls.complete = async input => {
      const done = pending.get(input.resultForToolCallId)
      if (!done) return complete(input)
      pending.delete(input.resultForToolCallId)
      done(input.content)
    }
    window.__chartToolQA = {
      restore: () => { toolCalls.get = get; toolCalls.complete = complete; delete window.__chartToolQA },
      invoke: async (name, args = {}) => {
        const id = `chart-qa-${crypto.randomUUID()}`
        records.set(id, { id, toolName: `chart.${name}`, arguments: args })
        const result = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Tool timed out: ${name}`)), 15000)
          pending.set(id, content => { clearTimeout(timer); resolve(content) })
        })
        await router.request(id, tab.sessionId)
        return result
      },
    }
  })
  const invoke = (name, args) => page.evaluate(({ name, args }) => window.__chartToolQA.invoke(name, args), { name, args })
  const created = await invoke('createChart', { title, dataText: 'region,value\nA,10\nB,20', type: 'bar' })
  assert.match(created, new RegExp(title))
  const saved = JSON.parse(await invoke('saveChart'))
  assert.ok(saved.saved?.endsWith(`${title}.chart`), JSON.stringify(saved))
  assert.equal(await readFile(`${original}/chart.json`, 'utf8'), prior, 'Creating and saving must not overwrite the previous document')
  const chartFile = `${saved.saved}/chart.json`
  const baseline = JSON.parse(await readFile(chartFile, 'utf8'))
  assert.equal(baseline.charts[0].spec.title, title)
  for (const file of [saved.saved, `${saved.saved}/manifest.json`, chartFile]) {
    modes.set(file, (await stat(file)).mode & 0o777)
    await chmod(file, file === saved.saved ? 0o555 : 0o444)
  }
  const failedSave = await invoke('saveChart')
  assert.match(failedSave, /EACCES|permission denied/i)
  assert.doesNotMatch(failedSave, /"saved"\s*:/)
  assert.deepEqual(JSON.parse(await readFile(chartFile, 'utf8')), baseline)
  await restorePermissions()
  assert.equal(JSON.parse(await invoke('saveChart')).saved, saved.saved)
  console.log('Assistant save reports the actual write error and succeeds after permissions are restored.')
  const proposed = await invoke('proposeChart', { patch: { title: 'Reviewed tool proposal' }, explanation: 'Use a clearer title.' })
  assert.match(proposed, /Pending review/)
  await f.getByRole('button', { name: 'Apply proposal', exact: true }).waitFor()
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.title, title)
  await f.getByRole('button', { name: 'Apply proposal', exact: true }).click()
  await invoke('saveChart')
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.title, 'Reviewed tool proposal')
  await f.getByRole('button', { name: 'Undo', exact: true }).click()
  await invoke('saveChart')
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.title, title)
  console.log(JSON.stringify({ result: 'Real shell tool delivery, create/save isolation, proposal review/application and single Undo passed.', chartFile }))
  // Add through the actual canvas hit target, then edit/remove through Style.
  await f.getByRole('img', { name: title, exact: true }).waitFor()
  const point = await f.getByRole('img', { name: title, exact: true }).evaluate(svg => {
    const label = svg.querySelector('[data-bar-values] text')
    const p = svg.createSVGPoint()
    p.x = Number(label.getAttribute('x')); p.y = Number(label.getAttribute('y')) + 12
    const client = p.matrixTransform(svg.getScreenCTM())
    return { clientX: client.x, clientY: client.y }
  })
  await f.locator('rect[aria-label="Inspect chart points"]').dispatchEvent('dblclick', point)
  await invoke('saveChart')
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.chart.annotations.length, 1)
  await f.getByRole('button', { name: 'Style', exact: true }).click()
  await f.getByText('Edit annotations (1)', { exact: true }).click()
  const annotation = f.getByRole('textbox', { name: /^Annotation / })
  await annotation.fill('Reviewed measurement')
  await annotation.press('Tab')
  await invoke('saveChart')
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.chart.annotations[0].text, 'Reviewed measurement')
  await f.getByRole('button', { name: 'Remove annotation Reviewed measurement', exact: true }).click()
  await invoke('saveChart')
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.chart.annotations.length, 0)
  await f.getByRole('button', { name: 'Undo', exact: true }).click()
  await invoke('saveChart')
  assert.equal(JSON.parse(await readFile(chartFile, 'utf8')).charts[0].spec.chart.annotations[0].text, 'Reviewed measurement')
  console.log('Canvas annotation creation, Style label edit/removal and one-step removal Undo persist correctly.')
  const importedTitle = `PureChart QA import ${Date.now()}`
  const fixtureDir = await mkdtemp(path.join(tmpdir(), 'purechart-import-'))
  const csvPath = path.join(fixtureDir, `${importedTitle}.csv`)
  await writeFile(csvPath, 'product,sales\nOne,12\nTwo,24')
  const beforeImport = await readFile(chartFile, 'utf8')
  await invoke('openChart', { path: csvPath })
  const importedSave = JSON.parse(await invoke('saveChart'))
  assert.ok(importedSave.saved?.endsWith(`${importedTitle}.chart`))
  const imported = JSON.parse(await readFile(`${importedSave.saved}/chart.json`, 'utf8'))
  assert.equal(imported.title, importedTitle)
  assert.equal(imported.charts.length, 1)
  assert.equal(imported.charts[0].spec.chart.type, 'bar')
  assert.equal(imported.data.inline.text, 'product,sales\nOne,12\nTwo,24')
  assert.equal(await readFile(chartFile, 'utf8'), beforeImport)
  console.log(JSON.stringify({ result: 'Raw CSV open/save creates a separate correctly named chart and preserves its predecessor.', importedPath: importedSave.saved }))
  await f.getByRole('button', { name: 'Data', exact: true }).click()
  const dataField = f.getByRole('textbox', { name: 'Chart data', exact: true })
  const oldSource = await dataField.inputValue()
  await dataField.fill('different,cost\nA,9')
  const impact = f.getByRole('status').filter({ hasText: 'incoming data' })
  await impact.waitFor()
  assert.match(await impact.innerText(), /product, sales/)
  assert.match(await impact.innerText(), new RegExp(importedTitle))
  assert.equal(JSON.parse(await readFile(`${importedSave.saved}/chart.json`, 'utf8')).data.inline.text, oldSource)
  await f.getByRole('button', { name: 'Discard edits', exact: true }).click()
  assert.equal(await dataField.inputValue(), oldSource)
  console.log('Import impact names the chart and missing columns before Apply; Discard preserves source.')
  await invoke('openChart', { path: original })
} finally {
  await restorePermissions()
  await page.evaluate(() => window.__chartToolQA?.restore())
  await browser.close()
}
