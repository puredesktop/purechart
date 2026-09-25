import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { computeChartGeometry } from '../lib/chartLayout'
import { defaultSpec, suggestEncodings } from '../lib/chartSpec'
import { parseDelimited } from '../lib/dataParse'
import { ChartCanvas } from './ChartCanvas'

const CSV = `year,north,south
2018,12,8
2019,15,11
2020,9,14
2021,18,16
2022,21,15
2023,24,19
`

const dims = { width: 680, height: 380 }
const noop = () => undefined

function renderChart(
  geometry: ReturnType<typeof computeChartGeometry>,
  spec: ReturnType<typeof defaultSpec>,
) {
  return renderToStaticMarkup(
    <ChartCanvas
      geometry={geometry}
      spec={spec}
      interactionMode="read"
      resetToken={0}
      onAddAnnotation={noop}
    />,
  )
}

describe('ChartCanvas', () => {
  it('renders a multi-series line chart with paths and direct labels', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec('North vs South')
    spec.chart.type = 'line'
    spec.chart.encodings = { ...suggestEncodings(table), y: ['north', 'south'] }
    const geometry = computeChartGeometry(table, spec, dims)

    const svg = renderChart(geometry, spec)

    expect(svg).toContain('<svg')
    expect(svg.match(/<path/g)?.length).toBe(6)
    expect(svg.match(/<circle/g)?.length).toBe(12)
    expect(svg).toContain('stroke-opacity="0.14"')
    expect(svg).toContain('fill-opacity="0.05"')
    expect(svg).toContain('>north<')
    expect(svg).toContain('>south<')
    expect(svg).toContain('North vs South')
  })

  it('renders a bar chart with one rect per category', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec('Bars')
    spec.chart.type = 'bar'
    spec.chart.encodings = { x: 'year', y: ['north'], series: null }
    const geometry = computeChartGeometry(table, spec, dims)

    const svg = renderChart(geometry, spec)
    expect(svg.match(/fill-opacity="0.68"/g)?.length).toBe(6)
    expect(svg).toContain('aria-label="Inspect chart points"')
  })

  it('renders an area chart with a stronger wash', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec('Area')
    spec.chart.type = 'area'
    spec.chart.encodings = { x: 'year', y: ['north'], series: null }
    const geometry = computeChartGeometry(table, spec, dims)

    const svg = renderChart(geometry, spec)

    expect(svg).toContain('fill-opacity="0.18"')
    expect(svg).not.toContain('stroke-opacity="0.16"')
  })

  it('renders a lollipop chart with stems and points', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec('Lollipop')
    spec.chart.type = 'lollipop'
    spec.chart.encodings = { x: 'year', y: ['north'], series: null }
    const geometry = computeChartGeometry(table, spec, dims)

    const svg = renderChart(geometry, spec)

    expect(svg).toContain('stroke-opacity="0.24"')
    expect(svg.match(/<circle/g)?.length).toBe(12)
  })

  it('draws rug marks only when the style asks for them', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec()
    spec.chart.encodings = { x: 'year', y: ['north'], series: null }
    const plain = renderChart(computeChartGeometry(table, spec, dims), spec)
    spec.chart.style.rug = true
    const rugged = renderChart(computeChartGeometry(table, spec, dims), spec)
    // Two ticks per point (x and y margins) on top of the axes.
    expect(rugged.match(/<line/g)!.length - plain.match(/<line/g)!.length).toBe(
      12,
    )
  })

  it('marks the pointer-capture layer as transient so exports drop it', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec()
    spec.chart.encodings = { x: 'year', y: ['north'], series: null }
    const svg = renderChart(computeChartGeometry(table, spec, dims), spec)
    expect(svg).toContain('data-purechart-transient=""')
  })

  it('omits gridlines by default but draws them when enabled', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec()
    spec.chart.encodings = { x: 'year', y: ['north'], series: null }

    const noGrid = renderChart(computeChartGeometry(table, spec, dims), spec)
    spec.chart.style.grid = true
    const withGrid = renderChart(computeChartGeometry(table, spec, dims), spec)
    expect(withGrid.match(/<line/g)!.length).toBeGreaterThan(
      noGrid.match(/<line/g)!.length,
    )
  })
})

for (const type of ['grouped-bar', 'stacked-bar'] as const) {
  for (const width of [518, 1100]) {
    it(`exports identifiable ${type} series with unclipped values at ${width}px`, () => {
      const table = parseDelimited(
        'team,baseline,followup\nNorth,50,56\nSouth,60,63\nWest,40,45',
      )
      const spec = defaultSpec('Baseline and followup')
      spec.chart.type = type
      spec.chart.encodings = {
        x: 'team',
        y: ['baseline', 'followup'],
        series: null,
      }
      const geometry = computeChartGeometry(table, spec, { width, height: 535 })
      const svg = renderChart(geometry, spec)
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      expect(
        doc.querySelector('[aria-label="Series: baseline"]'),
      ).not.toBeNull()
      expect(
        doc.querySelector('[aria-label="Series: followup"]'),
      ).not.toBeNull()
      const values = [...doc.querySelectorAll('[data-bar-values] text')]
      expect(values.map(node => node.textContent)).toContain('63')
      for (const node of values) {
        expect(node.closest('[clip-path]')).toBeNull()
        expect(Number(node.getAttribute('y'))).toBeGreaterThan(44 + 20)
      }
    })
  }
}

describe('two charts on one page', () => {
  it('never share a clip path, or one clips the other away', () => {
    const table = parseDelimited(CSV)
    const spec = defaultSpec('Both')
    spec.chart.encodings = suggestEncodings(table)
    const geometry = computeChartGeometry(table, spec, dims)
    // Both in one tree, as the rail's thumbnails and the stage really are.
    const markup = renderToStaticMarkup(
      <>
        <ChartCanvas
          geometry={geometry}
          spec={spec}
          interactionMode="read"
          resetToken={0}
          onAddAnnotation={noop}
        />
        <ChartCanvas
          geometry={geometry}
          spec={spec}
          interactionMode="read"
          resetToken={0}
          onAddAnnotation={noop}
          bare
        />
      </>,
    )
    const ids = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1])
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    for (const id of ids) expect(markup).toContain(`url(#${id})`)
  })
})

it('keeps endpoint labels outside mark clipping and leaves room for edge circles', () => {
  const table = parseDelimited('x,measurement\n1,10\n2,20\n3,30')
  const spec = defaultSpec('Endpoints')
  spec.chart.encodings = { x: 'x', y: ['measurement'], series: null }
  const geometry = computeChartGeometry(table, spec, dims)
  const doc = new DOMParser().parseFromString(renderChart(geometry, spec), 'image/svg+xml')
  const label = doc.querySelector('[data-direct-label]')!
  expect(label).not.toBeNull()
  expect(label.closest('[clip-path]')).toBeNull()
  expect(Number(label.getAttribute('y'))).toBeGreaterThan(geometry.plot.top)
  const clip = doc.querySelector('clipPath[id*="marks-clip"] rect')!
  const circle = doc.querySelectorAll('circle')[2]
  const radius = Number(circle.getAttribute('r'))
  expect(Number(clip.getAttribute('x'))).toBeLessThan(geometry.plot.left - radius)
  expect(Number(clip.getAttribute('y'))).toBeLessThan(geometry.plot.top - radius)
})
it('wraps long direct labels and preserves their full accessible text', () => {
  const column = 'A measurement with a very long descriptive name for the publication'
  const table = parseDelimited(`x,${column}\n1,10\n2,20`)
  const spec = defaultSpec('Long label')
  spec.chart.encodings = { x: 'x', y: [column], series: null }
  const geometry = computeChartGeometry(table, spec, dims)
  const doc = new DOMParser().parseFromString(renderChart(geometry, spec), 'image/svg+xml')
  expect(doc.querySelector('[data-direct-label] title')?.textContent).toBe(column)
  expect(doc.querySelectorAll('[data-direct-label] tspan').length).toBeGreaterThan(1)
  expect(dims.width - geometry.plot.right).toBeGreaterThan(88)
})
