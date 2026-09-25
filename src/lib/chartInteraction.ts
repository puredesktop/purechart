import type { ChartAnnotation } from './chartSpec'

export type InteractionMode = 'read' | 'explore'

export interface InteractivePoint {
  id: string
  cx: number
  cy: number
  value: number
  xLabel: string
  seriesKey: string
  color: string
}

export interface BrushRange {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface BrushSummary {
  count: number
  min: number
  max: number
  average: number
  change: number
}

export interface PlotBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export const DEFAULT_HOVER_DISTANCE = 48

export function pointId(
  seriesKey: string,
  xLabel: string,
  index: number,
): string {
  return `${seriesKey}::${xLabel}::${index}`
}

export function nearestPoint(
  points: InteractivePoint[],
  x: number,
  y: number,
  maxDistance = DEFAULT_HOVER_DISTANCE,
): InteractivePoint | null {
  let nearest: InteractivePoint | null = null
  let nearestDistance = maxDistance * maxDistance

  for (const point of points) {
    const dx = point.cx - x
    const dy = point.cy - y
    const distance = dx * dx + dy * dy
    if (distance <= nearestDistance) {
      nearestDistance = distance
      nearest = point
    }
  }

  return nearest
}

export function normalizeBrush(
  start: { x: number; y: number },
  end: { x: number; y: number },
  plot: PlotBounds,
): BrushRange {
  const x0 = Math.max(plot.left, Math.min(start.x, end.x))
  const x1 = Math.min(plot.right, Math.max(start.x, end.x))
  const y0 = Math.max(plot.top, Math.min(start.y, end.y))
  const y1 = Math.min(plot.bottom, Math.max(start.y, end.y))
  return { x0, x1, y0, y1 }
}

export function brushContainsPoint(
  brush: BrushRange,
  point: InteractivePoint,
): boolean {
  return (
    point.cx >= brush.x0 &&
    point.cx <= brush.x1 &&
    point.cy >= brush.y0 &&
    point.cy <= brush.y1
  )
}

/** The points inside a brush, left to right. */
export function brushSelection(
  points: InteractivePoint[],
  brush: BrushRange | null,
): InteractivePoint[] {
  if (!brush) return []
  return points
    .filter(point => brushContainsPoint(brush, point))
    .sort((a, b) => a.cx - b.cx)
}

export function summarizeBrush(
  points: InteractivePoint[],
  brush: BrushRange | null,
): BrushSummary | null {
  const selected = brushSelection(points, brush)
  if (selected.length === 0) return null

  const values = selected.map(point => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const change = selected[selected.length - 1].value - selected[0].value

  return { count: selected.length, min, max, average, change }
}

export function annotationFromPoint(point: InteractivePoint): ChartAnnotation {
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: `${point.seriesKey} ${point.xLabel}: ${formatAnnotationValue(
      point.value,
    )}`,
    target: {
      kind: 'point',
      seriesKey: point.seriesKey,
      xLabel: point.xLabel,
      value: point.value,
    },
    createdAt: new Date().toISOString(),
  }
}

/**
 * A range annotation from a brush: the x labels of the first and last
 * selected points and the brushed y extent in data units. Nothing about
 * the pixel rectangle survives, so the annotation lands on the same
 * points however large the chart is drawn.
 */
export function annotationFromBrush(
  selected: InteractivePoint[],
  summary: BrushSummary,
  yExtent: { from: number; to: number },
): ChartAnnotation | null {
  const first = selected[0]
  const last = selected[selected.length - 1]
  if (!first || !last) return null
  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: `${summary.count} points · avg ${formatAnnotationValue(
      summary.average,
    )}`,
    target: {
      kind: 'range',
      x: { from: first.xLabel, to: last.xLabel },
      y: {
        from: Math.min(yExtent.from, yExtent.to),
        to: Math.max(yExtent.from, yExtent.to),
      },
      summary,
    },
    createdAt: new Date().toISOString(),
  }
}

function formatAnnotationValue(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
