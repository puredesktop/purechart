import { defaultPresentation } from './chartPresentation'
import type { ChartSpec } from './chartSpec'
import { TRENDABLE } from './chartLayout'
import { sanitizeTrend, type TrendSpec } from './chartTrend'
import type { DataTable } from './dataParse'

/**
 * Edits shared by the controls and the assistant's tools, so the two can
 * never disagree about what "add a trendline" or "size by revenue" does.
 */

export class ChartOptionError extends Error {}

/** Draw a fitted trend through every series, or take it away with null. */
export function withTrendline(spec: ChartSpec, trend: TrendSpec | null): ChartSpec {
  const next = trend === null ? null : sanitizeTrend(trend)
  if (trend !== null && !next) throw new ChartOptionError('kind must be linear, exponential or polynomial.')
  if (next && !TRENDABLE.includes(spec.chart.type)) {
    throw new ChartOptionError(`A trendline can be drawn on ${TRENDABLE.join(', ')} charts, not on ${spec.chart.type}.`)
  }
  const presentation = { ...(spec.chart.presentation ?? defaultPresentation()), trendline: next }
  return { ...spec, chart: { ...spec.chart, presentation } }
}

/** The numeric column a bubble's area shows; null clears it. */
export function withBubbleSize(spec: ChartSpec, table: DataTable, column: string | null): ChartSpec {
  if (column !== null && !table.columns.some(entry => entry.name === column && entry.type === 'number')) {
    throw new ChartOptionError(`size must be a numeric column; "${column}" is not one.`)
  }
  return { ...spec, chart: { ...spec.chart, encodings: { ...spec.chart.encodings, size: column } } }
}

/**
 * The size column a bubble chart should start with: a numeric column the
 * chart is not already plotting.
 */
export function suggestBubbleSize(spec: ChartSpec, table: DataTable): string | null {
  const used = new Set([spec.chart.encodings.x, ...spec.chart.encodings.y])
  return table.columns.find(column => column.type === 'number' && !used.has(column.name))?.name ?? null
}

/**
 * Change the form. A bubble chart needs a size column to mean anything, so
 * switching to one picks a sensible column when none is set yet; a trendline
 * the new form cannot carry is dropped rather than left to fail.
 */
export function withType(spec: ChartSpec, table: DataTable, type: ChartSpec['chart']['type']): ChartSpec {
  let next: ChartSpec = { ...spec, chart: { ...spec.chart, type } }
  if (type === 'bubble' && !next.chart.encodings.size) {
    const size = suggestBubbleSize(next, table)
    if (size) next = withBubbleSize(next, table, size)
  }
  if (next.chart.presentation?.trendline && !TRENDABLE.includes(type)) next = withTrendline(next, null)
  return next
}
