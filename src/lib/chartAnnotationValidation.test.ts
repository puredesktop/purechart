import { describe, expect, it } from 'vitest'
import { validateChartAnnotations } from './chartAnnotationValidation'
import { computeChartGeometry, type ChartGeometry } from './chartLayout'
import { facetLayout } from './chartFacet'
import { defaultSpec, type ChartAnnotation, type ChartSpec } from './chartSpec'
import { parseTable } from './dataParse'

const dims = { width: 900, height: 540 }

function pointAnnotation(seriesKey: string, xLabel: string, value: number): ChartAnnotation {
  return {
    id: 'note-1',
    text: 'Callout',
    target: { kind: 'point', seriesKey, xLabel, value },
    createdAt: '2026-10-24T00:00:00.000Z',
  }
}

describe('a point annotation on a date axis', () => {
  const table = parseTable('day,count\n2024-01-15,10\n2024-01-16,20')
  const spec = defaultSpec('Daily')
  spec.chart.encodings = { x: 'day', y: ['count'], series: null, limitSeries: 0 }
  const geometry = computeChartGeometry(table, spec, dims)

  it('accepts the timestamp getChartData hands an agent', () => {
    // The chart labels the day; getChartData shows the full instant. Both name
    // the same mark, so both have to be accepted.
    const annotated: ChartSpec = {
      ...spec,
      chart: { ...spec.chart, annotations: [pointAnnotation('count', '2024-01-15T00:00:00.000Z', 10)] },
    }
    expect(() => validateChartAnnotations(annotated, [geometry])).not.toThrow()
  })

  it('accepts the day as the chart draws it', () => {
    const annotated: ChartSpec = {
      ...spec,
      chart: { ...spec.chart, annotations: [pointAnnotation('count', '2024-01-15', 10)] },
    }
    expect(() => validateChartAnnotations(annotated, [geometry])).not.toThrow()
  })

  it('does not accept a label that merely starts with the day', () => {
    const annotated: ChartSpec = {
      ...spec,
      chart: { ...spec.chart, annotations: [pointAnnotation('count', '2024-01-15-extra', 10)] },
    }
    expect(() => validateChartAnnotations(annotated, [geometry])).toThrow(/does not target/)
  })

  it('still refuses a point the chart does not draw', () => {
    const annotated: ChartSpec = {
      ...spec,
      chart: { ...spec.chart, annotations: [pointAnnotation('count', '2024-01-15T00:00:00.000Z', 11)] },
    }
    expect(() => validateChartAnnotations(annotated, [geometry])).toThrow(/does not target/)
  })
})

describe('a range annotation on a faceted chart', () => {
  const table = parseTable(
    'month,region,value\n2026-01,A,1\n2026-02,A,2\n2026-03,A,3\n2026-01,B,4\n2026-02,B,5\n2026-03,B,6',
  )
  const spec = defaultSpec('By region')
  spec.chart.encodings = { x: 'month', y: ['value'], series: null, limitSeries: 0 }
  spec.chart.facet = { column: 'region', columns: 0 }
  const facets = facetLayout(table, spec, dims)!
  const geometries: ChartGeometry[] = facets.panels.map(panel => panel.geometry)

  const labels = geometries[0]!.series[0]!.points.map(point => point.xLabel)
  const [from, to] = labels
  const points = geometries
    .flatMap(geometry => geometry.series.flatMap(series => series.points))
    .filter(point => (point.xLabel === from || point.xLabel === to) && point.value >= 0 && point.value <= 10)
    .sort((a, b) => a.cx - b.cx)
  const values = points.map(point => point.value)
  const summary = {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    change: values[values.length - 1]! - values[0]!,
  }

  function range(summaryOverride: Partial<typeof summary>): ChartAnnotation {
    return {
      id: 'range-1',
      text: 'Jan–Feb',
      target: { kind: 'range', x: { from: from!, to: to! }, y: { from: 0, to: 10 }, summary: { ...summary, ...summaryOverride } },
      createdAt: '2026-10-24T00:00:00.000Z',
    }
  }

  it('accepts a summary computed across the whole drawing', () => {
    // Each panel used to be required to match the same summary on its own,
    // which no single set of numbers could ever do.
    expect(facets.panels.length).toBe(2)
    const annotated: ChartSpec = { ...spec, chart: { ...spec.chart, annotations: [range({})] } }
    expect(() => validateChartAnnotations(annotated, geometries)).not.toThrow()
  })

  it('refuses a summary that does not add up', () => {
    const annotated: ChartSpec = { ...spec, chart: { ...spec.chart, annotations: [range({ count: summary.count + 1 })] } }
    expect(() => validateChartAnnotations(annotated, geometries)).toThrow(/incorrect count/)
  })
})
