import { describe, expect, it } from 'vitest'
import { computeChartGeometry } from './chartLayout'
import { defaultSpec, type ChartSpec } from './chartSpec'
import { parseTable, type DataTable } from './dataParse'

const dims = { width: 600, height: 400 }

const numericTable: DataTable = {
  columns: [
    { name: 'year', type: 'number' },
    { name: 'a', type: 'number' },
    { name: 'b', type: 'number' },
  ],
  rows: [
    { year: 2020, a: 1, b: 5 },
    { year: 2021, a: 3, b: 4 },
    { year: 2022, a: 2, b: 6 },
  ],
}

function specWith(partial: Partial<ChartSpec['chart']>): ChartSpec {
  const spec = defaultSpec()
  spec.chart = { ...spec.chart, ...partial }
  return spec
}

describe('computeChartGeometry', () => {
  it('reports a helpful message when encodings are incomplete', () => {
    const geo = computeChartGeometry(numericTable, defaultSpec(), dims)
    expect(geo.empty).toBe(true)
    expect(geo.message).toMatch(/X column/)
  })

  it('builds one series per y column for a line chart', () => {
    const geo = computeChartGeometry(
      numericTable,
      specWith({
        type: 'line',
        encodings: { x: 'year', y: ['a', 'b'], series: null },
      }),
      dims,
    )
    expect(geo.empty).toBe(false)
    expect(geo.series.map(s => s.key)).toEqual(['a', 'b'])
    expect(geo.series[0].linePath).toMatch(/^M/)
    expect(geo.series[0].points).toHaveLength(3)
  })

  it('keeps points inside the plot rectangle', () => {
    const geo = computeChartGeometry(
      numericTable,
      specWith({
        type: 'line',
        encodings: { x: 'year', y: ['a'], series: null },
      }),
      dims,
    )
    for (const point of geo.series[0].points) {
      expect(point.cx).toBeGreaterThanOrEqual(geo.plot.left - 0.5)
      expect(point.cx).toBeLessThanOrEqual(geo.plot.right + 0.5)
      expect(point.cy).toBeGreaterThanOrEqual(geo.plot.top - 0.5)
      expect(point.cy).toBeLessThanOrEqual(geo.plot.bottom + 0.5)
    }
  })

  it('emits zero-baselined bars for a bar chart', () => {
    const geo = computeChartGeometry(
      numericTable,
      specWith({
        type: 'bar',
        encodings: { x: 'year', y: ['a'], series: null },
      }),
      dims,
    )
    expect(geo.series[0].bars).toHaveLength(3)
    for (const bar of geo.series[0].bars) {
      expect(bar.width).toBeGreaterThan(0)
      expect(bar.height).toBeGreaterThanOrEqual(0)
    }
  })

  it('stacks bars so each category shows its total height', () => {
    const geo = computeChartGeometry(
      numericTable,
      specWith({
        type: 'stacked-bar',
        encodings: { x: 'year', y: ['a', 'b'], series: null },
      }),
      dims,
    )
    expect(geo.empty).toBe(false)
    const [first, second] = geo.series
    for (let index = 0; index < first.bars.length; index += 1) {
      const lower = first.bars[index]
      const upper = second.bars[index]
      // Same column, full band width, and the second segment sits on top.
      expect(upper.x).toBeCloseTo(lower.x)
      expect(upper.width).toBeCloseTo(lower.width)
      expect(upper.y + upper.height).toBeCloseTo(lower.y)
    }
    // The y axis is scaled to the totals (max 8), not the largest value (6).
    const topTick = Math.max(...geo.yTicks.map(tick => Number(tick.label)))
    expect(topTick).toBeGreaterThanOrEqual(8)
    const grouped = computeChartGeometry(
      numericTable,
      specWith({
        type: 'grouped-bar',
        encodings: { x: 'year', y: ['a', 'b'], series: null },
      }),
      dims,
    )
    expect(grouped.series[1].bars[0].x).toBeGreaterThan(
      grouped.series[0].bars[0].x,
    )
  })

  it('splits into series by a category column', () => {
    const table: DataTable = {
      columns: [
        { name: 'year', type: 'number' },
        { name: 'region', type: 'string' },
        { name: 'sales', type: 'number' },
      ],
      rows: [
        { year: 2020, region: 'N', sales: 1 },
        { year: 2020, region: 'S', sales: 2 },
        { year: 2021, region: 'N', sales: 3 },
        { year: 2021, region: 'S', sales: 4 },
      ],
    }
    const geo = computeChartGeometry(
      table,
      specWith({
        type: 'line',
        encodings: { x: 'year', y: ['sales'], series: 'region' },
      }),
      dims,
    )
    expect(geo.series.map(s => s.key).sort()).toEqual(['N', 'S'])
  })

  it('produces direct labels when enabled', () => {
    const spec = specWith({
      type: 'line',
      encodings: { x: 'year', y: ['a'], series: null },
    })
    spec.chart.style.directLabels = true
    const geo = computeChartGeometry(numericTable, spec, dims)
    expect(geo.series[0].label?.text).toBe('a')
  })

  it('thins and truncates crowded category axis labels', () => {
    const table: DataTable = {
      columns: [
        { name: 'project', type: 'string' },
        { name: 'value', type: 'number' },
      ],
      rows: Array.from({ length: 24 }, (_, index) => ({
        project: `Long project category ${index + 1}`,
        value: index + 1,
      })),
    }
    const geo = computeChartGeometry(
      table,
      specWith({
        type: 'bar',
        encodings: { x: 'project', y: ['value'], series: null },
      }),
      dims,
    )

    expect(geo.xTicks.length).toBeLessThan(table.rows.length)
    expect(geo.xTicks.some(tick => tick.label.endsWith('…'))).toBe(true)
    expect(geo.xTicks.some(tick => tick.fullLabel !== tick.label)).toBe(true)
  })

  it('bins a histogram into nice equal-width ranges and counts, with no x column', () => {
    const table: DataTable = {
      columns: [{ name: 'score', type: 'number' }],
      rows: [3, 4, 5, 11, 12, 18, 19, 20, 27, 30].map(score => ({ score })),
    }
    const geo = computeChartGeometry(
      table,
      specWith({
        type: 'histogram',
        encodings: { x: null, y: ['score'], series: null },
      }),
      dims,
    )
    expect(geo.empty).toBe(false)
    const bars = geo.series[0]!.bars
    // Sturges on 10 values asks for 5 bins over a nice [0, 30] domain.
    expect(geo.xTicks.map(tick => tick.fullLabel ?? tick.label)).toEqual([
      '0–5', '5–10', '10–15', '15–20', '20–25', '25–30',
    ])
    expect(bars.map(bar => bar.value)).toEqual([2, 1, 2, 2, 1, 2])
    expect(geo.yTicks.every(tick => Number.isInteger(Number(tick.label)))).toBe(true)
    expect(bars.reduce((sum, bar) => sum + bar.value, 0)).toBe(table.rows.length)
    expect(bars.every(bar => bar.height > 0 && bar.y >= geo.plot.top)).toBe(true)
  })

  it('shares bin edges across series so two histograms compare bin for bin', () => {
    const table: DataTable = {
      columns: [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }],
      rows: [
        { a: 1, b: 9 }, { a: 2, b: 8 }, { a: 3, b: 7 }, { a: 4, b: 6 },
      ],
    }
    const geo = computeChartGeometry(
      table,
      specWith({ type: 'histogram', encodings: { x: null, y: ['a', 'b'], series: null } }),
      dims,
    )
    expect(geo.series).toHaveLength(2)
    expect(geo.xTicks.map(tick => tick.fullLabel ?? tick.label)).toEqual(
      ['0–2', '2–4', '4–6', '6–8', '8–10'],
    )
    // Empty bins keep their axis slot but draw nothing.
    expect(geo.series[0]!.bars.map(bar => bar.value)).toEqual([1, 2, 1])
    expect(geo.series[1]!.bars.map(bar => bar.value)).toEqual([2, 2])
  })

  it('maps saved data coordinates back onto this drawing\'s scales', () => {
    const geo = computeChartGeometry(
      numericTable,
      specWith({ type: 'line', encodings: { x: 'year', y: ['a'], series: null } }),
      dims,
    )
    const point = geo.series[0]!.points[1]!
    expect(geo.xPixelForLabel(point.xLabel)).toBeCloseTo(point.cx, 6)
    expect(geo.yPixelForValue(point.value)).toBeCloseTo(point.cy, 6)
    expect(geo.yValueAtPixel(point.cy)).toBeCloseTo(point.value, 6)
    expect(geo.xPixelForLabel('not-a-year')).toBeNull()

    const wider = computeChartGeometry(
      numericTable,
      specWith({ type: 'line', encodings: { x: 'year', y: ['a'], series: null } }),
      { width: 1200, height: 700 },
    )
    // Same data point, a different drawing: the label still finds it.
    expect(wider.xPixelForLabel(point.xLabel)).toBeCloseTo(wider.series[0]!.points[1]!.cx, 6)

    const banded = computeChartGeometry(
      { columns: [{ name: 'k', type: 'string' }, { name: 'v', type: 'number' }],
        rows: [{ k: 'x', v: 1 }, { k: 'y', v: 2 }] },
      specWith({ type: 'bar', encodings: { x: 'k', y: ['v'], series: null } }),
      dims,
    )
    expect(banded.xPixelForLabel('y')).toBeCloseTo(banded.xTicks[1]!.position, 6)
    expect(banded.xPad).toBeGreaterThan(0)
  })
})

describe('cases that used to draw the wrong thing', () => {
  it('puts a negative bar’s value at the end of its own bar', () => {
    const table: DataTable = {
      columns: [{ name: 'k', type: 'string' }, { name: 'v', type: 'number' }],
      rows: [{ k: 'A', v: -5 }, { k: 'B', v: -10 }, { k: 'C', v: 3 }],
    }
    const geo = computeChartGeometry(
      table,
      specWith({ type: 'bar', encodings: { x: 'k', y: ['v'], series: null } }),
      dims,
    )
    const [a, b, c] = geo.series[0]!.bars
    // Below the bar, not 8px above the zero line where every negative label
    // used to land on the same row.
    expect(a!.labelY).toBeGreaterThan(a!.y + a!.height)
    expect(b!.labelY).toBeGreaterThan(b!.y + b!.height)
    expect(a!.labelY).not.toBeCloseTo(b!.labelY, 3)
    // A positive value still sits above its bar.
    expect(c!.labelY).toBeLessThan(c!.y)
  })

  it('measures a table too large to spread into Math.min', () => {
    const table: DataTable = {
      columns: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }],
      rows: Array.from({ length: 150_000 }, (_, index) => ({ x: index, y: index % 97 })),
    }
    const geo = computeChartGeometry(
      table,
      specWith({ type: 'line', encodings: { x: 'x', y: ['y'], series: null } }),
      dims,
    )
    expect(geo.empty).toBe(false)
    expect(geo.yExtent).toEqual([0, 96])
  })

  it('says so when a series column is asked to split two measures', () => {
    const table: DataTable = {
      columns: [
        { name: 'year', type: 'number' },
        { name: 'region', type: 'string' },
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
      ],
      rows: [
        { year: 2020, region: 'N', a: 1, b: 900 },
        { year: 2021, region: 'S', a: 2, b: 800 },
      ],
    }
    const geo = computeChartGeometry(
      table,
      specWith({ type: 'line', encodings: { x: 'year', y: ['a', 'b'], series: 'region' } }),
      dims,
    )
    // It used to draw `a` alone and say nothing about `b`.
    expect(geo.empty).toBe(true)
    expect(geo.message).toMatch(/one Y column/i)
  })
})

it('keeps every bar of a grouped bar inside its own category band', () => {
  const rows: string[] = ['k,region,v']
  for (const category of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']) {
    for (let index = 0; index < 8; index += 1) rows.push(`${category},R${index},${index + 1}`)
  }
  const table = parseTable(rows.join('\n'))
  const geo = computeChartGeometry(
    table,
    specWith({ type: 'grouped-bar', encodings: { x: 'k', y: ['v'], series: 'region' } }),
    dims,
  )
  const step = geo.xTicks[1]!.position - geo.xTicks[0]!.position
  // A fixed 4px gap between bars overflowed the band once the bands were
  // narrow, so one category's bars sat over the next category's slot.
  for (let index = 0; index < geo.xTicks.length; index += 1) {
    const bars = geo.series.map(series => series.bars[index]).filter(bar => !!bar)
    const left = Math.min(...bars.map(bar => bar!.x))
    const right = Math.max(...bars.map(bar => bar!.x + bar!.width))
    expect(right - left).toBeLessThan(step * 0.9)
  }
})
