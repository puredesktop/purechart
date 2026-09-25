import { sanitizePresentation, type ChartPresentation } from './chartPresentation'
import { sanitizeTransform, type ChartTransform } from './chartTransform'
import type { ColumnTypes } from './dataParse'
import type { DataFormat } from './chartPaths'
import { axisColumns, type DataTable } from './dataParse'
import { CHART_PACKAGE_CONTENT_FILE, CHART_PACKAGE_SUFFIX } from '../constants'
import {
  isChartPaletteId,
  type ChartPalette,
  type ChartPaletteId,
} from './chartTheme'

export const CHART_SCHEMA_VERSION = 1

export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'grouped-bar'
  | 'stacked-bar'
  | 'scatter'
  | 'connected-scatter'
  | 'lollipop'
  | 'slopegraph'
  | 'histogram'

export const CHART_TYPES: ChartType[] = [
  'line',
  'area',
  'bar',
  'grouped-bar',
  'stacked-bar',
  'scatter',
  'connected-scatter',
  'lollipop',
  'slopegraph',
  'histogram',
]

/**
 * Types earlier builds offered but never drew honestly (both rendered as a
 * scatter). Specs that still carry them open as the scatter they were.
 */
const LEGACY_CHART_TYPES: Record<string, ChartType> = {
  heatmap: 'scatter',
  'small-multiples': 'scatter',
}

export interface ChartEncodings {
  /** Column name for the x axis. */
  x: string | null
  /** One or more numeric column names for the y axis (each becomes a series). */
  y: string[]
  /** Optional column whose values split a single y column into series. */
  series: string | null
  /**
   * Keep only the largest N series and sum the rest into one called "Other".
   *
   * Not a display trick: a chart with more series than its palette can keep
   * apart is claiming a distinction it cannot draw, and folding the tail is
   * the honest alternative to inventing a colour. 0 keeps them all.
   */
  limitSeries?: number
}

/**
 * What an axis is called and how its numbers read.
 *
 * Without this an axis is labelled with whatever the column happened to be
 * called — `rating`, out of what? — and a figure that travels into a report
 * carries that ambiguity with it.
 */
export interface ChartAxis {
  min?: number | null
  max?: number | null
  scale?: 'linear' | 'log'
  /** null: fall back to the column name. */
  name: string | null
  /** "minutes", "NZ$", "%" — shown once, not on every tick. */
  unit: string | null
  format: 'plain' | 'grouped' | 'percent' | 'compact'
}

/** Split into one panel per value of a column, all on one scale. */
export interface ChartFacet {
  column: string | null
  /** Panels per row; 0 lets the grid choose from the panel count. */
  columns: number
}

export interface ChartStyle {
  /** Range frames: axis lines span only the data extent. */
  rangeFrame: boolean
  /** Faint reference gridlines (off by default — Tufte). */
  grid: boolean
  /** Label series at the line end instead of a legend. */
  directLabels: boolean
  /** Marginal rug ticks showing the raw distribution. */
  rug: boolean
  palette: ChartPaletteId
  customPalettes: ChartPalette[]
  strokeWidth: number
  pointRadius: number
}

export interface ChartDataInline {
  format: DataFormat
  text: string
}

export interface ChartDataSource {
  path: string
  format: DataFormat
}

export interface ChartData {
  columnTypes?: ColumnTypes
  mode: 'inline' | 'reference'
  inline?: ChartDataInline
  source?: ChartDataSource
}

export interface ChartAnnotation {
  id: string
  text: string
  target:
    | {
        kind: 'point'
        seriesKey: string
        xLabel: string
        value: number
      }
    | {
        kind: 'range'
        /**
         * The x labels (exactly as getChartData shows them) of the first
         * and last point inside the range. Stored as data, never pixels,
         * so the range lands on the same points at any size.
         */
        x: { from: string; to: string }
        /** The y extent in data units. */
        y: { from: number; to: number }
        summary: {
          count: number
          min: number
          max: number
          average: number
          change: number
        }
      }
  createdAt: string
}

export interface ChartSpec {
  schemaVersion: typeof CHART_SCHEMA_VERSION
  title: string
  data: ChartData
  chart: {
    presentation?: ChartPresentation
    transform?: ChartTransform
    type: ChartType
    encodings: ChartEncodings
    style: ChartStyle
    annotations: ChartAnnotation[]
    /**
     * The sentence under the chart. Travels with the figure into whatever
     * document carries it, which is why it belongs to the chart rather than
     * to the page it happens to be on.
     */
    caption: string
    axes: { x: ChartAxis; y: ChartAxis }
    facet: ChartFacet
  }
}

export function defaultAxis(): ChartAxis {
  return { name: null, unit: null, format: 'plain' }
}

export function defaultFacet(): ChartFacet {
  return { column: null, columns: 0 }
}

export function defaultStyle(): ChartStyle {
  return {
    rangeFrame: true,
    grid: false,
    directLabels: true,
    rug: false,
    palette: 'science',
    customPalettes: [],
    strokeWidth: 1.5,
    pointRadius: 2.5,
  }
}

export function defaultEncodings(): ChartEncodings {
  return { x: null, y: [], series: null, limitSeries: 0 }
}

export function defaultSpec(title = 'Untitled chart'): ChartSpec {
  return {
    schemaVersion: CHART_SCHEMA_VERSION,
    title,
    data: { mode: 'inline', inline: { format: 'csv', text: '' } },
    chart: {
      type: 'line',
      encodings: defaultEncodings(),
      style: defaultStyle(),
      annotations: [],
      caption: '',
      axes: { x: defaultAxis(), y: defaultAxis() },
      facet: defaultFacet(),
    },
  }
}

/**
 * Smart defaults so a freshly loaded table renders immediately:
 * x = first date/categorical column, y = numeric columns not used by x.
 */
export function suggestEncodings(table: DataTable): ChartEncodings {
  if (table.columns.length === 0) return defaultEncodings()

  // A year, a quarter or a week number arrives as a number and is an axis,
  // not a quantity. Plotting one as a measure gives a bar of height 2023
  // beside a bar of height 12, which is how a chart says nothing at all.
  const axes = axisColumns(table)
  const nonNumeric = table.columns.filter(column => column.type !== 'number')
  const x = (axes[0] ?? nonNumeric[0]?.name ?? table.columns[0]!.name) as string

  const measures = table.columns
    .filter(column => column.type === 'number')
    .map(column => column.name)
    .filter(name => name !== x && !axes.includes(name))

  const y =
    measures.length > 0
      ? measures
      : table.columns
          .filter(column => column.type === 'number' && column.name !== x)
          .map(column => column.name)

  return { x, y, series: null, limitSeries: 0 }
}

function asDataFormat(value: unknown): DataFormat {
  return value === 'tsv' || value === 'json' ? value : 'csv'
}

function asChartType(value: unknown): ChartType {
  if (CHART_TYPES.includes(value as ChartType)) return value as ChartType
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_CHART_TYPES, value)) {
    return LEGACY_CHART_TYPES[value]!
  }
  return 'line'
}

function asSeriesLimit(value: unknown): number {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.min(24, Math.round(count)) : 0
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value === 'string') return [value]
  return []
}

/** Forward-only normalization: fill missing fields with defaults; never crash on partial input. */
export function migrateSpec(raw: unknown): ChartSpec {
  const base = defaultSpec()
  if (!raw || typeof raw !== 'object') return base

  const input = raw as Record<string, any>
  const chart = (input.chart ?? {}) as Record<string, any>
  const encodings = (chart.encodings ?? {}) as Record<string, any>
  const style = (chart.style ?? {}) as Record<string, any>
  const data = (input.data ?? {}) as Record<string, any>

  return {
    schemaVersion: CHART_SCHEMA_VERSION,
    title: typeof input.title === 'string' ? input.title : base.title,
    data: {
      mode: data.mode === 'reference' ? 'reference' : 'inline',
      ...(data.columnTypes && typeof data.columnTypes === 'object' ? { columnTypes: Object.fromEntries(Object.entries(data.columnTypes).filter(([, type]) => type === 'number' || type === 'date' || type === 'string')) as ColumnTypes } : {}),
      inline: data.inline
        ? {
            format: asDataFormat(data.inline.format),
            text: typeof data.inline.text === 'string' ? data.inline.text : '',
          }
        : base.data.inline,
      source: data.source
        ? {
            path: String(data.source.path ?? ''),
            format: asDataFormat(data.source.format),
          }
        : undefined,
    },
    chart: {
      type: asChartType(chart.type),
      ...(sanitizePresentation(chart.presentation) ? { presentation: sanitizePresentation(chart.presentation) } : {}),
      ...(sanitizeTransform(chart.transform) ? { transform: sanitizeTransform(chart.transform) } : {}),
      encodings: {
        x: typeof encodings.x === 'string' ? encodings.x : null,
        y: asStringArray(encodings.y),
        series: typeof encodings.series === 'string' ? encodings.series : null,
        limitSeries: asSeriesLimit(encodings.limitSeries),
      },
      style: { ...defaultStyle(), ...sanitizeStyle(style) },
      annotations: sanitizeAnnotations(chart.annotations),
      caption: typeof chart.caption === 'string' ? chart.caption : '',
      axes: sanitizeAxes(chart.axes),
      facet: sanitizeFacet(chart.facet),
    },
  }
}

const AXIS_FORMATS: ChartAxis['format'][] = [
  'plain',
  'grouped',
  'percent',
  'compact',
]

function sanitizeAxis(value: unknown): ChartAxis {
  const raw = (value ?? {}) as Record<string, unknown>
  const text = (key: string): string | null => {
    const found = raw[key]
    return typeof found === 'string' && found.trim() !== '' ? found : null
  }
  return {
    ...(typeof raw.min === 'number' && Number.isFinite(raw.min) ? { min: raw.min } : {}),
    ...(typeof raw.max === 'number' && Number.isFinite(raw.max) ? { max: raw.max } : {}),
    ...(raw.scale === 'log' ? { scale: 'log' as const } : {}),
    name: text('name'),
    unit: text('unit'),
    format: AXIS_FORMATS.includes(raw.format as ChartAxis['format'])
      ? (raw.format as ChartAxis['format'])
      : 'plain',
  }
}

function sanitizeAxes(value: unknown): { x: ChartAxis; y: ChartAxis } {
  const raw = (value ?? {}) as Record<string, unknown>
  return { x: sanitizeAxis(raw.x), y: sanitizeAxis(raw.y) }
}

function sanitizeFacet(value: unknown): ChartFacet {
  const raw = (value ?? {}) as Record<string, unknown>
  const columns = Number(raw.columns)
  return {
    column: typeof raw.column === 'string' && raw.column.trim() !== '' ? raw.column : null,
    columns: Number.isFinite(columns) ? Math.max(0, Math.min(6, Math.round(columns))) : 0,
  }
}

function sanitizeAnnotations(value: unknown): ChartAnnotation[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): ChartAnnotation | null => {
      if (!item || typeof item !== 'object') return null
      const annotation = item as Record<string, any>
      if (
        typeof annotation.id !== 'string' ||
        typeof annotation.text !== 'string' ||
        typeof annotation.createdAt !== 'string' ||
        !annotation.target ||
        typeof annotation.target !== 'object'
      ) {
        return null
      }
      const target = annotation.target as Record<string, any>
      if (
        target.kind === 'point' &&
        typeof target.seriesKey === 'string' &&
        typeof target.xLabel === 'string' &&
        typeof target.value === 'number'
      ) {
        return {
          id: annotation.id,
          text: annotation.text,
          target: {
            kind: 'point',
            seriesKey: target.seriesKey,
            xLabel: target.xLabel,
            value: target.value,
          },
          createdAt: annotation.createdAt,
        }
      }
      // A range is kept only in data coordinates. Earlier builds stored the
      // brush rectangle in pixels (`range: {x0,x1,y0,y1}`); those cannot be
      // placed on a chart of any other size and are dropped.
      if (
        target.kind === 'range' &&
        target.x &&
        typeof target.x === 'object' &&
        typeof target.x.from === 'string' &&
        typeof target.x.to === 'string' &&
        target.y &&
        typeof target.y === 'object' &&
        Number.isFinite(Number(target.y.from)) &&
        Number.isFinite(Number(target.y.to)) &&
        target.summary &&
        typeof target.summary === 'object'
      ) {
        return {
          id: annotation.id,
          text: annotation.text,
          target: {
            kind: 'range',
            x: { from: target.x.from, to: target.x.to },
            y: {
              from: Math.min(Number(target.y.from), Number(target.y.to)),
              to: Math.max(Number(target.y.from), Number(target.y.to)),
            },
            summary: {
              count: Number(target.summary.count ?? 0),
              min: Number(target.summary.min ?? 0),
              max: Number(target.summary.max ?? 0),
              average: Number(target.summary.average ?? 0),
              change: Number(target.summary.change ?? 0),
            },
          },
          createdAt: annotation.createdAt,
        }
      }
      return null
    })
    .filter((item): item is ChartAnnotation => item !== null)
}

function sanitizeStyle(style: Record<string, any>): Partial<ChartStyle> {
  const result: Partial<ChartStyle> = {}
  const customPalettes = sanitizeCustomPalettes(style.customPalettes)
  if (typeof style.rangeFrame === 'boolean')
    result.rangeFrame = style.rangeFrame
  if (typeof style.grid === 'boolean') result.grid = style.grid
  if (typeof style.directLabels === 'boolean')
    result.directLabels = style.directLabels
  if (typeof style.rug === 'boolean') result.rug = style.rug
  if (customPalettes.length) result.customPalettes = customPalettes
  if (
    isChartPaletteId(style.palette) ||
    customPalettes.some(palette => palette.id === style.palette)
  ) {
    result.palette = style.palette
  }
  if (typeof style.strokeWidth === 'number' && Number.isFinite(style.strokeWidth) && style.strokeWidth > 0)
    result.strokeWidth = style.strokeWidth
  if (typeof style.pointRadius === 'number' && Number.isFinite(style.pointRadius) && style.pointRadius >= 0)
    result.pointRadius = style.pointRadius
  return result
}

function sanitizeCustomPalettes(value: unknown): ChartPalette[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): ChartPalette | null => {
      if (!item || typeof item !== 'object') return null
      const palette = item as Record<string, any>
      const id = typeof palette.id === 'string' ? palette.id.trim() : ''
      const label =
        typeof palette.label === 'string' ? palette.label.trim() : ''
      const colors = Array.isArray(palette.colors)
        ? palette.colors
            .map(color => (typeof color === 'string' ? color.trim() : ''))
            .filter(color => /^#[0-9a-f]{6}$/i.test(color))
        : []
      if (!id || !label || colors.length === 0) return null
      return { id, label, colors, custom: true }
    })
    .filter((item): item is ChartPalette => item !== null)
}

export function parseSpecJson(text: string): ChartSpec {
  const raw: unknown = JSON.parse(text)
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  if (!isRecord(raw) || !isRecord(raw.chart) || !isRecord(raw.data)) {
    throw new Error('Invalid chart document: expected chart and data objects.')
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== CHART_SCHEMA_VERSION) {
    throw new Error(`Unsupported chart schema version: ${String(raw.schemaVersion)}`)
  }
  return migrateSpec(raw)
}

export function serializeSpec(spec: ChartSpec): string {
  return `${JSON.stringify(spec, null, 2)}\n`
}

/** A file inside a `.chart` package as the document lifecycle writes it. */
export interface ChartPackageFile {
  name: string
  content: string
}

/**
 * The files of a `.chart` package: the manifest the shell's document
 * services read (title, kind) and the spec itself. One builder so the
 * lifecycle autosave and an explicit "save as package" write byte-identical
 * packages.
 */
export function chartPackageFiles(
  spec: ChartSpec,
  savedAt: string = new Date().toISOString(),
): ChartPackageFile[] {
  return [
    {
      name: 'manifest.json',
      content: `${JSON.stringify(
        {
          schemaVersion: CHART_SCHEMA_VERSION,
          kind: 'purescience.chart.document',
          packageSuffix: CHART_PACKAGE_SUFFIX,
          title: spec.title || 'Untitled chart',
          savedAt,
        },
        null,
        2,
      )}\n`,
    },
    { name: CHART_PACKAGE_CONTENT_FILE, content: serializeSpec(spec) },
  ]
}
