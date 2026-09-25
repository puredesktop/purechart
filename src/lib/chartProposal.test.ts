import { expect, it } from 'vitest'
import { createChartAgentSpec } from './agentChartTools'
import { createChartProposal } from './chartProposal'
const { spec, table } = createChartAgentSpec({ dataText: 'year,value\n2022,10\n2023,20\n2024,30', type: 'line' })
const input = { patch: { title: 'Measured trend' }, explanation: 'Name the measure clearly.' }
it('previews without mutating the source and includes data choices and findings', () => {
  const before = JSON.stringify(spec)
  const proposed = createChartProposal('chart1', spec, table, input)
  expect(JSON.stringify(spec)).toBe(before)
  expect(proposed.preview).toContain('Measured trend')
  expect(proposed.changes).toContain('Title: Measured trend')
  expect(proposed.calculation.length).toBeGreaterThan(0)
  expect(proposed.findings.length).toBeGreaterThan(0)
  expect(proposed.spec.data).toEqual(spec.data)
})
it('creates grounded captions only from findings available for the proposed chart', () => {
  const preview = createChartProposal('chart1', spec, table, input)
  const grounded = createChartProposal('chart1', spec, table, { ...input, captionFindingIds: [preview.findings[0].id] })
  expect(grounded.spec.chart.caption).toBe(preview.findings[0].text)
  expect(grounded.warnings.join(' ')).not.toContain('Free-form caption')
  expect(() => createChartProposal('chart1', spec, table, { ...input, captionFindingIds: ['made-up'] })).toThrow('unavailable')
})
it('labels free-form claims and rejects nonexistent annotation targets', () => {
  expect(createChartProposal('chart1', spec, table, { ...input, patch: { caption: 'The policy caused this rise.' } }).warnings.join(' ')).toContain('not verified')
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { annotations: [{ id: 'a', createdAt: 'now', text: 'Peak', target: { kind: 'point', seriesKey: 'value', xLabel: '2024', value: 999 } }] } })).toThrow('does not target')
})
it('rejects invalid encodings, unrenderable axes, malformed patches and empty edits', () => {
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { y: ['missing'] } })).toThrow()
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { axes: { ...spec.chart.axes, y: { ...spec.chart.axes.y, min: 100, max: 1 } } } })).toThrow('bounds')
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { title: 42 } as never })).toThrow('text')
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: {} })).toThrow('does not change')
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { data: {} } as never })).toThrow('Unsupported')
  expect(() => createChartProposal(null, spec, table, input)).toThrow('Choose a chart')
})

it('rejects silently normalized settings and false range statistics', () => {
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { axes: { y: { scale: 'imaginary' } } } as never })).toThrow('axes.y.scale')
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { style: { pointRadius: -10 } } })).toThrow('style.pointRadius')
  const annotation = { id: 'range', createdAt: 'now', text: 'Three observations', target: { kind: 'range' as const, x: { from: '2022', to: '2024' }, y: { from: 0, to: 40 }, summary: { count: 3, min: 10, max: 30, average: 999, change: 20 } } }
  expect(() => createChartProposal('chart1', spec, table, { ...input, patch: { annotations: [annotation] } })).toThrow('incorrect average')
  annotation.target.summary.average = 20
  expect(createChartProposal('chart1', spec, table, { ...input, patch: { annotations: [annotation] } }).spec.chart.annotations).toHaveLength(1)
})
