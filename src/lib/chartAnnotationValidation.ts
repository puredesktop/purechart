import type { ChartSpec } from './chartSpec'
import type { computeChartGeometry } from './chartLayout'

export function validateChartAnnotations(spec: ChartSpec, geometries: ReturnType<typeof computeChartGeometry>[]): void {
  for (const annotation of spec.chart.annotations) {
    const target = annotation.target
    if (target.kind === 'point') {
      if (!geometries.some(g => g.series.some(s => s.key === target.seriesKey && s.points.some(p => p.xLabel === target.xLabel && p.value === target.value)))) {
        throw new Error(`Annotation “${annotation.text}” does not target a plotted point. Update or remove it.`)
      }
    } else {
      const selections = geometries.map(g => {
        const from = g.xPixelForLabel(target.x.from), to = g.xPixelForLabel(target.x.to)
        if (from === null || to === null) return []
        return g.series.flatMap(series => series.points).filter(p => p.cx >= Math.min(from, to) && p.cx <= Math.max(from, to) && p.value >= target.y.from && p.value <= target.y.to).sort((a, b) => a.cx - b.cx)
      }).filter(points => points.length > 0)
      if (!selections.length) throw new Error(`Annotation “${annotation.text}” contains no plotted points.`)
      for (const points of selections) {
        const values = points.map(p => p.value)
        const expected = { count: values.length, min: Math.min(...values), max: Math.max(...values), average: values.reduce((sum, value) => sum + value, 0) / values.length, change: values[values.length - 1] - values[0] }
        for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
          const supplied = target.summary[key]
          if (!Number.isFinite(supplied) || Math.abs(supplied - expected[key]) > Math.max(1, Math.abs(expected[key])) * 1e-9) {
            throw new Error(`Annotation “${annotation.text}” has an incorrect ${key}: expected ${expected[key]}. Update its range summary.`)
          }
        }
      }
    }
  }
}

