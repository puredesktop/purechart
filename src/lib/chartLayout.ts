import { formatChartNumber } from './chartPresentation'
import { transformChartData } from './chartTransform'
import {
  area as d3area,
  curveMonotoneX,
  line as d3line,
  scaleBand,
  scaleLinear,
  scaleLog,
  scalePoint,
  scaleTime,
  timeFormat,
} from 'd3'
import type { CellValue, ColumnInfo, DataTable } from './dataParse'
import type { ChartSpec, ChartType } from './chartSpec'
import { seriesColor } from './chartTheme'

export interface ChartDims {
  width: number
  height: number
}

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PlotRect {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

export interface AxisTick {
  position: number
  label: string
  fullLabel?: string
}

export interface PointGeometry {
  cx: number
  cy: number
  value: number
  error?: { lower: number; upper: number; lowerY: number; upperY: number }
  xLabel: string
}

export interface BarGeometry {
  x: number
  y: number
  width: number
  height: number
  value: number
  labelX: number
  labelY: number
}

export interface SeriesGeometry {
  key: string
  color: string
  linePath: string | null
  areaPath: string | null
  points: PointGeometry[]
  bars: BarGeometry[]
  label: { x: number; y: number; text: string } | null
}

export interface ChartGeometry {
  dims: ChartDims
  plot: PlotRect
  xTicks: AxisTick[]
  yTicks: AxisTick[]
  /** Pixel extent of the data along each axis — for range frames. */
  xFrame: { start: number; end: number }
  yFrame: { start: number; end: number }
  series: SeriesGeometry[]
  empty: boolean
  message: string | null
  /**
   * The scales, for anything stored in data coordinates (saved range
   * annotations): the pixel centre of an x label as getChartData shows
   * it, or null when the label is not on this axis; y in both directions.
   */
  xPixelForLabel: (label: string) => number | null
  yPixelForValue: (value: number) => number
  yValueAtPixel: (pixel: number) => number
  /** Half the room one x position owns — how far a range extends past its end points. */
  xPad: number
  /** The data's own y extent, before any forced domain. */
  yExtent: [number, number]
}

const DEFAULT_MARGINS: Margins = { top: 58, right: 88, bottom: 48, left: 64 }
const MIN_X_TICK_GAP = 72
const X_TICK_CHAR_WIDTH = 7
const MIN_TRUNCATED_LABEL_LENGTH = 4

function asNumber(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  return null
}

function asCategory(value: CellValue): string | null {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

function emptyGeometry(dims: ChartDims, message: string): ChartGeometry {
  return {
    dims,
    plot: plotRectFor(dims, DEFAULT_MARGINS),
    xTicks: [],
    yTicks: [],
    xFrame: { start: 0, end: 0 },
    yFrame: { start: 0, end: 0 },
    series: [],
    empty: true,
    message,
    xPixelForLabel: () => null,
    yPixelForValue: () => 0,
    yValueAtPixel: () => 0,
    xPad: 0,
    yExtent: [0, 0],
  }
}

function plotRectFor(dims: ChartDims, margins: Margins): PlotRect {
  const left = margins.left
  const top = margins.top
  const width = Math.max(0, dims.width - margins.left - margins.right)
  const height = Math.max(0, dims.height - margins.top - margins.bottom)
  return { left, top, width, height, right: left + width, bottom: top + height }
}

function truncateLabel(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label
  if (maxChars <= MIN_TRUNCATED_LABEL_LENGTH) return `${label.slice(0, 3)}…`
  return `${label.slice(0, maxChars - 1)}…`
}

function readableXTicks(ticks: AxisTick[], plot: PlotRect): AxisTick[] {
  if (ticks.length <= 1) return ticks
  const maxVisibleTicks = Math.max(2, Math.floor(plot.width / MIN_X_TICK_GAP))
  const step = Math.max(1, Math.ceil(ticks.length / maxVisibleTicks))
  const visible = ticks.filter((_, index) => index % step === 0)
  const last = ticks[ticks.length - 1]
  if (visible[visible.length - 1] !== last) visible.push(last)
  const slotWidth = Math.max(28, plot.width / Math.max(1, visible.length - 1))
  const maxChars = Math.max(
    MIN_TRUNCATED_LABEL_LENGTH,
    Math.floor(slotWidth / X_TICK_CHAR_WIDTH),
  )
  return visible.map(tick => ({
    ...tick,
    fullLabel: tick.fullLabel ?? tick.label,
    label: truncateLabel(tick.label, maxChars),
  }))
}

interface SeriesData {
  key: string
  values: Array<{ xRaw: CellValue; y: number; row?: DataTable['rows'][number] }>
}

/** Short number for a bin edge: 12, 12.5, 1200 — never 12.499999. */
function edgeLabel(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toPrecision(4)))
}

/**
 * A histogram bins one measure and counts. Every series' values share the
 * same nice bin edges (Sturges' rule sizes the count, d3 ticks place the
 * edges), so two series compare bin for bin. Each bin becomes an x
 * category labelled "lo–hi"; the last bin is closed at the top.
 */
export function binSeriesForHistogram(seriesData: SeriesData[], sharedValues?: number[]): {
  series: SeriesData[]
  categories: string[]
} {
  const all = sharedValues ?? seriesData.flatMap(series => series.values.map(value => value.y))
  if (all.length === 0) return { series: [], categories: [] }
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const binCount = Math.max(1, Math.ceil(Math.log2(all.length) + 1))
  const scale = scaleLinear()
    .domain([lo, hi === lo ? lo + 1 : hi])
    .nice(binCount)
  const [d0, d1] = scale.domain() as [number, number]
  const inner = scale.ticks(binCount).filter(tick => tick > d0 && tick < d1)
  const edges = [d0, ...inner, d1]
  const categories = edges
    .slice(0, -1)
    .map((edge, index) => `${edgeLabel(edge)}–${edgeLabel(edges[index + 1]!)}`)
  const binIndex = (y: number): number => {
    let index = 0
    while (index < edges.length - 2 && y >= edges[index + 1]!) index += 1
    return index
  }
  const series = seriesData.map(data => {
    const counts = new Array<number>(categories.length).fill(0)
    for (const value of data.values) counts[binIndex(value.y)] += 1
    return {
      key: data.key,
      values: categories.map((label, index) => ({
        xRaw: label,
        y: counts[index]!,
      })),
    }
  })
  return { series, categories }
}

/** Build the per-series data the geometry needs, before pixel mapping. */
function collectSeries(
  table: DataTable,
  spec: ChartSpec,
  xCol: ColumnInfo | null,
  selection?: SeriesSelection,
): SeriesData[] {
  const { encodings } = spec.chart
  const yCols = encodings.y
  const xRawOf = (row: DataTable['rows'][number]): CellValue =>
    xCol ? row[xCol.name] : null

  // series column: split a single y column into one series per category value
  if (encodings.series && yCols.length > 0) {
    const yName = yCols[0]
    const groups = new Map<string, SeriesData>()
    for (const row of table.rows) {
      const key = asCategory(row[encodings.series]) ?? '—'
      const y = asNumber(row[yName])
      if (y === null) continue
      if (!groups.has(key)) groups.set(key, { key, values: [] })
      groups.get(key)!.values.push({ xRaw: xRawOf(row), y, row })
    }
    return foldTail([...groups.values()], encodings.limitSeries ?? 0, selection)
  }

  // otherwise one series per y column
  return foldTail(
    yCols.map(yName => ({
      key: yName,
      values: table.rows
        .map(row => ({ xRaw: xRawOf(row), y: asNumber(row[yName]), row }))
        .filter((v): v is { xRaw: CellValue; y: number; row: DataTable['rows'][number] } => v.y !== null),
    })),
    encodings.limitSeries ?? 0, selection,
  )
}

/**
 * Keep the largest `limit` series and sum the rest into "Other".
 *
 * Largest by total, not by final value, so the group that is folded is the
 * one that contributes least to the chart overall rather than the one having
 * a quiet month at the right-hand edge. The fold is summed per x position:
 * "Other" is a real quantity, not a line drawn through the leftovers.
 */
export interface SeriesSelection { keep: string[]; order: string[]; other: string }
function chooseSeries(series: SeriesData[], limit: number): SeriesSelection {
  const ranked = [...series].sort((a, b) => b.values.reduce((sum, value) => sum + value.y, 0) - a.values.reduce((sum, value) => sum + value.y, 0))
  const kept = new Set((limit > 0 ? ranked.slice(0, limit) : ranked).map(entry => entry.key))
  const keep = series.filter(entry => kept.has(entry.key)).map(entry => entry.key)
  let other = 'Other'
  while (series.some(entry => entry.key === other)) other += ' (combined)'
  return { keep, order: [...keep, ...(keep.length < series.length ? [other] : [])], other }
}
export function chartSeriesSelection(table: DataTable, spec: ChartSpec): SeriesSelection {
  const all = { ...spec, chart: { ...spec.chart, encodings: { ...spec.chart.encodings, limitSeries: 0 } } }
  return chooseSeries(collectSeries(table, all, table.columns.find(c => c.name === spec.chart.encodings.x) ?? null), spec.chart.encodings.limitSeries ?? 0)
}
function foldTail(series: SeriesData[], limit: number, selection = chooseSeries(series, limit)): SeriesData[] {
  const keptKeys = new Set(selection.keep)
  const folded = series.filter(entry => !keptKeys.has(entry.key))
  const totals = new Map<string, { xRaw: CellValue; y: number }>()
  for (const entry of folded) {
    for (const value of entry.values) {
      const key = asCategory(value.xRaw) ?? '—'
      const existing = totals.get(key)
      if (existing) existing.y += value.y
      else totals.set(key, { xRaw: value.xRaw, y: value.y })
    }
  }
  // Keep the original order among those kept, so colours do not shuffle.
  return [
    ...series.filter(entry => keptKeys.has(entry.key)).sort((a, b) => selection.order.indexOf(a.key) - selection.order.indexOf(b.key)),
    ...(folded.length ? [{ key: selection.other, values: [...totals.values()] }] : []),
  ]
}

function useBand(type: ChartType, xCol: ColumnInfo): boolean {
  return (
    type === 'bar' ||
    type === 'grouped-bar' ||
    type === 'stacked-bar' ||
    type === 'histogram' ||
    xCol.type === 'string'
  )
}

function isLineLike(type: ChartType): boolean {
  return (
    type === 'line' ||
    type === 'area' ||
    type === 'connected-scatter' ||
    type === 'slopegraph'
  )
}

function isBarLike(type: ChartType): boolean {
  return (
    type === 'bar' ||
    type === 'grouped-bar' ||
    type === 'stacked-bar' ||
    type === 'histogram'
  )
}

/** Per-category totals of a stacked chart: positive and negative stacks apart. */
function stackedTotals(seriesData: SeriesData[]): number[] {
  const above = new Map<string, number>()
  const below = new Map<string, number>()
  for (const data of seriesData) {
    for (const value of data.values) {
      const key = asCategory(value.xRaw) ?? ''
      const stack = value.y >= 0 ? above : below
      stack.set(key, (stack.get(key) ?? 0) + value.y)
    }
  }
  return [...above.values(), ...below.values()]
}

/**
 * Compute everything the SVG renderer needs from a table + spec + pixel size.
 * Pure: no DOM. d3 is used only for scales/line/format math.
 */
export interface GeometryOptions {
  /**
   * Force the y extent instead of taking it from this table.
   *
   * Small multiples only mean anything on one scale: panels that each fit
   * their own data look alike whatever the numbers are, which is the opposite
   * of a comparison. The grid measures every panel first and hands the same
   * domain to each.
   */
  yDomain?: [number, number]
  xDomain?: [number, number]
  xCategories?: string[]
  histogramValues?: number[]
  seriesSelection?: SeriesSelection
  /**
   * Draw into the whole box.
   *
   * The default margins leave room for a title, a legend and tick labels. In
   * a thumbnail there is room for none of those, and at that size they eat
   * the plot entirely — a 96px-tall chart has no height left at all.
   */
  compact?: boolean
}

const COMPACT_MARGINS: Margins = { top: 8, right: 10, bottom: 10, left: 10 }

export function computeChartGeometry(
  table: DataTable,
  spec: ChartSpec,
  dims: ChartDims,
  options: GeometryOptions = {},
): ChartGeometry {
  const transformed = transformChartData(table, spec)
  if (transformed.error) return emptyGeometry(dims, transformed.error)
  table = transformed.table
  const { encodings, type, style } = {
    encodings: spec.chart.encodings,
    type: spec.chart.type,
    style: spec.chart.style,
  }

  if (table.columns.length === 0) return emptyGeometry(dims, 'No data yet.')
  // A histogram bins the Y measure itself; it has no x column to choose.
  const histogram = type === 'histogram'
  const xCol = table.columns.find(column => column.name === encodings.x) ?? null
  if (!xCol && !histogram) return emptyGeometry(dims, 'Choose an X column.')
  if (encodings.y.length === 0) {
    return emptyGeometry(
      dims,
      histogram ? 'Choose the column to bin as Y.' : 'Choose a Y column.',
    )
  }

  const rawSeries = collectSeries(table, spec, xCol, options.seriesSelection)
  const rawValues = rawSeries.flatMap(series => series.values.map(v => v.y))
  if (rawValues.length === 0)
    return emptyGeometry(dims, 'No numeric values to plot.')
  const binned = histogram ? binSeriesForHistogram(rawSeries, options.histogramValues) : null
  const seriesData = binned ? binned.series : rawSeries
  const seriesCount = options.seriesSelection?.order.length ?? seriesData.length
  const legend = spec.chart.presentation?.legend ?? 'auto'
  const showLegend = legend !== 'none' && (legend !== 'auto' || isBarLike(type))
  const legendPosition = legend === 'auto' ? 'top' : legend
  const baseMargins = options.compact ? COMPACT_MARGINS : DEFAULT_MARGINS
  const directLabelSpace = !options.compact && style.directLabels && !isBarLike(type)
    ? Math.min(240, dims.width * .3, Math.max(...seriesData.map(series => series.key.length * 7 + 24))) : 0
  const plot = plotRectFor(dims, {
    ...baseMargins,
    top:
      baseMargins.top +
      (!options.compact && showLegend && legendPosition === 'top' ? seriesCount * 20 : 0),
    right: Math.max(baseMargins.right, directLabelSpace) + (!options.compact && showLegend && legendPosition === 'right' ? 100 : 0),
    bottom: baseMargins.bottom + (!options.compact && showLegend && legendPosition === 'bottom' ? seriesCount * 20 : 0),
  })
  const allY = seriesData.flatMap(series => series.values.map(v => v.y))

  // Stacked bars pile each category's series on top of one another, so the
  // y domain must hold the per-category totals (positive and negative
  // stacks separately), not the individual values.
  const stacked = type === 'stacked-bar'
  const stackTotals = stacked ? stackedTotals(seriesData) : null
  const errorBars = spec.chart.presentation?.errorBars
  if (errorBars && (spec.chart.encodings.y.length !== 1 || ['histogram', 'stacked-bar'].includes(type))) return emptyGeometry(dims, 'Error bars require one Y measure on an unstacked chart.')
  if (errorBars && seriesData.some(series => series.values.some(value => !value.row))) return emptyGeometry(dims, 'Error bounds cannot be combined when series are folded into Other. Show individual series or use facets.')
  if (errorBars && transformed.sourceRows.some(rows => rows.length !== 1)) return emptyGeometry(dims, 'Error bounds must describe individual plotted rows. Use unique categories or individual rows, without aggregation of duplicates.')
  if (errorBars && ![errorBars.lower, errorBars.upper].every(name => table.columns.some(c => c.name === name && c.type === 'number'))) return emptyGeometry(dims, 'Choose numeric lower and upper error-bound columns.')
  if (errorBars && table.rows.some(row => {
    const lo = asNumber(row[errorBars.lower]), hi = asNumber(row[errorBars.upper]), value = asNumber(row[encodings.y[0]])
    return lo === null || hi === null || value === null || lo > value || hi < value
  })) return emptyGeometry(dims, 'Each error interval must have finite bounds with lower ≤ value ≤ upper.')
  const errorValues = errorBars ? table.rows.flatMap(row => [asNumber(row[errorBars.lower])!, asNumber(row[errorBars.upper])!]) : []
  const domainValues = stackTotals ? [...stackTotals, 0] : [...allY, ...errorValues]

  // y scale (bars get a zero baseline; lines/scatter hug the data)
  const dataMin = Math.min(...domainValues)
  const dataMax = Math.max(...domainValues)
  const barLike = isBarLike(type)
  const forced = options.yDomain
  const axisY = spec.chart.axes.y
  const logY = axisY.scale === 'log'
  if (logY && (barLike || domainValues.some(value => value <= 0))) return emptyGeometry(dims, 'Log Y requires positive values and a line or scatter chart.')
  const yMin = axisY.min ?? (forced ? (barLike ? Math.min(0, forced[0]) : forced[0]) : barLike ? Math.min(0, dataMin) : dataMin)
  const yMax = axisY.max ?? (forced ? (barLike ? Math.max(0, forced[1]) : forced[1]) : barLike ? Math.max(0, dataMax) : dataMax)
  if (yMin > yMax || (yMin === yMax && (axisY.min != null || axisY.max != null)) || (logY && yMin <= 0)) return emptyGeometry(dims, 'Y bounds must increase; logarithmic bounds must be positive.')
  const yScale = (logY ? scaleLog() : scaleLinear())
    .domain([yMin, yMax === yMin ? (logY ? yMin * 10 : yMin + 1) : yMax])
    .range([plot.bottom, plot.top])
  if (axisY.min == null && axisY.max == null) yScale.nice()

  const banded = histogram || (xCol !== null && useBand(type, xCol))

  if (banded && (spec.chart.axes.x.scale === 'log' || spec.chart.axes.x.min != null || spec.chart.axes.x.max != null)) return emptyGeometry(dims, 'X bounds and log scales require a continuous numeric or date axis, not categories.')

  let xPos: (raw: CellValue) => number | null
  let xTicks: AxisTick[]
  let xFrameStart: number
  let xFrameEnd: number
  let bandwidth = 0
  let xPixelForLabel: (label: string) => number | null
  let xPad = 6

  if (banded) {
    const categories: string[] = binned ? [...binned.categories] : [...options.xCategories ?? []]
    if (!binned && xCol) {
      for (const row of table.rows) {
        const cat = asCategory(row[xCol.name])
        if (cat !== null && !categories.includes(cat)) categories.push(cat)
      }
    }
    if (barLike) {
      const scale = scaleBand<string>()
        .domain(categories)
        .range([plot.left, plot.right])
        .padding(0.2)
      bandwidth = scale.bandwidth()
      xPos = raw => {
        const cat = asCategory(raw)
        const at = cat === null ? undefined : scale(cat)
        return at === undefined ? null : at
      }
      xFrameStart = plot.left
      xFrameEnd = plot.right
      xTicks = categories.map(cat => ({
        position: (scale(cat) ?? 0) + bandwidth / 2,
        label: cat,
      }))
      xPixelForLabel = label => {
        const at = scale(label)
        return at === undefined ? null : at + bandwidth / 2
      }
      xPad = bandwidth / 2
    } else {
      const scale = scalePoint<string>()
        .domain(categories)
        .range([plot.left, plot.right])
        .padding(0.5)
      xPos = raw => {
        const cat = asCategory(raw)
        const at = cat === null ? undefined : scale(cat)
        return at === undefined ? null : at
      }
      xFrameStart = scale(categories[0]) ?? plot.left
      xFrameEnd = scale(categories[categories.length - 1]) ?? plot.right
      xTicks = categories.map(cat => ({
        position: scale(cat) ?? 0,
        label: cat,
      }))
      xPixelForLabel = label => scale(label) ?? null
      xPad = scale.step() / 2
    }
  } else {
    // Only reached with a real x column: histograms are always banded.
    const xColumn = xCol as ColumnInfo
    const xNums = table.rows
      .map(row => asNumber(row[xColumn.name]))
      .filter((n): n is number => n !== null)
    const axisX = spec.chart.axes.x
    const xLo = axisX.min ?? options.xDomain?.[0] ?? Math.min(...xNums)
    const xHi = axisX.max ?? options.xDomain?.[1] ?? Math.max(...xNums)
    if (xLo > xHi || (xLo === xHi && (axisX.min != null || axisX.max != null))) return emptyGeometry(dims, 'X bounds must increase.')
    if (axisX.scale === 'log' && (xColumn.type !== 'number' || xNums.some(n => n <= 0) || xLo <= 0)) return emptyGeometry(dims, 'Log X requires positive numeric values.')
    if (xColumn.type === 'date') {
      const scale = scaleTime()
        .domain([new Date(xLo), new Date(xHi)])
        .range([plot.left, plot.right])
      if (axisX.min == null && axisX.max == null) scale.nice()
      const fmt = timeFormat('%Y-%m-%d')
      xPos = raw => {
        const n = asNumber(raw)
        return n === null ? null : scale(new Date(n))
      }
      xTicks = scale.ticks(6).map(d => ({ position: scale(d), label: fmt(d) }))
      xFrameStart = scale(new Date(xLo))
      xFrameEnd = scale(new Date(xHi))
      // Date labels are the ISO day asCategory produced; parse them back.
      xPixelForLabel = label => {
        const at = Date.parse(label)
        return Number.isFinite(at) ? scale(new Date(at)) : null
      }
    } else {
      const scale = (axisX.scale === 'log' ? scaleLog() : scaleLinear())
        .domain([xLo, xHi === xLo ? (axisX.scale === 'log' ? xLo * 10 : xLo + 1) : xHi])
        .range([plot.left, plot.right])
      if (axisX.min == null && axisX.max == null) scale.nice()
      xPos = raw => {
        const n = asNumber(raw)
        return n === null ? null : scale(n)
      }
      xTicks = scale
        .ticks(6)
        .map(v => ({ position: scale(v), label: formatChartNumber(v, spec.chart.axes.x.format) }))
      xFrameStart = scale(xLo)
      xFrameEnd = scale(xHi)
      xPixelForLabel = label => {
        const n = asNumber(label)
        return n === null ? null : scale(n)
      }
    }
  }

  // Counts are whole numbers: a histogram axis never shows 0.5.
  const yTicks: AxisTick[] = yScale
    .ticks(5)
    .filter(v => !histogram || Number.isInteger(v))
    .map(v => ({ position: yScale(v), label: formatChartNumber(v, spec.chart.axes.y.format) }))

  const pathBuilder = d3line<PointGeometry>()
    .x(p => p.cx)
    .y(p => p.cy)
    .curve(curveMonotoneX)
  const areaBuilder = d3area<PointGeometry>()
    .x(p => p.cx)
    .y0(plot.bottom)
    .y1(p => p.cy)
    .curve(curveMonotoneX)

  // Running stack heights per category, shared across series in order.
  const stackAbove = new Map<string, number>()
  const stackBelow = new Map<string, number>()

  const series: SeriesGeometry[] = seriesData.map((data, index) => {
    const slot = options.seriesSelection ? options.seriesSelection.order.indexOf(data.key) : index
    const color = seriesColor(slot, style.palette, style.customPalettes)
    const points: PointGeometry[] = []
    const bars: BarGeometry[] = []
    const barGap = Math.min(10, bandwidth * 0.12)
    const usableBarWidth = Math.max(0, bandwidth - barGap)
    const groupedBarWidth = barLike
      ? stacked
        ? Math.max(2, usableBarWidth)
        : Math.max(
            2,
            (usableBarWidth - Math.max(0, seriesCount - 1) * 4) /
              seriesCount,
          )
      : 0
    for (const value of data.values) {
      const cx = xPos(value.xRaw)
      if (cx === null) continue
      // An empty bin keeps its slot on the axis but draws no bar or label.
      if (histogram && value.y === 0) continue
      const xLabel = asCategory(value.xRaw) ?? ''
      if (stacked) {
        // Each segment starts where the previous series' segment ended.
        const stack = value.y >= 0 ? stackAbove : stackBelow
        const from = stack.get(xLabel) ?? 0
        const to = from + value.y
        stack.set(xLabel, to)
        const y0 = yScale(from)
        const y1 = yScale(to)
        const barX = cx + barGap / 2
        const barCenter = barX + groupedBarWidth / 2
        points.push({ cx: barCenter, cy: y1, value: value.y, xLabel })
        bars.push({
          x: barX,
          y: Math.min(y0, y1),
          width: groupedBarWidth,
          height: Math.abs(y0 - y1),
          value: value.y,
          labelX: barCenter,
          labelY: (y0 + y1) / 2 + 4,
        })
        continue
      }
      const cy = yScale(value.y)
      const barX = cx + barGap / 2 + slot * (groupedBarWidth + 4)
      const barCenter = barLike ? barX + groupedBarWidth / 2 : cx
      points.push({
        cx: barCenter,
        cy,
        value: value.y,
        xLabel,
        ...(errorBars && value.row ? { error: {
          lower: asNumber(value.row[errorBars.lower])!,
          upper: asNumber(value.row[errorBars.upper])!,
          lowerY: yScale(asNumber(value.row[errorBars.lower])!),
          upperY: yScale(asNumber(value.row[errorBars.upper])!),
        } } : {}),
      })
      if (barLike) {
        const baseline = yScale(Math.max(0, yMin))
        const y = Math.min(cy, baseline)
        const height = Math.abs(baseline - cy)
        bars.push({
          x: barX,
          y,
          width: groupedBarWidth,
          height,
          value: value.y,
          labelX: barCenter,
          labelY: errorBars && value.row ? yScale(asNumber(value.row[errorBars.upper])!) - 8 : y - 8,
        })
      }
    }
    const last = points[points.length - 1]
    return {
      key: data.key,
      color,
      linePath:
        isLineLike(type) && points.length > 1 ? pathBuilder(points) : null,
      areaPath:
        isLineLike(type) && points.length > 1 ? areaBuilder(points) : null,
      points,
      bars,
      label:
        style.directLabels && last
          ? { x: last.cx + 6, y: last.cy, text: data.key }
          : null,
    }
  })


  return {
    dims,
    plot,
    xTicks: readableXTicks(xTicks, plot),
    yTicks,
    xFrame: { start: xFrameStart, end: xFrameEnd },
    yFrame: { start: yScale(axisY.min != null ? yMin : dataMin), end: yScale(axisY.max != null ? yMax : dataMax) },
    yExtent: [dataMin, dataMax] as [number, number],
    series,
    empty: false,
    message: null,
    xPixelForLabel,
    yPixelForValue: value => yScale(value),
    yValueAtPixel: pixel => yScale.invert(pixel),
    xPad,
  }
}
