import type { CellValue, DataTable } from './dataParse'
import type { ChartSpec } from './chartSpec'

export type Aggregate = 'none' | 'sum' | 'mean' | 'count' | 'percent'
export interface ChartFilter { column: string; op: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'; value: string }
export interface ChartTransform {
  aggregate: Aggregate
  missing: 'omit' | 'zero'
  filters: ChartFilter[]
  sort: { column: string; direction: 'asc' | 'desc' } | null
}
export interface TransformedData {
  table: DataTable
  sourceRows: number[][]
  excludedRows: number[]
  summary: string
  error?: string
}
const text = (value: CellValue | undefined) => value instanceof Date ? value.toISOString() : value == null ? '' : String(value)
export function defaultTransform(spec: ChartSpec): ChartTransform {
  return { aggregate: ['bar', 'grouped-bar', 'stacked-bar', 'lollipop'].includes(spec.chart.type) ? 'sum' : 'none', missing: 'omit', filters: [], sort: null }
}
export function sanitizeTransform(value: unknown): ChartTransform | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<ChartTransform>
  return {
    aggregate: ['none', 'sum', 'mean', 'count', 'percent'].includes(raw.aggregate ?? '') ? raw.aggregate! : 'none',
    missing: raw.missing === 'zero' ? 'zero' : 'omit',
    filters: Array.isArray(raw.filters) ? raw.filters.filter(f => f && typeof f.column === 'string' && ['eq', 'neq', 'gt', 'lt', 'contains'].includes(f.op) && typeof f.value === 'string') : [],
    sort: raw.sort && typeof raw.sort.column === 'string' && ['asc', 'desc'].includes(raw.sort.direction) ? raw.sort : null,
  }
}

/** Derive plotting values without mutating source rows; row numbers are zero-based. */
export function transformChartData(source: DataTable, spec: ChartSpec): TransformedData {
  const config = spec.chart.transform ?? defaultTransform(spec)
  const enc = spec.chart.encodings
  const known = new Set(source.columns.map(c => c.name))
  const unknown = config.filters.find(f => !known.has(f.column))?.column ?? (config.sort && !known.has(config.sort.column) ? config.sort.column : null)
  if (unknown) return { table: { columns: source.columns, rows: [] }, sourceRows: [], excludedRows: [], summary: '', error: `Calculation refers to missing column “${unknown}”.` }
  const excludedRows: number[] = []
  let entries = source.rows.flatMap((row, index) => {
    const passes = config.filters.every(f => {
      const value = row[f.column]
      if (f.op === 'eq') return text(value) === f.value
      if (f.op === 'neq') return text(value) !== f.value
      if (f.op === 'contains') return text(value).toLowerCase().includes(f.value.toLowerCase())
      const actual = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : NaN
      const expected = value instanceof Date ? Date.parse(f.value) : Number(f.value)
      return Number.isFinite(actual) && Number.isFinite(expected) && (f.op === 'gt' ? actual > expected : actual < expected)
    })
    if (!passes) { excludedRows.push(index); return [] }
    const copy = { ...row }
    if (config.missing === 'zero') enc.y.forEach(y => { if (copy[y] == null) copy[y] = 0 })
    return [{ row: copy, indices: [index] }]
  })
  if (config.aggregate === 'percent' && entries.some(e => enc.y.some(y => typeof e.row[y] === 'number' && (e.row[y] as number) < 0))) return { table: { columns: source.columns, rows: [] }, sourceRows: [], excludedRows, summary: '', error: 'Percentage of total requires non-negative source values.' }
  if (config.aggregate === 'none' && ['bar', 'grouped-bar', 'stacked-bar'].includes(spec.chart.type)) {
    const keys = entries.map(e => JSON.stringify([text(e.row[enc.x ?? '']), text(e.row[enc.series ?? '']), text(e.row[spec.chart.facet.column ?? ''])]))
    if (new Set(keys).size < keys.length) return { table: { columns: source.columns, rows: [] }, sourceRows: [], excludedRows, summary: '', error: 'Repeated bar categories need a calculation. Choose Sum, Average, Count, or Percentage.' }
  }
  if (config.aggregate !== 'none') {
    const dimensions = [...new Set([enc.x, enc.series, spec.chart.facet.column].filter((name): name is string => Boolean(name)))]
    const groups = new Map<string, typeof entries>()
    entries.forEach(entry => {
      const key = JSON.stringify(dimensions.map(d => text(entry.row[d])))
      const group = groups.get(key) ?? []; group.push(entry); groups.set(key, group)
    })
    entries = [...groups.values()].map(group => {
      const row = { ...group[0].row }
      enc.y.forEach(y => {
        const values = group.map(e => e.row[y]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        row[y] = config.aggregate === 'count' ? values.length : values.length ? values.reduce((a, b) => a + b, 0) / (config.aggregate === 'mean' ? values.length : 1) : null
      })
      return { row, indices: group.flatMap(e => e.indices) }
    })
    if (config.aggregate === 'percent') {
      if (entries.some(e => enc.y.some(y => typeof e.row[y] === 'number' && (e.row[y] as number) < 0))) return { table: { columns: source.columns, rows: [] }, sourceRows: [], excludedRows, summary: '', error: 'Percentage of total requires non-negative values.' }
      const zeroTotal = enc.y.find(y => entries.reduce((sum, e) => sum + (typeof e.row[y] === 'number' ? e.row[y] as number : 0), 0) === 0)
      if (zeroTotal) return { table: { columns: source.columns, rows: [] }, sourceRows: [], excludedRows, summary: '', error: `Percentage of total is undefined for “${zeroTotal}” because its filtered total is zero.` }
      enc.y.forEach(y => {
        const total = entries.reduce((sum, e) => sum + (typeof e.row[y] === 'number' ? e.row[y] as number : 0), 0)
        entries.forEach(e => { e.row[y] = total && typeof e.row[y] === 'number' ? (e.row[y] as number) / total : null })
      })
    }
  }
  if (spec.chart.presentation?.errorBars && (entries.some(e => e.indices.length > 1) || config.aggregate === 'percent' || config.aggregate === 'count')) return { table: { columns: source.columns, rows: [] }, sourceRows: [], excludedRows, summary: '', error: 'Error bounds require individual measurements; they cannot be combined or converted into counts or percentages.' }
  if (config.sort) {
    const { column, direction } = config.sort
    entries.sort((a, b) => {
      const av = a.row[column], bv = b.row[column]
      const result = av == null ? bv == null ? 0 : 1 : bv == null ? -1 : typeof av === 'number' && typeof bv === 'number' ? av - bv : text(av).localeCompare(text(bv), undefined, { numeric: true })
      return result * (direction === 'asc' ? 1 : -1)
    })
  }
  const labels = { none: 'Individual rows', sum: 'Sum', mean: 'Average', count: 'Count of numeric values', percent: 'Share of filtered total across all panels (fraction)' }
  return {
    table: { columns: source.columns, rows: entries.map(e => e.row) },
    sourceRows: entries.map(e => e.indices), excludedRows,
    summary: `${labels[config.aggregate]}${config.aggregate === 'none' ? '' : ` grouped by ${[enc.x, enc.series, spec.chart.facet.column].filter(Boolean).join(', ') || 'all rows'}`}. ${excludedRows.length} of ${source.rows.length} source rows filtered out. Missing values ${config.missing === 'zero' ? 'become zero' : 'are omitted from calculations'}.`,
  }
}
