import { csvFormatRows, dsvFormat } from 'd3'
import { detectDelimiter, parseTable, type ColumnType, type DataTable } from './dataParse'
import type { ChartSheet } from './chartSheet'

export interface DataGrid { columns: string[]; rows: string[][] }
export type DataEdit =
  | { kind: 'type'; column: number; type: ColumnType | 'auto' }
  | { kind: 'cell'; row: number; column: number; value: string }
  | { kind: 'paste'; row: number; column: number; text: string }
  | { kind: 'rename'; column: number; name: string }
  | { kind: 'insert-row'; row: number }
  | { kind: 'remove-row'; row: number }
  | { kind: 'add-column'; name: string }
  | { kind: 'remove-column'; column: number }

export function dataGrid(text: string, table: DataTable): DataGrid {
  if (text.trim() && !/^[\[{]/.test(text.trim())) {
    const [columns = [], ...rows] = dsvFormat(detectDelimiter(text)).parseRows(text.trim())
    return { columns, rows: rows.map(row => columns.map((_, i) => row[i] ?? '')) }
  }
  if (/^[\[{]/.test(text.trim())) {
    const raw = JSON.parse(text)
    const records = Array.isArray(raw) ? raw : Object.values(raw).find(Array.isArray) ?? [raw]
    return { columns: table.columns.map(c => c.name), rows: (records as Record<string, unknown>[]).map(row => table.columns.map(c => {
      const value = row?.[c.name]
      return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    })) }
  }
  return {
    columns: table.columns.map(c => c.name),
    rows: table.rows.map(row => table.columns.map(c => {
      const value = row[c.name]
      return value == null ? '' : value instanceof Date ? value.toISOString() : String(value)
    })),
  }
}

export function editGrid(source: DataGrid, edit: DataEdit): DataGrid {
  const columns = [...source.columns]
  const rows = source.rows.map(row => [...row])
  const validColumn = (column: number) => {
    if (!Number.isInteger(column) || column < 0 || column >= columns.length) throw new Error('Column no longer exists.')
  }
  const validRow = (row: number, insert = false) => {
    if (!Number.isInteger(row) || row < 0 || row >= rows.length + (insert ? 1 : 0)) throw new Error('Row no longer exists.')
  }
  const validName = (name: string, except = -1) => {
    if (!name.trim() || columns.some((c, i) => i !== except && c === name.trim())) throw new Error('Use a unique, non-empty column name.')
    return name.trim()
  }
  switch (edit.kind) {
    case 'type': validColumn(edit.column); break
    case 'cell': validRow(edit.row); validColumn(edit.column); rows[edit.row][edit.column] = edit.value; break
    case 'rename': validColumn(edit.column); columns[edit.column] = validName(edit.name, edit.column); break
    case 'add-column': columns.push(validName(edit.name)); rows.forEach(row => row.push('')); break
    case 'remove-column':
      validColumn(edit.column)
      if (columns.length < 2) throw new Error('Keep at least one column.')
      columns.splice(edit.column, 1); rows.forEach(row => row.splice(edit.column, 1)); break
    case 'insert-row': validRow(edit.row, true); rows.splice(edit.row, 0, columns.map(() => '')); break
    case 'remove-row': validRow(edit.row); rows.splice(edit.row, 1); break
    case 'paste': {
      validRow(edit.row, true); validColumn(edit.column)
      const block = dsvFormat(edit.text.includes('\t') ? '\t' : detectDelimiter(edit.text)).parseRows(edit.text.replace(/\r?\n$/, ''))
      if (block.some(row => edit.column + row.length > columns.length)) throw new Error('Paste exceeds the available columns. Add columns first.')
      block.forEach((row, i) => {
        const target = edit.row + i
        while (rows.length <= target) rows.push(columns.map(() => ''))
        row.forEach((value, j) => { rows[target][edit.column + j] = value })
      })
      break
    }
  }
  return { columns, rows }
}

export function editSheetData(sheet: ChartSheet, table: DataTable, edit: DataEdit): { sheet: ChartSheet; table: DataTable } {
  const grid = dataGrid(sheet.data.inline?.text ?? '', table)
  const next = editGrid(grid, edit)
  const columnTypes = { ...sheet.data.columnTypes }
  if (edit.kind === 'type') {
    if (edit.type === 'auto') delete columnTypes[grid.columns[edit.column]]
    else columnTypes[grid.columns[edit.column]] = edit.type
  }
  if (edit.kind === 'rename' || edit.kind === 'remove-column') {
    const name = grid.columns[edit.column]
    if (edit.kind === 'rename' && columnTypes[name]) columnTypes[next.columns[edit.column]] = columnTypes[name]
    delete columnTypes[name]
  }
  const text = [next.columns, ...next.rows].map(row => csvFormatRows([row]) || '""').join('\n')
  let charts = sheet.charts
  if (edit.kind === 'rename' || edit.kind === 'remove-column') {
    const old = grid.columns[edit.column]
    const replacement = edit.kind === 'rename' ? next.columns[edit.column] : null
    charts = charts.map(entry => {
      const c = entry.spec.chart
      const rename = (name: string | null) => name === old ? replacement : name
      return { ...entry, spec: { ...entry.spec, chart: { ...c,
        encodings: { ...c.encodings, x: rename(c.encodings.x), y: c.encodings.y.flatMap(name => rename(name) ?? []), series: rename(c.encodings.series) },
        facet: { ...c.facet, column: rename(c.facet.column) },
        ...(c.presentation?.errorBars ? { presentation: { ...c.presentation, errorBars: rename(c.presentation.errorBars.lower) && rename(c.presentation.errorBars.upper) ? { lower: rename(c.presentation.errorBars.lower)!, upper: rename(c.presentation.errorBars.upper)! } : null } } : {}),
        ...(c.transform ? { transform: { ...c.transform,
          filters: c.transform.filters.flatMap(f => rename(f.column) ? [{ ...f, column: rename(f.column)! }] : []),
          sort: c.transform.sort && rename(c.transform.sort.column) ? { ...c.transform.sort, column: rename(c.transform.sort.column)! } : null,
        } } : {}),
      } } }
    })
  }
  return { sheet: { ...sheet, charts, data: { mode: 'inline', inline: { format: 'csv', text }, columnTypes } }, table: parseTable(text, columnTypes) }
}
