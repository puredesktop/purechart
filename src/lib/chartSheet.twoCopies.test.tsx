// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeShell } from '../test/fakeShell'
import { openTwoCopies } from '../test/twoCopies'
import { emptySheet, migrateSheet, sheetPackageFiles, type ChartSheet } from './chartSheet'
import { mergeSheets } from './chartMerge'
import { defaultSpec } from './chartSpec'

vi.mock('@purescience/platform-ui/bridge/documents.mjs', async () => (await import('../test/fakeShell')).fakeDocumentsModule)
vi.mock('@purescience/platform-ui/bridge/workspace.mjs', async () => (await import('../test/fakeShell')).fakeWorkspaceModule)
vi.mock('@purescience/platform-ui/bridge/client.mjs', async () => (await import('../test/fakeShell')).fakeClientModule)

/** Two live copies of PureChart over one `.chart` package, each with the real lifecycle, conditional write and merge. */
const sheet = (): ChartSheet => {
  const start = emptySheet('Sales')
  return {
    ...start,
    data: { mode: 'inline', inline: { format: 'csv', text: 'a,b\n1,2\n' } },
    charts: [{ id: 'first', spec: defaultSpec('First') }, { id: 'second', spec: defaultSpec('Second') }],
  } as ChartSheet
}
const config = {
  contentFile: 'chart.json',
  files: (document: ChartSheet) => sheetPackageFiles(document),
  parse: (text: string) => migrateSheet(JSON.parse(text)),
  merge: mergeSheets,
}
const title = (document: ChartSheet, id: string) => document.charts.find(chart => chart.id === id)?.spec.title
const retitle = (id: string, to: string) => (document: ChartSheet): ChartSheet => ({
  ...document,
  charts: document.charts.map(chart => (chart.id === id ? { ...chart, spec: { ...chart.spec, title: to } } : chart)),
})
const addChart = (id: string) => (document: ChartSheet): ChartSheet => ({ ...document, charts: [...document.charts, { id, spec: defaultSpec(id) }] })

let close: (() => Promise<void>) | undefined
afterEach(async () => { await close?.(); close = undefined; fakeShell.reset() })
async function two() {
  const copies = await openTwoCopies(sheet(), config)
  close = copies.close
  return copies
}

describe('two copies, one after the other', () => {
  it('a change in one reaches the other when it has nothing unsaved', async () => {
    const { a, b, settled, onDisk } = await two()
    await a.edit(retitle('first', 'From A'))
    await settled()
    expect(title(onDisk(), 'first')).toBe('From A')
    expect(title(b.document(), 'first')).toBe('From A')
  })

  it('then both work on it in turn: nothing is lost', async () => {
    const { a, b, settled, onDisk } = await two()
    await a.edit(retitle('first', 'From A'))
    await settled()
    await b.edit(retitle('second', 'From B'))
    await settled()
    await a.edit(addChart('third'))
    await settled()
    expect(title(onDisk(), 'first')).toBe('From A')
    expect(title(onDisk(), 'second')).toBe('From B')
    expect(onDisk().charts.map(chart => chart.id)).toEqual(['first', 'second', 'third'])
  })
})

describe('two copies at the same moment', () => {
  it('both change different charts: both changes stay, on disk and in each copy', async () => {
    const { a, b, together, settled, onDisk } = await two()
    await together(retitle('first', 'From A'), retitle('second', 'From B'))
    await settled()
    for (const document of [onDisk(), a.document(), b.document()]) {
      expect(title(document, 'first')).toBe('From A')
      expect(title(document, 'second')).toBe('From B')
    }
    expect(a.lifecycle().doc.error).toBeNull()
    expect(b.lifecycle().doc.error).toBeNull()
  })

  it('both add a chart: both stay', async () => {
    const { together, settled, onDisk } = await two()
    await together(addChart('from-a'), addChart('from-b'))
    await settled()
    expect(onDisk().charts.map(chart => chart.id).sort()).toEqual(['first', 'from-a', 'from-b', 'second'])
  })

  it('one removes a chart while the other changes another: it stays removed', async () => {
    const { together, settled, onDisk } = await two()
    await together(
      document => ({ ...document, charts: document.charts.filter(chart => chart.id !== 'second') }),
      retitle('first', 'From B'),
    )
    await settled()
    expect(onDisk().charts.map(chart => chart.id)).toEqual(['first'])
    expect(title(onDisk(), 'first')).toBe('From B')
  })

  it('one changes the data and the other a chart: both stay', async () => {
    const { together, settled, onDisk } = await two()
    await together(
      document => ({ ...document, data: { mode: 'inline', inline: { format: 'csv', text: 'a,b\n3,4\n' } } }),
      retitle('second', 'From B'),
    )
    await settled()
    expect(onDisk().data.inline?.text).toContain('3,4')
    expect(title(onDisk(), 'second')).toBe('From B')
  })

  it('both retitle one chart: they end agreeing, with no save left refused', async () => {
    const { a, b, together, settled, onDisk } = await two()
    await together(retitle('first', 'From A'), retitle('first', 'From B'))
    await settled()
    expect(['From A', 'From B']).toContain(title(onDisk(), 'first'))
    expect(title(a.document(), 'first')).toBe(title(onDisk(), 'first'))
    expect(title(b.document(), 'first')).toBe(title(onDisk(), 'first'))
    expect(a.lifecycle().doc.error).toBeNull()
    expect(b.lifecycle().doc.error).toBeNull()
  })

  it('which chart is on screen stays each copy\'s own', () => {
    const base = sheet()
    const merged = mergeSheets(base, { ...base, focusedId: 'first' }, { ...base, focusedId: 'second' })
    expect(merged.focusedId).toBe('first')
  })
})
