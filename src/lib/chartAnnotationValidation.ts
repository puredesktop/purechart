import type { ChartSpec } from './chartSpec'
import { extentOf, type ChartGeometry } from './chartLayout'

/**
 * Does this label name this point?
 *
 * A date column is read as a timestamp but drawn as a day: the chart's x
 * labels come from `asCategory`, which keeps `YYYY-MM-DD`, while
 * `getChartData` hands the agent the full ISO timestamp. Compared exactly,
 * every annotation the tool's own documentation teaches an agent to write
 * was refused as "not a plotted point" on any chart with a date axis.
 */
const DAY_LABEL = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/

function dayOf(label: string): string | null {
  return DAY_LABEL.exec(label)?.[1] ?? null
}

/** Resolve exact categories first, then the day used to draw a date column. */
export function annotationPoint<T extends { xLabel: string; value: number }>(
  points: readonly T[],
  target: { xLabel: string; value: number },
): T | null {
  const label = points.some(point => point.xLabel === target.xLabel)
    ? target.xLabel
    : dayOf(target.xLabel)
  return points.find(point => point.xLabel === label && point.value === target.value) ?? null
}

/** Shared by validation and drawing, including exports and already saved notes. */
export function annotationXPixel(geometry: ChartGeometry, label: string): number | null {
  const exact = geometry.xPixelForLabel(label)
  if (exact !== null) return exact
  const day = dayOf(label)
  return day === null ? null : geometry.xPixelForLabel(day)
}

export function validateChartAnnotations(
  spec: ChartSpec,
  geometries: ChartGeometry[],
): void {
  for (const annotation of spec.chart.annotations) {
    const target = annotation.target
    if (target.kind === 'point') {
      if (!geometries.some(g => g.series.some(s => s.key === target.seriesKey && annotationPoint(s.points, target) !== null))) {
        throw new Error(`Annotation “${annotation.text}” does not target a plotted point. Update or remove it.`)
      }
    } else {
      // Every panel is a subset of one table, so a range is checked against
      // the points it selects across the whole drawing. Requiring the same
      // summary to fit each panel separately made a range annotation
      // impossible on any faceted chart.
      const points = geometries
        .flatMap(g => {
          const from = annotationXPixel(g, target.x.from)
          const to = annotationXPixel(g, target.x.to)
          if (from === null || to === null) return []
          return g.series.flatMap(series => series.points).filter(p => p.cx >= Math.min(from, to) && p.cx <= Math.max(from, to) && p.value >= target.y.from && p.value <= target.y.to)
        })
        .sort((a, b) => a.cx - b.cx)
      if (points.length === 0) throw new Error(`Annotation “${annotation.text}” contains no plotted points.`)
      const values = points.map(p => p.value)
      const [min, max] = extentOf(values)
      const expected = { count: values.length, min, max, average: values.reduce((sum, value) => sum + value, 0) / values.length, change: values[values.length - 1] - values[0] }
      for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        const supplied = target.summary[key]
        if (!Number.isFinite(supplied) || Math.abs(supplied - expected[key]) > Math.max(1, Math.abs(expected[key])) * 1e-9) {
          throw new Error(`Annotation “${annotation.text}” has an incorrect ${key}: expected ${expected[key]}. Update its range summary.`)
        }
      }
    }
  }
}
