import { expect, it } from 'vitest'
import { defaultSpec } from './chartSpec'
import { parseTable } from './dataParse'
import { defaultTransform, transformChartData } from './chartTransform'
import { computeChartGeometry } from './chartLayout'
import { renderChartSvg } from './chartRender'
const table = parseTable('region,value\nNorth,10\nNorth,30\nSouth,60\nSouth,')
const spec = defaultSpec()
spec.chart.encodings = { x: 'region', y: ['value'], series: null }
spec.chart.type = 'bar'
it.each([['sum', [40, 60]], ['mean', [20, 60]], ['count', [2, 1]], ['percent', [.4, .6]]] as const)('%s uses explicit groups and tracks original rows', (aggregate, expected) => {
  const next = { ...spec, chart: { ...spec.chart, transform: { ...defaultTransform(spec), aggregate } } }
  const result = transformChartData(table, next)
  expect(result.table.rows.map(row => row.value)).toEqual(expected)
  expect(result.sourceRows).toEqual([[0, 1], [2, 3]])
  expect(table.rows[0].value).toBe(10)
  const geometry = computeChartGeometry(table, next, { width: 800, height: 500 })
  expect(geometry.series[0].points.map(point => point.value)).toEqual(expected)
  expect(renderChartSvg(table, next).message).toBeNull()
})
it('filters and sorts without changing the source, with a zero policy for means', () => {
  const next = { ...spec, chart: { ...spec.chart, transform: { ...defaultTransform(spec), aggregate: 'mean' as const, missing: 'zero' as const, filters: [{ column: 'region', op: 'eq' as const, value: 'South' }], sort: { column: 'value', direction: 'desc' as const } } } }
  const result = transformChartData(table, next)
  expect(result.table.rows[0].value).toBe(30)
  expect(result.excludedRows).toEqual([0, 1])
  expect(result.sourceRows).toEqual([[2, 3]])
  expect(table.rows).toHaveLength(4)
})
it('rejects stale filter columns and negative percentage values', () => {
  const next = { ...spec, chart: { ...spec.chart, transform: { ...defaultTransform(spec), filters: [{ column: 'gone', op: 'eq' as const, value: 'x' }] } } }
  expect(transformChartData(table, next).error).toContain('missing column')
  next.chart.transform = { ...defaultTransform(spec), aggregate: 'percent', filters: [] }
  expect(transformChartData(parseTable('region,value\nA,-1\nB,2'), next).error).toContain('non-negative')
})

it('preserves global percentages and source provenance through faceting without calculating twice', async () => {
  const { facetLayout } = await import('./chartFacet')
  const source = parseTable('x,panel,value,include\nA,One,10,yes\nA,One,20,yes\nB,Two,70,yes\nB,Two,900,no')
  const next = defaultSpec('Shares')
  next.chart.type = 'bar'
  next.chart.encodings = { x: 'x', y: ['value'], series: null }
  next.chart.facet = { column: 'panel', columns: 2 }
  next.chart.axes.y.format = 'percent'
  next.chart.transform = { ...defaultTransform(next), aggregate: 'percent', filters: [{ column: 'include', op: 'eq', value: 'yes' }] }
  const original = JSON.stringify(source)
  const derived = transformChartData(source, next)
  expect(derived.sourceRows).toEqual([[0, 1], [2]])
  expect(derived.excludedRows).toEqual([3])
  expect(derived.table.rows.map(row => row.value)).toEqual([.3, .7])
  const layout = facetLayout(source, next, { width: 900, height: 480 })!
  expect(layout.panels.find(p => p.value === 'One')!.geometry.series[0].points[0].value).toBe(.3)
  expect(layout.panels.find(p => p.value === 'Two')!.geometry.series[0].points[0].value).toBe(.7)
  const rendered = renderChartSvg(source, next, { width: 900, height: 480 })
  expect(rendered.message).toBeNull()
  expect(rendered.svg).toContain('30%')
  expect(rendered.svg).toContain('70%')
  expect(JSON.stringify(source)).toBe(original)
})

it('explains undefined percentages and rejects negatives before aggregation can hide them', () => {
  const next = { ...spec, chart: { ...spec.chart, transform: { ...defaultTransform(spec), aggregate: 'percent' as const } } }
  expect(transformChartData(parseTable('region,value\nA,0\nB,0'), next).error).toContain('total is zero')
  expect(transformChartData(parseTable('region,value\nA,-10\nA,20'), next).error).toContain('non-negative source values')
})
