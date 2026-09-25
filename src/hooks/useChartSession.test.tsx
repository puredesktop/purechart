import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
const { read, write, binaryWrite } = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), binaryWrite: vi.fn() }))
vi.mock('../bridge/platformBridge', () => ({
  readTextFile: read,
  updateChartSettings: async () => ({}),
  deleteFile: vi.fn(),
  updateAssetMetadata: vi.fn(),
  writeBinaryFile: binaryWrite,
  writeTextFile: write,
}))
import { useChartSession } from './useChartSession'
import { defaultSpec } from '../lib/chartSpec'
import { migrateSheet, serializeSheet } from '../lib/chartSheet'
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
let beforeOpen: (() => Promise<void>) | undefined
let root: Root | null = null
let session!: ReturnType<typeof useChartSession>
function Probe() {
  session = useChartSession({
    beforeOpen,
    ready: false,
    appSettings: {},
    resource: null,
    onResourceHandled: () => {},
  })
  return null
}
afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  beforeOpen = undefined
  read.mockReset()
  write.mockReset()
  binaryWrite.mockReset()
})
it.each([false, true])(
  'ignores an older open completing after the newest open (failure=%s)',
  async fail => {
    let resolve!: (value: string) => void
    let reject!: (error: Error) => void
    read.mockImplementation((path: string) =>
      path.includes('old')
        ? new Promise<string>((yes, no) => {
            resolve = yes
            reject = no
          })
        : Promise.resolve(JSON.stringify(defaultSpec('Newest'))),
    )
    root = createRoot(document.createElement('div'))
    await act(async () => {
      root!.render(<Probe />)
    })
    let pending!: Promise<string | null>
    await act(async () => {
      pending = session.openChartPath('/old.chart')
    })
    await act(async () => {
      await session.openChartPath('/new.chart')
    })
    await act(async () => {
      if (fail) reject(new Error('old read failed'))
      else resolve(JSON.stringify(defaultSpec('Old')))
      await pending
    })
    expect(session.spec.title).toBe('Newest')
    expect(session.documentPath).toBe('/new.chart')
    expect(session.error).toBeNull()
  },
)

it('chooses a bar chart for categorical data and preserves a valid mapping on edits', async () => {
  root = createRoot(document.createElement('div'))
  await act(async () => { root!.render(<Probe />) })
  await act(async () => { session.setPastedText('region,revenue\nNorth,20\nSouth,30') })
  expect(session.spec.chart.type).toBe('bar')
  expect(session.spec.chart.encodings.x).toBe('region')
  expect(session.spec.chart.encodings.y).toEqual(['revenue'])
  await act(async () => { session.setType('lollipop') })
  await act(async () => { session.setPastedText('region,revenue\nNorth,25\nSouth,40') })
  expect(session.spec.chart.type).toBe('lollipop')
  expect(session.table.rows[0].revenue).toBe(25)
})

async function mountSession() {
  root = createRoot(document.createElement('div'))
  await act(async () => { root!.render(<Probe />) })
}

it('undoes shared data replacement with its mappings and restores redo', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('region,revenue\nNorth,20\nSouth,30') })
  const before = session.sheet
  await act(async () => { session.setPastedText('month,cost\n2026-01,7\n2026-02,9') })
  await act(async () => { session.undo() })
  expect(session.sheet).toEqual(before)
  expect(session.table.rows[0].revenue).toBe(20)
  expect(session.liveTable()).toEqual(session.table)
  expect(session.liveSpec()).toEqual(session.spec)
  await act(async () => { session.redo() })
  expect(session.table.rows[0].cost).toBe(7)
  expect(session.spec.chart.encodings.y).toEqual(['cost'])
})

it('restores removed charts and excludes navigation from history', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('region,value\nNorth,20\nSouth,30') })
  const first = session.sheet.charts[0].id
  await act(async () => { session.duplicateChart(first) })
  const duplicate = session.sheet.charts[1].id
  await act(async () => { session.focusChart(first); session.focusChart(null) })
  await act(async () => { session.removeChart(duplicate) })
  await act(async () => { session.undo() })
  expect(session.sheet.charts).toHaveLength(2)
  await act(async () => { session.undo() })
  expect(session.sheet.charts).toHaveLength(1)
  await act(async () => { session.setType('lollipop') })
  expect(session.canRedo).toBe(false)
})

it('groups title typing and records assistant-style changes', async () => {
  await mountSession()
  const original = session.spec.title
  await act(async () => { session.setChartName('A'); session.setChartName('AB'); session.setChartName('ABC') })
  await act(async () => { session.undo() })
  expect(session.spec.title).toBe(original)
  await act(async () => { session.applyChartSpec({ ...session.spec, title: 'Assistant title' }, { table: session.table }) })
  await act(async () => { session.undo() })
  expect(session.spec.title).toBe(original)
})

it('starts a fresh history when opening another document', async () => {
  await mountSession()
  await act(async () => { session.setChartName('Old work') })
  read.mockResolvedValue(JSON.stringify(defaultSpec('Other document')))
  await act(async () => { await session.openChartPath('/other.chart') })
  expect(session.canUndo).toBe(false)
  await act(async () => { session.undo() })
  expect(session.spec.title).toBe('Other document')
})

it('undoes a rectangular paste as one edit and rejects invalid edits without history', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('region,value\nNorth,20\nSouth,30'); session.resetHistory() })
  await act(async () => { session.editData({ kind: 'paste', row: 0, column: 0, text: 'East\t40\nWest\t50\nCentral\t60' }) })
  expect(session.table.rows).toHaveLength(3)
  await act(async () => { session.undo() })
  expect(session.table.rows[0].region).toBe('North')
  expect(session.table.rows).toHaveLength(2)
  expect(session.canUndo).toBe(false)
  await act(async () => { session.editData({ kind: 'rename', column: 1, name: 'region' }) })
  expect(session.error).toContain('unique')
  expect(session.canUndo).toBe(false)
})

it('saves the latest same-turn edits and reopens a complete multi-chart document', async () => {
  await mountSession()
  const disk = new Map<string, string>()
  write.mockImplementation(async (path: string, content: string) => { disk.set(path, content) })
  read.mockImplementation(async (path: string) => disk.get(path))
  await act(async () => {
    session.setPastedText('region,value\nNorth,20\nSouth,30')
    session.duplicateChart(session.sheet.charts[0].id)
    session.setChartName('Latest edit')
    await session.saveChartAs('/saved.chart.json')
  })
  const saved = session.sheet
  await act(async () => { session.setChartName('Later unsaved edit') })
  await act(async () => { await session.openChartPath('/saved.chart.json') })
  expect(session.sheet).toEqual(migrateSheet(JSON.parse(serializeSheet(saved))))
  expect(session.table.rows).toHaveLength(2)
  expect(session.sheet.charts[1].spec.title).toBe('Latest edit')
  expect(session.canUndo).toBe(false)
})

it('keeps the active document and history when saving fails', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('region,value\nNorth,20') })
  const before = session.sheet
  write.mockRejectedValue(new Error('Disk full'))
  await act(async () => { await expect(session.saveChartAs('/failed.chart.json')).rejects.toThrow('Disk full') })
  expect(session.documentPath).toBeNull()
  expect(session.sheet).toEqual(before)
  expect(session.canUndo).toBe(true)
})

it('persists types and calculations and restores them through undo and reopen', async () => {
  await mountSession()
  const disk = new Map<string, string>()
  write.mockImplementation(async (path: string, content: string) => { disk.set(path, content) })
  read.mockImplementation(async (path: string) => disk.get(path))
  await act(async () => { session.setPastedText('id,value\n001,10\n002,bad') })
  await act(async () => { session.editData({ kind: 'type', column: 0, type: 'string' }); session.editData({ kind: 'type', column: 1, type: 'number' }) })
  await act(async () => { session.setTransform({ aggregate: 'mean', missing: 'omit', filters: [], sort: { column: 'id', direction: 'desc' } }); await session.saveChartAs('/typed.chart.json') })
  await act(async () => { await session.openChartPath('/typed.chart.json') })
  expect(session.table.rows[0].id).toBe('001')
  expect(session.table.issues?.[0].value).toBe('bad')
  expect(session.spec.chart.transform?.aggregate).toBe('mean')
  await act(async () => { session.editData({ kind: 'type', column: 1, type: 'string' }) })
  expect(session.table.issues).toBeUndefined()
  await act(async () => { session.undo() })
  expect(session.table.issues?.[0].value).toBe('bad')
})

it('keeps proposals separate from saved state and applies multi-field changes in one undo transaction', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('year,value\n2022,10\n2023,20'); session.focusChart(session.liveSheet().charts[0].id); session.resetHistory() })
  const before = session.sheet
  let proposal!: ReturnType<typeof session.proposeChart>
  await act(async () => { proposal = session.proposeChart({ patch: { title: 'Reviewed', type: 'scatter', style: { grid: true }, caption: 'Measured values.' }, explanation: 'Make observations easier to compare.' }) })
  expect(session.sheet).toBe(before)
  expect(session.canUndo).toBe(false)
  await act(async () => { session.applyProposal(proposal.id) })
  expect(session.spec.title).toBe('Reviewed')
  expect(session.spec.chart.type).toBe('scatter')
  expect(session.proposal).toBeNull()
  await act(async () => { session.undo() })
  expect(session.sheet).toEqual(before)
  expect(session.canUndo).toBe(false)
  await act(async () => { session.redo() })
  expect(session.spec.title).toBe('Reviewed')
  expect(session.spec.chart.caption).toBe('Measured values.')
})
it('refuses stale or already applied proposals, including same-turn edits', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('year,value\n2022,10\n2023,20'); session.focusChart(session.liveSheet().charts[0].id) })
  await act(async () => {
    const proposal = session.proposeChart({ patch: { title: 'Proposed' }, explanation: 'Clarify the title.' })
    session.setChartName('My edit')
    expect(() => session.applyProposal(proposal.id)).toThrow('changed')
  })
  expect(session.spec.title).toBe('My edit')
  await act(async () => {
    const proposal = session.proposeChart({ patch: { title: 'Fresh proposal' }, explanation: 'Use the current chart.' })
    session.applyProposal(proposal.id)
    expect(() => session.applyProposal(proposal.id)).toThrow('no longer available')
  })
})
it('discards pending proposals on document boundaries', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('year,value\n2022,10\n2023,20'); session.focusChart(session.liveSheet().charts[0].id); session.proposeChart({ patch: { title: 'Proposed' }, explanation: 'Rename.' }) })
  read.mockResolvedValue(JSON.stringify(defaultSpec('Another document')))
  await act(async () => { await session.openChartPath('/another.chart.json') })
  expect(session.proposal).toBeNull()
  expect(session.spec.title).toBe('Another document')
})

it('keeps the document and its undo history when the outgoing save guard fails', async () => {
  beforeOpen = async () => { throw new Error('Outgoing save failed') }
  await mountSession()
  await act(async () => { session.setPastedText('x,y\n1,10'); session.focusChart(session.liveSheet().charts[0].id); session.resetHistory() })
  const original = session.sheet
  await act(async () => { session.setChartName('Pending edit') })
  const pending = session.sheet
  await act(async () => { expect(await session.openChartPath('/other.chart')).toBe('Outgoing save failed') })
  expect(read).not.toHaveBeenCalled()
  expect(session.sheet).toBe(pending)
  expect(session.canUndo).toBe(true)
  await act(async () => { session.undo() })
  expect(session.sheet).toEqual(original)
})
it('supersedes an older request still waiting for the outgoing-save guard', async () => {
  let release!: () => void
  let calls = 0
  beforeOpen = () => ++calls === 1 ? new Promise<void>(resolve => { release = resolve }) : Promise.resolve()
  read.mockResolvedValue(JSON.stringify(defaultSpec('Newest')))
  await mountSession()
  let old!: Promise<string | null>
  await act(async () => { old = session.openChartPath('/old.chart.json') })
  await act(async () => { await session.openChartPath('/new.chart.json') })
  await act(async () => { release(); await old })
  expect(read).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledWith('/new.chart.json')
  expect(session.spec.title).toBe('Newest')
})

it('uses the outgoing-save guard for new documents and clears the old sheet only after success', async () => {
  let fail = true
  beforeOpen = async () => { if (fail) throw new Error('Disk unavailable') }
  await mountSession()
  await act(async () => { session.setPastedText('x,y\n1,10'); session.duplicateChart(session.liveSheet().charts[0].id) })
  const previous = session.sheet
  const next = { ...session.spec, title: 'New document' }
  await act(async () => { await expect(session.createDocument(next, session.table)).rejects.toThrow('Disk unavailable') })
  expect(session.sheet).toBe(previous)
  expect(session.canUndo).toBe(true)
  fail = false
  await act(async () => { await session.createDocument(next, session.table) })
  expect(session.sheet.title).toBe('New document')
  expect(session.sheet.focusedId).toBe(session.sheet.charts[0].id)
  expect(session.sheet.charts).toHaveLength(1)
  expect(session.canUndo).toBe(false)
  expect(session.documentPath).toBeNull()
})


it('exports the same-turn chart title and destination together, even through a retained callback', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('region,revenue\nNorth,20\nSouth,30') })
  const exportBeforeRender = session.exportSvg
  await act(async () => {
    session.bindDocumentPath('/tmp/new-destination.chart')
    expect(session.liveDocumentPath()).toBe('/tmp/new-destination.chart')
    const next = { ...session.liveSpec(), title: 'Latest revenue' }
    session.applyChartSpec(next, { table: session.liveTable() })
    const result = await exportBeforeRender(null)
    expect(result).toEqual({ kind: 'file', path: '/tmp/new-destination.chart/assets/figures/latest-revenue.svg' })
  })
  expect(binaryWrite).toHaveBeenCalledTimes(1)
  expect(new TextDecoder().decode(binaryWrite.mock.calls[0][1])).toContain('Latest revenue')
})


it('opens raw data as a fresh selected document without carrying over the old charts or name', async () => {
  await mountSession()
  await act(async () => {
    session.setPastedText('x,y\n1,10')
    session.setTitle('Existing collection')
    session.duplicateChart(session.liveSheet().charts[0].id)
    session.bindDocumentPath('/existing.chart')
  })
  const previous = session.sheet
  read.mockResolvedValue('region,revenue\nNorth,20\nSouth,30')
  await act(async () => { expect(await session.openChartPath('/new-sales.csv')).toBeNull() })
  expect(session.sheet.title).toBe('new-sales')
  expect(session.sheet.charts).toHaveLength(1)
  expect(session.sheet.focusedId).toBe(session.sheet.charts[0].id)
  expect(session.spec.chart.type).toBe('bar')
  expect(session.spec.chart.encodings.y).toEqual(['revenue'])
  expect(session.documentPath).toBeNull()
  expect(session.canUndo).toBe(false)
  expect(previous.title).toBe('Existing collection')
  expect(previous.charts).toHaveLength(2)
  expect(previous.data.inline?.text).toBe('x,y\n1,10')
})

it('keeps the current document and history when a raw-data open is malformed', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('x,y\n1,10'); session.bindDocumentPath('/existing.chart') })
  const previous = session.sheet
  read.mockResolvedValue('{invalid JSON')
  await act(async () => { expect(await session.openChartPath('/broken.json')).toBeTruthy() })
  expect(session.sheet).toBe(previous)
  expect(session.documentPath).toBe('/existing.chart')
  expect(session.canUndo).toBe(true)
})

it('replaces data for every chart and restores all chart mappings and calculations with one undo', async () => {
  await mountSession()
  await act(async () => {
    session.setPastedText('region,revenue\nNorth,20\nSouth,30')
    session.duplicateChart(session.liveSheet().charts[0].id)
    session.setTransform({ aggregate: 'mean', missing: 'omit', filters: [{ column: 'region', op: 'eq', value: 'North' }], sort: null })
  })
  const original = session.sheet
  await act(async () => { session.setPastedText('product,cost\nOne,7\nTwo,9') })
  expect(session.sheet.charts).toHaveLength(2)
  expect(session.sheet.data.inline?.text).toBe('product,cost\nOne,7\nTwo,9')
  expect(session.sheet.charts[0].spec.chart.encodings.y).toEqual(['revenue'])
  expect(session.spec.chart.encodings.y).toEqual(['cost'])
  await act(async () => { session.undo() })
  expect(session.sheet).toEqual(original)
  expect(session.table.rows[0].revenue).toBe(20)
  expect(session.spec.chart.transform?.aggregate).toBe('mean')
  expect(session.spec.chart.transform?.filters[0].column).toBe('region')
  await act(async () => { session.redo() })
  expect(session.sheet.data.inline?.text).toBe('product,cost\nOne,7\nTwo,9')
})


it('does not let a delayed external reload overwrite edits made while reading', async () => {
  await mountSession()
  await act(async () => { session.setPastedText('x,y\n1,10'); session.bindDocumentPath('/existing.chart') })
  let resolve!: (content: string) => void
  read.mockImplementation(() => new Promise<string>(yes => { resolve = yes }))
  let loading!: Promise<string | null>
  await act(async () => { loading = session.openChartPath('/existing.chart', { externalChange: true }) })
  await act(async () => { session.setChartName('My new edit') })
  await act(async () => { resolve(JSON.stringify(defaultSpec('External copy'))); await loading })
  expect(session.spec.title).toBe('My new edit')
  expect(session.canUndo).toBe(true)
})
