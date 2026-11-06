import { describe, expect, it } from 'vitest'
import { computeChartGeometry } from './chartLayout'
import { renderChartSvg } from './chartRender'
import { defaultSpec, migrateSpec, type ChartSpec, type ChartType } from './chartSpec'
import { parseTable } from './dataParse'
import { withBubbleSize, withTrendline, withType } from './chartOptions'
import { updateChartAgentSpec } from './agentChartTools'
import { CHART_OVERFLOW_INK } from './chartTheme'

const dims = { width: 900, height: 540 }

const shares = parseTable([
  'channel,revenue',
  'Direct,420',
  'Partners,260',
  'Online marketplace with a long name,180',
  'Events,90',
  'Direct,30',
].join('\n'))

function chart(type: ChartType, x: string, y: string[], table = shares): ChartSpec {
  const spec = defaultSpec('Revenue by channel')
  spec.chart.type = type
  spec.chart.encodings = { x, y, series: null }
  return migrateSpec(spec)
}

describe('pie and donut', () => {
  it('sums repeated categories and orders slices largest first', () => {
    const geometry = computeChartGeometry(shares, chart('pie', 'channel', ['revenue']), dims)
    const slices = geometry.radial!.slices
    expect(slices.map(slice => slice.key)).toEqual(['Direct', 'Partners', 'Online marketplace with a long name', 'Events'])
    expect(slices[0]!.value).toBe(450)
    expect(slices.reduce((sum, slice) => sum + slice.share, 0)).toBeCloseTo(1)
    expect(geometry.radial!.total).toBe(980)
    expect(geometry.radial!.inner).toBe(0)
  })

  it('gives a donut a hole and keeps the same slices', () => {
    const geometry = computeChartGeometry(shares, chart('donut', 'channel', ['revenue']), dims)
    expect(geometry.radial!.inner).toBeGreaterThan(0)
    expect(geometry.radial!.inner).toBeLessThan(geometry.radial!.outer)
  })

  it('never paints more slices than the palette can name: the rest become one grey Other', () => {
    const many = parseTable(['k,v', ...'abcdefghij'.split('').map((k, i) => `${k},${20 - i}`)].join('\n'))
    const spec = chart('pie', 'k', ['v'], many)
    spec.chart.style.palette = 'mono'
    const slices = computeChartGeometry(many, spec, dims).radial!.slices
    expect(slices).toHaveLength(4)
    expect(slices[3]!.key).toBe('Other')
    expect(slices[3]!.color).toBe(CHART_OVERFLOW_INK)
    expect(computeChartGeometry(many, spec, dims).radial!.folded).toBe(7)
  })

  it('refuses negative values and several measures, saying why', () => {
    const negative = parseTable('k,v\na,5\nb,-2')
    expect(computeChartGeometry(negative, chart('pie', 'k', ['v'], negative), dims).message).toMatch(/zero or more/)
    const two = parseTable('k,v,w\na,1,2\nb,3,4')
    expect(computeChartGeometry(two, chart('pie', 'k', ['v', 'w'], two), dims).message).toMatch(/one measure/)
  })

  it('renders headless with a key that names every slice and its share', () => {
    const { svg, message } = renderChartSvg(shares, chart('donut', 'channel', ['revenue']))
    expect(message).toBeNull()
    expect(svg).toContain('data-slice="Direct"')
    expect(svg).toContain('46%')
    expect(svg).toContain('Total')
  })
})

describe('horizontal bars', () => {
  it('puts categories down the left in full and values along the bottom', () => {
    const geometry = computeChartGeometry(shares, chart('horizontal-bar', 'channel', ['revenue']), dims)
    expect(geometry.orientation).toBe('horizontal')
    expect(geometry.yTicks.map(tick => tick.fullLabel)).toEqual(['Direct', 'Partners', 'Online marketplace with a long name', 'Events'])
    const bars = geometry.series[0]!.bars
    expect(bars[0]!.width).toBeGreaterThan(bars[1]!.width)
    expect(bars.every(bar => bar.x === bars[0]!.x)).toBe(true)
    expect(bars[0]!.labelAnchor).toBe('start')
  })

  it('hangs a negative bar left of zero with its label at the far end', () => {
    const mixed = parseTable('team,change\nNorth,12\nSouth,-8')
    const bars = computeChartGeometry(mixed, chart('horizontal-bar', 'team', ['change'], mixed), dims).series[0]!.bars
    expect(bars[1]!.x + bars[1]!.width).toBeCloseTo(bars[0]!.x)
    expect(bars[1]!.labelAnchor).toBe('end')
  })

  it('renders headless', () => {
    const { svg, message } = renderChartSvg(shares, chart('horizontal-bar', 'channel', ['revenue']))
    expect(message).toBeNull()
    expect(svg).toContain('Online marketplace')
  })
})

const countries = parseTable([
  'country,gdp,life,population',
  'Aland,10,70,5',
  'Brava,20,74,20',
  'Corin,35,78,80',
  'Dovre,50,80,45',
  'Esk,62,81,10',
].join('\n'))

describe('bubbles', () => {
  it('sizes bubbles by area, so four times the value is twice the radius', () => {
    const table = parseTable('a,b,s\n1,1,4\n2,2,16\n3,3,1')
    const spec = withBubbleSize(chart('bubble', 'a', ['b'], table), table, 's')
    const points = computeChartGeometry(table, spec, dims).series[0]!.points
    expect(points[1]!.r! / points[0]!.r!).toBeCloseTo(2)
    expect(points[1]!.size).toBe(16)
  })

  it('asks for a size column instead of drawing a scatter that claims more', () => {
    expect(computeChartGeometry(countries, chart('bubble', 'gdp', ['life']), dims).message).toMatch(/size/)
  })

  it('picks a size column when the form is chosen, from the controls or the assistant alike', () => {
    const viaControls = withType(chart('scatter', 'gdp', ['life'], countries), countries, 'bubble')
    expect(viaControls.chart.encodings.size).toBe('population')
    const viaAssistant = updateChartAgentSpec(chart('scatter', 'gdp', ['life'], countries), countries, { type: 'bubble' })
    expect(viaAssistant.chart.encodings.size).toBe('population')
    expect(() => updateChartAgentSpec(viaAssistant, countries, { size: 'country' })).toThrow(/numeric/)
  })

  it('keeps the size column through a save and reload', () => {
    const spec = withType(chart('scatter', 'gdp', ['life'], countries), countries, 'bubble')
    expect(migrateSpec(JSON.parse(JSON.stringify(spec))).chart.encodings.size).toBe('population')
  })

  it('renders headless with a key saying what area shows', () => {
    const spec = withType(chart('scatter', 'gdp', ['life'], countries), countries, 'bubble')
    const { svg, message } = renderChartSvg(countries, spec)
    expect(message).toBeNull()
    expect(svg).toContain('Area shows population')
    expect(svg).toContain('>Corin</text>')
  })
})

describe('trendlines on a chart', () => {
  it('draws a fitted line with its R² through each series', () => {
    const spec = withTrendline(chart('scatter', 'gdp', ['life'], countries), { kind: 'linear' })
    const geometry = computeChartGeometry(countries, spec, dims)
    const trend = geometry.series[0]!.trend!
    expect(trend.path).toMatch(/^M/)
    expect(trend.r2).toBeGreaterThan(0.9)
    expect(trend.equation).toMatch(/^y = .* \(R² 0\.9\d\)$/)
    expect(renderChartSvg(countries, spec).svg).toContain('R² 0.9')
  })

  it('fits categories by their position along the axis', () => {
    const months = parseTable('month,sales\nJan,10\nFeb,20\nMar,30\nApr,40')
    const spec = withTrendline(chart('bar', 'month', ['sales'], months), { kind: 'linear' })
    expect(computeChartGeometry(months, spec, dims).series[0]!.trend!.r2).toBeCloseTo(1)
  })

  it('says why when the fit cannot be made, and refuses forms it cannot be drawn on', () => {
    const spec = withTrendline(chart('line', 'gdp', ['life'], countries), { kind: 'polynomial', degree: 3 })
    const tiny = parseTable('a,b\n1,2\n2,3')
    expect(computeChartGeometry(tiny, { ...spec, chart: { ...spec.chart, encodings: { x: 'a', y: ['b'], series: null } } }, dims).series[0]!.trend!.error).toMatch(/at least 5 points/)
    expect(() => withTrendline(chart('pie', 'country', ['gdp'], countries), { kind: 'linear' })).toThrow(/cannot|not on pie/)
  })

  it('drops a trendline when the chart changes to a form that cannot carry one', () => {
    const spec = withTrendline(chart('scatter', 'gdp', ['life'], countries), { kind: 'linear' })
    expect(withType(spec, countries, 'pie').chart.presentation?.trendline).toBeNull()
  })
})

describe('offering the new forms', async () => {
  const { suggestForms } = await import('./chartForms')

  it('offers horizontal bars when names are long, and a pie for a few parts of a whole', () => {
    const forms = suggestForms(shares)
    expect(forms.find(form => form.type === 'horizontal-bar')?.supported).toBe(true)
    const pie = forms.find(form => form.type === 'pie')!
    expect(pie.supported).toBe(true)
    expect(pie.job).toBe('What share of the total each channel has')
  })

  it('will not offer a pie of values that go below zero', () => {
    const mixed = parseTable('team,change\nNorth,12\nSouth,-8')
    expect(suggestForms(mixed).find(form => form.type === 'pie')?.supported).toBe(false)
  })

  it('offers bubbles for three measures, sized by the third', () => {
    const bubble = suggestForms(countries).find(form => form.type === 'bubble')!
    expect(bubble.encodings.size).toBe('population')
  })
})

describe('what a pie says', async () => {
  const { chartFindings, chartDescription } = await import('./chartFindings')

  it('speaks in shares, not in rises and falls', () => {
    const spec = chart('pie', 'channel', ['revenue'])
    const findings = chartFindings(shares, spec)
    expect(findings.map(finding => finding.text)).toEqual([
      'Direct is the largest part, 46% of the total.',
      'Direct and Partners together make more than half of it, 72%.',
      'Direct is 5.0 times Events, the smallest part named.',
    ])
    expect(chartDescription(shares, spec)).toContain('4 parts of a total of 980.')
  })
})
