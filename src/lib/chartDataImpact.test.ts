import { expect, it } from 'vitest'
import { chartDataImpact } from './chartDataImpact'
import { defaultSpec } from './chartSpec'
import { parseTable } from './dataParse'
it('reports missing plot, facet, calculation and uncertainty columns for every affected chart', () => {
  const spec = defaultSpec('Revenue')
  spec.chart.encodings = { ...spec.chart.encodings, x: 'region', y: ['revenue'], series: null }
  spec.chart.facet.column = 'department'
  spec.chart.transform = { aggregate: 'sum', missing: 'omit', filters: [{ column: 'year', op: 'gt', value: '2020' }], sort: { column: 'rank', direction: 'asc' } }
  spec.chart.presentation = { legend: 'auto', references: [], errorBars: { lower: 'low', upper: 'high' } }
  const before = JSON.stringify(spec)
  expect(chartDataImpact([{ id: '1', spec }, { id: '2', spec: { ...spec, title: 'Comparison' } }], parseTable('region,revenue\nA,10'))).toEqual([
    { title: 'Revenue', missing: ['department', 'year', 'rank', 'low', 'high'] },
    { title: 'Comparison', missing: ['department', 'year', 'rank', 'low', 'high'] },
  ])
  expect(JSON.stringify(spec)).toBe(before)
})
it('does not warn when replacement values keep every required column', () => {
  const spec = defaultSpec('Sales')
  spec.chart.encodings = { ...spec.chart.encodings, x: 'x', y: ['y'], series: null }
  expect(chartDataImpact([{ id: '1', spec }], parseTable('x,y\n1,20'))).toEqual([])
})
