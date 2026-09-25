import { dsvFormat } from 'd3'
import type { DataFormat } from './chartPaths'

export type { DataFormat }

export type ColumnType = 'number' | 'date' | 'string'
export type ColumnTypes = Record<string, ColumnType>
export interface DataIssue { row: number; column: string; value: string; message: string }

export interface ColumnInfo {
  name: string
  type: ColumnType
}

export type CellValue = number | string | Date | null

export interface DataTable {
  issues?: DataIssue[]
  columns: ColumnInfo[]
  rows: Array<Record<string, CellValue>>
}

const DELIMITER_CANDIDATES = [',', '\t', ';', '|']

const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const DATE_RE = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?([ T][\d:.]+.*)?$/

export const EMPTY_TABLE: DataTable = { columns: [], rows: [] }

/** Pick the delimiter that splits the first non-empty line into the most fields. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find(value => value.trim().length > 0) ?? ''
  let best = ','
  let bestCount = 0
  for (const candidate of DELIMITER_CANDIDATES) {
    let count = 0
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === '"') {
        if (quoted && line[index + 1] === '"') index += 1
        else quoted = !quoted
      } else if (!quoted && line[index] === candidate) count += 1
    }
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}

function inferType(rawValues: string[]): ColumnType {
  let sawValue = false
  let allNumber = true
  let allDate = true
  for (const raw of rawValues) {
    const value = raw?.trim() ?? ''
    if (value === '') continue
    sawValue = true
    if (!NUMBER_RE.test(value)) allNumber = false
    if (!DATE_RE.test(value) || !Number.isFinite(Date.parse(value))) allDate = false
    if (!allNumber && !allDate) break
  }
  if (!sawValue) return 'string'
  // A bare 4-digit year reads as a number; prefer number over date for those.
  if (allNumber) return 'number'
  if (allDate) return 'date'
  return 'string'
}

export function coerce(raw: string | null | undefined, type: ColumnType): CellValue {
  const value = raw?.trim() ?? ''
  if (value === '') return null
  if (type === 'number') {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  if (type === 'date') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return value
}

/** Parse delimited text (CSV/TSV/…) into a typed table. Quotes/newlines handled by d3-dsv. */
export function parseDelimited(text: string, delimiter?: string, types: ColumnTypes = {}): DataTable {
  const trimmed = text.trim()
  if (trimmed === '') return EMPTY_TABLE
  const delim = delimiter ?? detectDelimiter(trimmed)
  // Positional parsing avoids d3's object conversion losing __proto__ fields.
  const [names = [], ...rawRows] = dsvFormat(delim).parseRows(trimmed)
  if (names.some(name => !name.trim()) || new Set(names).size !== names.length) throw new Error('Each column needs a unique, non-empty heading.')
  if (rawRows.some(row => row.length > names.length)) throw new Error('A data row has more cells than the header. Check delimiters and quoting.')
  const columns: ColumnInfo[] = names.map((name, index) => ({
    name,
    type: Object.hasOwn(types, name) ? types[name] : inferType(rawRows.map(row => row[index] ?? '')),
  }))
  const rows = rawRows.map(rawRow => Object.fromEntries(
    columns.map((column, index) => [column.name, coerce(rawRow[index], column.type)]),
  ))

  const issues: DataIssue[] = []
  rawRows.forEach((row, i) => columns.forEach((column, j) => {
    const value = row[j] ?? ''
    if (value.trim() && coerce(value, column.type) === null) issues.push({ row: i, column: column.name, value, message: `Expected ${column.type}; treated as missing until corrected.` })
  }))
  return issues.length ? { columns, rows, issues } : { columns, rows }
}

function typeOfJsonValue(value: unknown): ColumnType {
  if (typeof value === 'number' && Number.isFinite(value)) return 'number'
  if (typeof value === 'string' && DATE_RE.test(value.trim()) && Number.isFinite(Date.parse(value))) return 'date'
  return 'string'
}

/** Parse a JSON array of records (or `{ data: [...] }`) into a typed table. */
export function parseJsonData(text: string, overrides: ColumnTypes = {}): DataTable {
  const trimmed = text.trim()
  if (trimmed === '') return EMPTY_TABLE
  const data: unknown = JSON.parse(trimmed)

  let records: Array<Record<string, unknown>>
  if (Array.isArray(data)) {
    records = data as Array<Record<string, unknown>>
  } else if (data && typeof data === 'object') {
    const nested = Object.values(data as Record<string, unknown>).find(value =>
      Array.isArray(value),
    )
    records = (nested as Array<Record<string, unknown>>) ?? [
      data as Record<string, unknown>,
    ]
  } else {
    return EMPTY_TABLE
  }

  const names: string[] = []
  for (const record of records) {
    if (!record || typeof record !== 'object') continue
    for (const key of Object.keys(record)) {
      if (!names.includes(key)) names.push(key)
    }
  }

  const columns: ColumnInfo[] = names.map(name => {
    const sample = records
      .map(record => record?.[name])
      .filter(value => value !== null && value !== undefined && value !== '')
    const types = new Set(sample.map(typeOfJsonValue))
    const type: ColumnType = Object.hasOwn(overrides, name) ? overrides[name] : types.size === 1 ? [...types][0] : 'string'
    return { name, type }
  })

  const rows = records.map(record => {
    const row: Record<string, CellValue> = Object.create(null)
    for (const column of columns) {
      const value = record?.[column.name]
      if (value === null || value === undefined || value === '') {
        row[column.name] = null
      } else if (column.type === 'number') {
        const num = Number(value)
        row[column.name] = Number.isFinite(num) ? num : null
      } else if (column.type === 'date') {
        const date = new Date(value as string)
        row[column.name] = Number.isNaN(date.getTime()) ? null : date
      } else {
        row[column.name] =
          typeof value === 'object' ? JSON.stringify(value) : String(value)
      }
    }
    return row
  })

  const issues: DataIssue[] = []
  records.forEach((record, i) => columns.forEach(column => {
    const raw = record?.[column.name]
    if (raw != null && raw !== '' && rows[i][column.name] === null) issues.push({ row: i, column: column.name, value: String(raw), message: `Expected ${column.type}; treated as missing until corrected.` })
  }))
  return issues.length ? { columns, rows, issues } : { columns, rows }
}

export function parseData(text: string, format: DataFormat, types: ColumnTypes = {}): DataTable {
  if (format === 'json') return parseJsonData(text, types)
  if (format === 'tsv') return parseDelimited(text, '\t', types)
  return parseDelimited(text, ',', types)
}

/** Best-effort parse of arbitrary pasted/loaded text: JSON when it looks like JSON, else delimited. */
export function parseTable(text: string, types: ColumnTypes = {}): DataTable {
  const trimmed = text.trim()
  if (trimmed === '') return EMPTY_TABLE
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonData(trimmed, types)
  }
  return parseDelimited(trimmed, undefined, types)
}

/**
 * A numeric column that is really an axis to read along, not a measure.
 *
 * Years arrive as numbers, and so do quarters and week numbers. Charting one
 * as a quantity produces a bar of height 2023 beside a bar of height 12, which
 * is how a chart ends up saying nothing at all. A column whose values are
 * whole and only ever climb — or climb and start over, which is how a second
 * series looks in a long table — is an order.
 */
export function isOrderedColumn(table: DataTable, name: string): boolean {
  const values = table.rows
    .map(row => row[name])
    .filter((value): value is number => typeof value === 'number')
  if (values.length < 3) return false
  if (!values.every(value => Number.isInteger(value))) return false

  let restarts = 0
  for (let index = 1; index < values.length; index += 1) {
    if (values[index]! <= values[index - 1]!) {
      if (values[index] !== values[0]) return false
      restarts += 1
    }
  }
  const distinct = new Set(values).size
  return restarts === 0
    ? distinct === values.length
    : distinct * (restarts + 1) === values.length
}

/** Date columns, plus the numeric columns that are really an axis. */
export function axisColumns(table: DataTable): string[] {
  return [
    ...table.columns.filter(c => c.type === 'date').map(c => c.name),
    ...table.columns
      .filter(c => c.type === 'number' && /(^|[ _-])(year|month|quarter|week|day|time|period|step|index)(s)?($|[ _-])/i.test(c.name) && isOrderedColumn(table, c.name))
      .map(c => c.name),
  ]
}
