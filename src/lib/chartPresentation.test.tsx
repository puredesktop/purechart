import { expect, it } from 'vitest'
import { defaultSpec, migrateSpec } from './chartSpec'
import { defaultPresentation } from './chartPresentation'
import { parseTable } from './dataParse'
import { computeChartGeometry } from './chartLayout'
import { renderChartSvg } from './chartRender'
const table = parseTable('x,y,lower,upper\n1,10,8,12\n2,100,80,120')
function spec() { const s = defaultSpec('Measurements'); s.chart.encodings = { x: 'x', y: ['y'], series: null }; return s }
const dims = { width: 900, height: 600 }
it('uses exact user bounds and a logarithmic scale, rejecting invalid domains', () => {
  const s = spec()
  s.chart.axes.y = { ...s.chart.axes.y, min: 1, max: 1000, scale: 'log' }
  const g = computeChartGeometry(table, s, dims)
  expect(g.yPixelForValue(1)).toBe(g.plot.bottom)
  expect(g.yPixelForValue(1000)).toBe(g.plot.top)
  expect(g.yPixelForValue(10) - g.yPixelForValue(100)).toBeCloseTo(g.plot.height / 3)
  s.chart.axes.y.min = 0
  expect(computeChartGeometry(table, s, dims).message).toContain('positive')
})
it('includes error bounds in the scale and draws intervals, references and moved legends', () => {
  const s = spec()
  s.chart.presentation = { ...defaultPresentation(), legend: 'right', references: [{ id: 'r', axis: 'y', value: 50, label: 'Target' }], errorBars: { lower: 'lower', upper: 'upper' } }
  const g = computeChartGeometry(table, s, dims)
  expect(g.yExtent).toEqual([8, 120])
  expect(g.series[0].points[0].error).toMatchObject({ lower: 8, upper: 12 })
  const svg = renderChartSvg(table, s, dims).svg
  expect(svg).toContain('Error interval 8 to 12')
  expect(svg).toContain('Reference: Target')
  expect(svg).toContain('Series: y')
  expect(migrateSpec(s).chart.presentation).toEqual(s.chart.presentation)
})
it('rejects reversed error intervals and aggregated uncertainty', () => {
  const s = spec()
  s.chart.presentation = { ...defaultPresentation(), errorBars: { lower: 'upper', upper: 'lower' } }
  expect(renderChartSvg(table, s).message).toContain('lower ≤ value')
  s.chart.presentation.errorBars = { lower: 'lower', upper: 'upper' }
  s.chart.transform = { aggregate: 'mean', missing: 'omit', filters: [], sort: null }
  expect(renderChartSvg(parseTable('x,y,lower,upper\n1,10,8,12\n1,20,18,22'), s).message).toContain('cannot be combined')
})
it('formats numeric ticks and prevents categorical axis bounds from silently doing nothing', () => {
  const s = spec()
  s.chart.axes.y.format = 'percent'
  expect(computeChartGeometry(table, s, dims).yTicks.some(t => t.label.endsWith('%'))).toBe(true)
  s.chart.type = 'bar'
  s.chart.axes.x.min = 0
  expect(computeChartGeometry(table, s, dims).message).toContain('not categories')
})

it('exports the complete caption within the requested figure dimensions', () => {
  const s = spec()
  s.chart.caption = 'Intervals show measurement uncertainty & the target is < 50.'
  const output = renderChartSvg(table, s, { width: 900, height: 600 })
  expect(output.svg).toContain('aria-label="Chart caption"')
  expect(output.svg).toContain('uncertainty &amp;')
  expect(output.svg).toContain('&lt; 50.')
  expect(output.svg).toContain('viewBox="0 0 900 600"')
  expect(output.message).toBeNull()
  s.chart.caption = 'Long caption '.repeat(500)
  expect(renderChartSvg(table, s, { width: 320, height: 240 }).message).toContain('Increase export height')
})

it('keeps distinct uncertainty for coincident points through filtering and sorting', () => {
  const s = spec()
  s.chart.type = 'scatter'
  s.chart.presentation = { ...defaultPresentation(), errorBars: { lower: 'lower', upper: 'upper' } }
  s.chart.transform = { aggregate: 'none', missing: 'omit', filters: [{ column: 'upper', op: 'gt', value: '10' }], sort: { column: 'lower', direction: 'asc' } }
  const data = parseTable('x,y,lower,upper\n1,10,8,12\n1,10,5,15\n2,5,4,6')
  const g = computeChartGeometry(data, s, dims)
  expect(g.message).toBeNull()
  expect(g.series[0].points.map(p => p.error && [p.error.lower, p.error.upper])).toEqual([[5, 15], [8, 12]])
})

it('refuses to invent error bounds for folded series', () => {
  const s = spec()
  s.chart.type = 'scatter'
  s.chart.encodings.series = 'group'
  s.chart.encodings.limitSeries = 1
  s.chart.presentation = { ...defaultPresentation(), errorBars: { lower: 'lower', upper: 'upper' } }
  const data = parseTable('x,y,lower,upper,group\n1,10,8,12,A\n1,20,15,25,B\n1,30,25,35,C')
  expect(renderChartSvg(data, s).message).toContain('folded into Other')
})

it('draws intervals above bars within the same zoom transform', () => {
  const s = spec()
  s.chart.type = 'bar'
  s.chart.presentation = { ...defaultPresentation(), errorBars: { lower: 'lower', upper: 'upper' } }
  const geometry = computeChartGeometry(table, s, dims)
  expect(geometry.series[0].bars[0].labelY).toBeLessThan(geometry.series[0].points[0].error!.upperY)
  const { svg } = renderChartSvg(table, s, dims)
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const interval = document.querySelector('[aria-label="Error interval 8 to 12"]')!
  const group = interval.parentElement!
  expect(group.querySelector('rect')).not.toBeNull()
  expect(group.innerHTML.indexOf('<rect')).toBeLessThan(group.innerHTML.indexOf('Error interval'))
  expect(group.parentElement!.getAttribute('transform')).toContain('scale(1)')
})
