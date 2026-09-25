import { transformChartData } from './chartTransform'
import { chartSeriesSelection, computeChartGeometry, type ChartDims, type ChartGeometry } from './chartLayout'
import type { ChartSpec } from './chartSpec'
import type { DataTable } from './dataParse'

/**
 * One panel per value of a column, all on one scale.
 *
 * This is the honest answer to a chart with more series than colour can keep
 * apart, and it is the only form on offer that gets better as the categories
 * multiply rather than worse. Two rules make it a comparison rather than a
 * row of unrelated pictures: every panel shares a y domain, and every panel
 * shows the others behind it in grey so each one is read against the whole.
 */

export interface FacetPanel {
  /** The value of the facet column this panel shows. */
  value: string
  table: DataTable
  geometry: ChartGeometry
  /** Where the panel sits inside the whole drawing. */
  frame: { x: number; y: number; width: number; height: number }
  /** True on the left column and the bottom row, which keep their ticks. */
  showsYAxis: boolean
  showsXAxis: boolean
}

export const FACET_TITLE_HEIGHT = 32
export const FACET_PANEL_TITLE_HEIGHT = 26

export interface FacetLayout {
  message?: string
  compact?: boolean
  panels: FacetPanel[]
  columns: number
  rows: number
  /** The shared extent, so the panels can say what scale they are on. */
  yDomain: [number, number]
}

const GAP = 16
const MIN_PANEL = 160

/** Panels per row: the user's choice, else a grid that stays roughly square. */
export function facetColumns(count: number, requested: number, width: number): number {
  const fits = Math.max(1, Math.floor((width + GAP) / (MIN_PANEL + GAP)))
  if (requested > 0) return Math.min(requested, count, fits)
  if (count <= 3) return Math.min(count, fits)
  return Math.min(Math.ceil(Math.sqrt(count)), fits)
}

/** The distinct values of the facet column, in the order they first appear. */
export function facetValues(table: DataTable, column: string): string[] {
  const seen: string[] = []
  for (const row of table.rows) {
    const raw = row[column]
    if (raw === null || raw === undefined) continue
    const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw)
    if (!seen.includes(value)) seen.push(value)
  }
  return seen
}

function subsetFor(table: DataTable, column: string, value: string): DataTable {
  return {
    columns: table.columns,
    rows: table.rows.filter(row => {
      const raw = row[column]
      if (raw === null || raw === undefined) return false
      const asText =
        raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw)
      return asText === value
    }),
  }
}

/**
 * Lay the panels out and measure them against one another.
 *
 * Panels are ordered by their own final value, largest first, because
 * alphabetical order says nothing and the reader deserves the ordering to
 * carry a reading.
 */
export function facetLayout(
  table: DataTable,
  spec: ChartSpec,
  dims: ChartDims,
  options: { compact?: boolean } = {},
): FacetLayout | null {
  const column = spec.chart.facet.column
  if (!column) return null
  if (!table.columns.some(entry => entry.name === column)) return null

  const transformed = transformChartData(table, spec)
  if (transformed.error) return null
  table = transformed.table
  const values = facetValues(table, column)
  if (values.length < 2) return null

  // A facet column cannot also be the series split, or every panel is one line.
  const panelSpec: ChartSpec = {
    ...spec,
    chart: {
      ...spec.chart,
      style: { ...spec.chart.style, directLabels: false },
      transform: { aggregate: 'none', missing: 'omit', filters: [], sort: null },
      encodings: {
        ...spec.chart.encodings,
        series:
          spec.chart.encodings.series === column
            ? null
            : spec.chart.encodings.series,
      },
      facet: { ...spec.chart.facet, column: null },
    },
  }

  const columns = facetColumns(values.length, spec.chart.facet.columns, dims.width)
  const rows = Math.ceil(values.length / columns)
  const panelWidth = (dims.width - GAP * (columns - 1)) / columns
  const titleHeight = options.compact ? 0 : FACET_TITLE_HEIGHT
  const panelHeight = (dims.height - titleHeight - GAP * (rows - 1)) / rows
  if (panelWidth < 160 || panelHeight < (options.compact ? 65 : 180)) return {
    columns, rows, yDomain: [0, 0], panels: [], compact: options.compact,
    message: `Increase chart size to fit ${values.length} panels, or reduce the number of panels.`,
  }
  const panelDims: ChartDims = {
    width: Math.max(MIN_PANEL, panelWidth),
    height: panelHeight - FACET_PANEL_TITLE_HEIGHT,
  }

  // Every panel uses the same X positions and histogram bins, including
  // categories/dates absent from a particular group.
  const xName = spec.chart.encodings.x
  const xValues = xName ? table.rows.map(row => row[xName]).filter(value => value !== null) : []
  const xCategories = [...new Set(xValues.map(value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value)))]
  const numbers = xValues.map(value => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Number(value)).filter(Number.isFinite)
  const histogramValues = spec.chart.type === 'histogram' ? table.rows.flatMap(row => spec.chart.encodings.y.map(name => row[name])).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : undefined
  const sharedOptions = {
    compact: options.compact, xCategories, histogramValues,
    seriesSelection: chartSeriesSelection(table, panelSpec),
    ...(numbers.length ? { xDomain: [Math.min(...numbers), Math.max(...numbers)] as [number, number] } : {}),
  }

  // Measure every panel first; the scale belongs to the whole, not the panel.
  const subsets = values.map(value => ({
    value,
    table: subsetFor(table, column, value),
  }))
  const extents = subsets.map(
    entry => computeChartGeometry(entry.table, panelSpec, panelDims, sharedOptions).yExtent,
  )
  const yDomain: [number, number] = [
    Math.min(...extents.map(extent => extent[0])),
    Math.max(...extents.map(extent => extent[1])),
  ]

  const measured = subsets.map(entry => {
    const geometry = computeChartGeometry(entry.table, panelSpec, panelDims, { ...sharedOptions, yDomain })
    return { ...entry, geometry, last: lastValue(geometry) }
  })

  const ordered = [...measured].sort((a, b) => b.last - a.last)

  return {
    compact: options.compact,
    columns,
    rows,
    yDomain,
    panels: ordered.map((entry, index) => {
      const column_ = index % columns
      const row = Math.floor(index / columns)
      return {
        value: entry.value,
        table: entry.table,
        geometry: entry.geometry,
        frame: {
          x: column_ * (panelDims.width + GAP),
          y: titleHeight + row * (panelHeight + GAP),
          width: panelDims.width,
          height: panelHeight,
        },
        showsYAxis: column_ === 0,
        showsXAxis: row === rows - 1 || index >= ordered.length - columns,
      }
    }),
  }
}

function lastValue(geometry: ChartGeometry): number {
  const points = geometry.series[0]?.points ?? []
  return points[points.length - 1]?.value ?? 0
}
