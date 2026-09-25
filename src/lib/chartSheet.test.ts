import { describe, expect, it } from 'vitest'
import {
  addChart,
  duplicateChart,
  emptySheet,
  migrateSheet,
  moveChart,
  removeChart,
  renameSheet,
  serializeSheet,
  sheetFromSpec,
  specForChart,
  withChart,
} from './chartSheet'
import { defaultSpec, type ChartSpec } from './chartSpec'

function lineSpec(title: string): ChartSpec {
  const spec = defaultSpec(title)
  spec.chart.encodings = {
    x: 'month',
    y: ['nominations'],
    series: 'region',
    limitSeries: 0,
  }
  spec.data = { mode: 'inline', inline: { format: 'csv', text: 'month,region,nominations\n2026-01,Aotearoa,18' } }
  return spec
}

describe('a document that was one chart', () => {
  const sheet = sheetFromSpec(lineSpec('Nominations'))

  it('opens as a sheet of one, and looks no different', () => {
    expect(sheet.charts).toHaveLength(1)
    expect(specForChart(sheet, null).chart.encodings.x).toBe('month')
  })

  it('hands the data and palette to the sheet, not the chart', () => {
    expect(sheet.data.inline?.text).toContain('Aotearoa')
    expect(sheet.palette.id).toBe('science')
  })
})

describe('what belongs to the sheet', () => {
  let sheet = emptySheet('Two readings')
  sheet = addChart(sheet, lineSpec('Bars'))

  it('gives every chart the same data', () => {
    sheet = withChart(sheet, sheet.charts[0]!.id, {
      ...specForChart(sheet, sheet.charts[0]!.id),
      data: { mode: 'inline', inline: { format: 'csv', text: 'a,b\n1,2' } },
    })
    for (const chart of sheet.charts) {
      expect(specForChart(sheet, chart.id).data.inline?.text).toBe('a,b\n1,2')
    }
  })

  it('gives every chart the same palette, so a colour means one thing', () => {
    const first = sheet.charts[0]!.id
    const current = specForChart(sheet, first)
    sheet = withChart(sheet, first, {
      ...current,
      chart: { ...current.chart, style: { ...current.chart.style, palette: 'ember' } },
    })
    for (const chart of sheet.charts) {
      expect(specForChart(sheet, chart.id).chart.style.palette).toBe('ember')
    }
  })

  it('keeps form and encodings to the chart they belong to', () => {
    const [first, second] = sheet.charts
    const changed = specForChart(sheet, first!.id)
    changed.chart.type = 'bar'
    sheet = withChart(sheet, first!.id, changed)
    expect(specForChart(sheet, first!.id).chart.type).toBe('bar')
    expect(specForChart(sheet, second!.id).chart.type).not.toBe('bar')
  })
})

describe('adding a chart', () => {
  it('never touches the one already there', () => {
    const before = sheetFromSpec(lineSpec('Lines'))
    const firstId = before.charts[0]!.id
    const after = addChart(before, defaultSpec('Bars'))
    expect(after.charts).toHaveLength(2)
    expect(specForChart(after, firstId).chart.encodings.x).toBe('month')
  })

  it('focuses the new one, because that is what you just asked for', () => {
    const after = addChart(emptySheet(), defaultSpec('Bars'))
    expect(after.focusedId).toBe(after.charts[1]!.id)
  })

  it('duplicates in place, beside its original', () => {
    let sheet = sheetFromSpec(lineSpec('Lines'))
    sheet = addChart(sheet, defaultSpec('Third'))
    const copy = duplicateChart(sheet, sheet.charts[0]!.id)
    expect(copy.charts).toHaveLength(3)
    expect(copy.charts[1]!.spec.title).toBe('Lines')
  })
})

describe('removing a chart', () => {
  it('leaves the sheet, and stops focusing what is gone', () => {
    let sheet = sheetFromSpec(lineSpec('Lines'))
    sheet = addChart(sheet, defaultSpec('Bars'))
    const gone = removeChart(sheet, sheet.focusedId!)
    expect(gone.charts).toHaveLength(1)
    expect(gone.focusedId).toBeNull()
  })

  it('never empties the sheet entirely', () => {
    const sheet = sheetFromSpec(lineSpec('Only one'))
    const gone = removeChart(sheet, sheet.charts[0]!.id)
    expect(gone.charts).toHaveLength(1)
  })
})

describe('the order of the sheet', () => {
  it('can be rearranged, because the order is the argument', () => {
    let sheet = sheetFromSpec(lineSpec('First'))
    sheet = addChart(sheet, defaultSpec('Second'))
    const moved = moveChart(sheet, sheet.charts[1]!.id, 0)
    expect(moved.charts[0]!.spec.title).toBe('Second')
  })
})

describe('saving and opening', () => {
  it('writes the data once, not once per chart', () => {
    let sheet = sheetFromSpec(lineSpec('Lines'))
    sheet = addChart(sheet, lineSpec('Bars'))
    const written = serializeSheet(sheet)
    expect(written.split('Aotearoa')).toHaveLength(2)
  })

  it('reads a sheet back whole', () => {
    let sheet = sheetFromSpec(lineSpec('Lines'))
    sheet = addChart(sheet, defaultSpec('Bars'))
    const read = migrateSheet(JSON.parse(serializeSheet(sheet)))
    expect(read.charts).toHaveLength(2)
    expect(read.data.inline?.text).toContain('Aotearoa')
    expect(specForChart(read, read.charts[0]!.id).chart.encodings.x).toBe('month')
  })

  it('reads a document written before sheets existed', () => {
    const old = {
      schemaVersion: 1,
      title: 'Old',
      data: { mode: 'inline', inline: { format: 'csv', text: 'a,b\n1,2' } },
      chart: { type: 'bar', encodings: { x: 'a', y: ['b'], series: null }, style: {}, annotations: [] },
    }
    const read = migrateSheet(old)
    expect(read.charts).toHaveLength(1)
    expect(read.charts[0]!.spec.chart.type).toBe('bar')
    expect(read.data.inline?.text).toBe('a,b\n1,2')
  })
})

describe('naming', () => {
  it('renaming a chart does not rename the document', () => {
    let sheet = sheetFromSpec(lineSpec('Nominations 2026'))
    sheet = addChart(sheet, defaultSpec('Bars'))
    const focused = sheet.focusedId!
    const spec = specForChart(sheet, focused)
    sheet = withChart(sheet, focused, { ...spec, title: 'Which region is biggest' })
    expect(sheet.title).toBe('Nominations 2026')
    expect(specForChart(sheet, focused).title).toBe('Which region is biggest')
  })

  it('renames the document on its own', () => {
    const sheet = renameSheet(sheetFromSpec(lineSpec('Old')), 'New')
    expect(sheet.title).toBe('New')
  })
})
