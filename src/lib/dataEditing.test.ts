import { expect, it } from 'vitest'
import { dataGrid, editGrid, editSheetData } from './dataEditing'
import { parseTable } from './dataParse'
import { defaultSpec, suggestEncodings } from './chartSpec'
import { sheetFromSpec, duplicateChart } from './chartSheet'

it('preserves raw identifiers, quoted separators and newlines when editing CSV', () => {
  const text = 'id,label,value\n001,"Hello, world",7\n002,"two\nlines",9'
  const grid = dataGrid(text, parseTable(text))
  expect(grid.rows[0][0]).toBe('001')
  expect(grid.rows[1][1]).toBe('two\nlines')
  expect(editGrid(grid, { kind: 'cell', row: 0, column: 2, value: '8' }).rows[0]).toEqual(['001', 'Hello, world', '8'])
  expect(grid.rows[0][2]).toBe('7')
})

it('pastes rectangular spreadsheet selections atomically and extends rows', () => {
  const grid = { columns: ['a', 'b'], rows: [['old', '1']] }
  const next = editGrid(grid, { kind: 'paste', row: 0, column: 0, text: 'North\t20\nSouth\t30\n' })
  expect(next.rows).toEqual([['North', '20'], ['South', '30']])
  expect(() => editGrid(grid, { kind: 'paste', row: 0, column: 1, text: 'a\tb' })).toThrow('exceeds')
  expect(grid.rows).toEqual([['old', '1']])
})

it('renames the shared column and repairs mappings in every chart', () => {
  const spec = defaultSpec()
  const text = 'region,value\nNorth,20\nSouth,30'
  const table = parseTable(text)
  spec.data = { mode: 'inline', inline: { format: 'csv', text } }
  spec.chart.encodings = suggestEncodings(table)
  let sheet = sheetFromSpec(spec)
  sheet = duplicateChart(sheet, sheet.charts[0].id)
  const next = editSheetData(sheet, table, { kind: 'rename', column: 1, name: 'Revenue' })
  expect(next.table.rows[0].Revenue).toBe(20)
  expect(next.sheet.charts.every(c => c.spec.chart.encodings.y.includes('Revenue'))).toBe(true)
  expect(() => editSheetData(sheet, table, { kind: 'rename', column: 1, name: 'region' })).toThrow('unique')
})

it('handles empty tables and column removal without shifting cells', () => {
  let grid = { columns: ['a', 'b'], rows: [['1', '2']] }
  grid = editGrid(grid, { kind: 'remove-row', row: 0 })
  grid = editGrid(grid, { kind: 'insert-row', row: 0 })
  grid = editGrid(grid, { kind: 'remove-column', column: 0 })
  expect(grid).toEqual({ columns: ['b'], rows: [['']] })
  expect(() => editGrid(grid, { kind: 'remove-column', column: 0 })).toThrow('at least one')
})

it('keeps typed invalid input and leading zero text through repeated edits', () => {
  const spec = defaultSpec()
  const text = 'id,amount\n001,12\n002,oops'
  spec.data = { mode: 'inline', inline: { format: 'csv', text } }
  let sheet = sheetFromSpec(spec)
  let table = parseTable(text)
  ;({ sheet, table } = editSheetData(sheet, table, { kind: 'type', column: 0, type: 'string' }))
  ;({ sheet, table } = editSheetData(sheet, table, { kind: 'type', column: 1, type: 'number' }))
  expect(table.rows[0].id).toBe('001')
  expect(table.rows[1].amount).toBeNull()
  expect(table.issues).toEqual([{ row: 1, column: 'amount', value: 'oops', message: expect.any(String) }])
  expect(sheet.data.inline?.text).toContain('oops')
  ;({ sheet, table } = editSheetData(sheet, table, { kind: 'cell', row: 1, column: 1, value: '17' }))
  expect(table.issues).toBeUndefined()
  expect(table.rows[1].amount).toBe(17)
  ;({ sheet, table } = editSheetData(sheet, table, { kind: 'rename', column: 1, name: 'Revenue' }))
  expect(sheet.data.columnTypes).toEqual({ id: 'string', Revenue: 'number' })
})

it('retains invalid JSON values when assigning a number type', () => {
  const spec = defaultSpec()
  const text = '[{"id":"001","value":"bad"},{"id":"002","value":3}]'
  spec.data = { mode: 'inline', inline: { format: 'json', text } }
  const next = editSheetData(sheetFromSpec(spec), parseTable(text), { kind: 'type', column: 1, type: 'number' })
  expect(next.sheet.data.inline?.text).toContain('001,bad')
  expect(next.table.issues?.[0].value).toBe('bad')
})

it('retains an inserted empty row in a one-column table', () => {
  const spec = defaultSpec()
  spec.data = { mode: 'inline', inline: { format: 'csv', text: 'value\n1' } }
  const next = editSheetData(sheetFromSpec(spec), parseTable('value\n1'), { kind: 'insert-row', row: 1 })
  expect(next.table.rows).toHaveLength(2)
  expect(next.table.rows[1].value).toBeNull()
})
