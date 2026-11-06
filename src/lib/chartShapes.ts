import { arc as d3arc, scaleBand, scaleLinear } from 'd3'
import { formatChartNumber } from './chartPresentation'
import type { ChartSpec } from './chartSpec'
import { CHART_OVERFLOW_INK, paletteCapacity, seriesColor } from './chartTheme'
import type { ColumnInfo, DataTable } from './dataParse'
import {
  asCategory,
  asNumber,
  collectSeries,
  dateDetailOf,
  emptyGeometry,
  extentOf,
  plotRectFor,
  truncateLabel,
  type AxisTick,
  type BarGeometry,
  type ChartDims,
  type ChartGeometry,
  type GeometryOptions,
  type PointGeometry,
  type SeriesGeometry,
  type SliceGeometry,
} from './chartLayout'

/**
 * The forms that are not one more variation of "x along the bottom, y up the
 * side": pie and donut, drawn round a centre, and horizontal bars, which turn
 * the axes over so long category names can be read.
 *
 * Both return the same ChartGeometry the rest of the app reads, so the
 * review, the findings, the headless renderer and the assistant see them
 * exactly as they see a line chart.
 */

const KEY_ROW = 22
const CHAR = 7

/**
 * Slices, largest first from twelve o'clock.
 *
 * A pie answers one question, "what share of the whole is each part", and
 * only when there are few enough parts to compare by angle. So the slices
 * are sorted (a reader compares neighbours), there are never more slices
 * than the palette has colours for, and the smallest are summed into one
 * grey "Other" rather than painted in a colour borrowed from another slice.
 */
export function computeRadialGeometry(
  table: DataTable,
  spec: ChartSpec,
  dims: ChartDims,
  options: GeometryOptions = {},
): ChartGeometry {
  const { encodings, style, type } = spec.chart
  const xCol = table.columns.find(column => column.name === encodings.x) ?? null
  if (!xCol) return emptyGeometry(dims, 'Choose the column that names each slice as X.')
  if (encodings.y.length === 0) return emptyGeometry(dims, 'Choose the measure each slice shows as Y.')
  if (encodings.y.length > 1) return emptyGeometry(dims, 'A pie shows one measure. Keep one Y column, or use bars to compare several.')
  if (encodings.series) return emptyGeometry(dims, 'A pie splits one measure by the X column. Clear Series, or facet to draw one pie per group.')
  const measure = encodings.y[0]!
  const detail = xCol.type === 'date' ? dateDetailOf(table.rows.map(row => row[xCol.name])) : 'day'

  const totals = new Map<string, number>()
  for (const row of table.rows) {
    const key = asCategory(row[xCol.name], detail)
    const value = asNumber(row[measure])
    if (key === null || value === null) continue
    totals.set(key, (totals.get(key) ?? 0) + value)
  }
  if (totals.size === 0) return emptyGeometry(dims, 'No numeric values to plot.')
  if ([...totals.values()].some(value => value < 0)) {
    return emptyGeometry(dims, 'A pie shows parts of a whole, so every value must be zero or more. Use bars for values that can go below zero.')
  }
  const ranked = [...totals.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
  const total = ranked.reduce((sum, [, value]) => sum + value, 0)
  if (total === 0) return emptyGeometry(dims, 'Every value is zero, so there is no whole to divide.')

  const capacity = paletteCapacity(style.palette, style.customPalettes)
  const keep = ranked.length > capacity ? ranked.slice(0, Math.max(1, capacity - 1)) : ranked
  const rest = ranked.slice(keep.length)
  let otherName = 'Other'
  while (totals.has(otherName)) otherName += ' (combined)'
  const parts: Array<{ key: string; value: number; color: string }> = keep.map(([key, value], index) => ({
    key,
    value,
    color: seriesColor(index, style.palette, style.customPalettes),
  }))
  if (rest.length) parts.push({ key: otherName, value: rest.reduce((sum, [, value]) => sum + value, 0), color: CHART_OVERFLOW_INK })

  const compact = options.compact ?? false
  const top = compact ? 8 : 58
  const bottom = compact ? 8 : 24
  const left = compact ? 8 : 64
  const nameWidth = compact ? 0 : Math.min(220, Math.max(64, ...parts.map(part => part.key.length * CHAR)))
  // Name, then value, then share: the key is a small table, read across.
  const keyWidth = compact ? 0 : 18 + nameWidth + 16 + 84 + 16 + 48
  const available = Math.max(40, dims.height - top - bottom)
  const outer = Math.max(16, Math.min(available / 2 - (compact ? 0 : 18), (dims.width - left - keyWidth - (compact ? 16 : 72)) / 2))
  const cx = compact ? dims.width / 2 : left + outer + 18
  const cy = top + available / 2
  const inner = type === 'donut' ? outer * 0.58 : 0

  const arc = d3arc<{ startAngle: number; endAngle: number }>()
    .innerRadius(inner)
    .outerRadius(outer)
  let angle = 0
  const middles: number[] = []
  const slices: SliceGeometry[] = parts.map(part => {
    const share = part.value / total
    const startAngle = angle
    const endAngle = angle + share * Math.PI * 2
    angle = endAngle
    const mid = (startAngle + endAngle) / 2
    middles.push(mid)
    // d3's angles run clockwise from twelve o'clock.
    const labelRadius = outer + 14
    const labelX = cx + Math.sin(mid) * labelRadius
    const labelY = cy - Math.cos(mid) * labelRadius + 4
    return {
      key: part.key,
      color: part.color,
      value: part.value,
      share,
      path: arc({ startAngle, endAngle }) ?? '',
      labelX,
      labelY,
      labelAnchor: Math.sin(mid) >= 0 ? 'start' : 'end',
      showLabel: !compact && share >= 0.04,
    }
  })

  // Each slice is also a one-point series, so everything that reads series —
  // the palette review, the findings, the assistant — reads a pie too.
  const series: SeriesGeometry[] = slices.map((slice, index) => {
    const mid = middles[index]!
    const point: PointGeometry = {
      cx: cx + Math.sin(mid) * (inner + outer) / 2,
      cy: cy - Math.cos(mid) * (inner + outer) / 2,
      value: slice.value,
      xLabel: slice.key,
    }
    return { key: slice.key, color: slice.color, linePath: null, areaPath: null, points: [point], bars: [], label: null }
  })

  const plot = plotRectFor(dims, { top, right: 16, bottom, left })
  return {
    dims,
    plot,
    xTicks: [],
    yTicks: [],
    xFrame: { start: plot.left, end: plot.left },
    yFrame: { start: plot.bottom, end: plot.bottom },
    series,
    empty: false,
    message: null,
    xPixelForLabel: () => null,
    yPixelForValue: () => cy,
    yValueAtPixel: () => 0,
    xPad: 0,
    yExtent: [0, Math.max(...parts.map(part => part.value))],
    radial: {
      cx,
      cy,
      outer,
      inner,
      total,
      slices,
      key: compact ? null : { x: cx + outer + 56, y: cy - (slices.length * KEY_ROW) / 2 + 6, nameWidth },
      folded: rest.length,
    },
  }
}

/**
 * Bars that run left to right.
 *
 * The same comparison as a column chart — length from zero — turned over so
 * that category names are written out in full on the left instead of being
 * cut to four letters under each column.
 */
export function computeHorizontalBarGeometry(
  table: DataTable,
  spec: ChartSpec,
  dims: ChartDims,
  xCol: ColumnInfo,
  options: GeometryOptions = {},
): ChartGeometry {
  const { encodings, style } = spec.chart
  const detail = xCol.type === 'date' ? dateDetailOf(table.rows.map(row => row[xCol.name])) : 'day'
  const seriesData = collectSeries(table, spec, xCol, options.seriesSelection)
  const values = seriesData.flatMap(series => series.values.map(value => value.y))
  if (values.length === 0) return emptyGeometry(dims, 'No numeric values to plot.')
  if (spec.chart.axes.y.scale === 'log') return emptyGeometry(dims, 'Bars are lengths from zero, so they cannot use a log scale.')

  const categories: string[] = [...(options.xCategories ?? [])]
  for (const row of table.rows) {
    const category = asCategory(row[xCol.name], detail)
    if (category !== null && !categories.includes(category)) categories.push(category)
  }

  const compact = options.compact ?? false
  const seriesCount = options.seriesSelection?.order.length ?? seriesData.length
  const legend = spec.chart.presentation?.legend ?? 'auto'
  const legendTop = !compact && legend !== 'none' && (legend === 'auto' || legend === 'top') && seriesCount > 1
  const longest = Math.max(4, ...categories.map(category => category.length))
  const labelRoom = compact ? 10 : Math.min(dims.width * 0.38, longest * CHAR + 40)
  const plot = plotRectFor(dims, {
    top: compact ? 8 : 58 + (legendTop ? seriesCount * 20 : 0),
    right: compact ? 10 : 64,
    bottom: compact ? 10 : 48,
    left: Math.max(compact ? 10 : 64, labelRoom),
  })

  const forced = options.yDomain
  const axis = spec.chart.axes.y
  const [dataMin, dataMax] = extentOf(values)
  const lo = axis.min ?? Math.min(0, forced ? forced[0] : dataMin)
  const hi = axis.max ?? Math.max(0, forced ? forced[1] : dataMax)
  if (lo > hi) return emptyGeometry(dims, 'Value bounds must increase.')
  const xScale = scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).range([plot.left, plot.right])
  if (axis.min == null && axis.max == null) xScale.nice()
  const band = scaleBand<string>().domain(categories).range([plot.top, plot.bottom]).padding(0.22)
  const bandwidth = band.bandwidth()
  const slotGap = Math.min(3, bandwidth / Math.max(1, seriesCount * 3))
  const barHeight = Math.max(1, (bandwidth - Math.max(0, seriesCount - 1) * slotGap) / Math.max(1, seriesCount))
  const zero = xScale(Math.max(lo, Math.min(0, hi)))

  const series: SeriesGeometry[] = seriesData.map((data, index) => {
    const slot = options.seriesSelection ? options.seriesSelection.order.indexOf(data.key) : index
    const color = seriesColor(slot, style.palette, style.customPalettes)
    const points: PointGeometry[] = []
    const bars: BarGeometry[] = []
    for (const value of data.values) {
      const category = asCategory(value.xRaw, detail)
      const at = category === null ? undefined : band(category)
      if (at === undefined || category === null) continue
      const end = xScale(value.y)
      const y = at + slot * (barHeight + slotGap)
      const centre = y + barHeight / 2
      bars.push({
        x: Math.min(zero, end),
        y,
        width: Math.abs(end - zero),
        height: barHeight,
        value: value.y,
        labelX: value.y >= 0 ? end + 6 : end - 6,
        labelY: centre + 4,
        labelAnchor: value.y >= 0 ? 'start' : 'end',
      })
      points.push({ cx: end, cy: centre, value: value.y, xLabel: category })
    }
    return { key: data.key, color, linePath: null, areaPath: null, points, bars, label: null }
  })

  const maxChars = Math.max(4, Math.floor((plot.left - 24) / CHAR))
  const yTicks: AxisTick[] = categories.map(category => ({
    position: (band(category) ?? 0) + bandwidth / 2,
    label: truncateLabel(category, maxChars),
    fullLabel: category,
  }))
  const xTicks: AxisTick[] = xScale.ticks(5).map(value => ({
    position: xScale(value),
    label: formatChartNumber(value, axis.format),
  }))

  return {
    dims,
    plot,
    xTicks,
    yTicks,
    xFrame: { start: xScale(axis.min ?? Math.min(0, dataMin)), end: xScale(axis.max ?? Math.max(0, dataMax)) },
    yFrame: { start: plot.bottom, end: plot.top },
    series,
    empty: false,
    message: null,
    xPixelForLabel: () => null,
    yPixelForValue: value => xScale(value),
    yValueAtPixel: pixel => xScale.invert(pixel),
    xPad: bandwidth / 2,
    yExtent: [dataMin, dataMax],
    orientation: 'horizontal',
  }
}
