import { describe, expect, it } from 'vitest'
import { computeChartGeometry } from './chartLayout'
import { validateChartAnnotations } from './chartAnnotationValidation'
import { defaultSpec, type ChartSpec } from './chartSpec'
import type { DataTable } from './dataParse'

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

  it('keeps intraday timestamps apart and labels their ticks with the time', () => {
    const intraday: DataTable = {
      columns: [{ name: 'at', type: 'date' }, { name: 'v', type: 'number' }],
      rows: [
        { at: new Date('2024-03-01T09:00:00Z'), v: 1 },
        { at: new Date('2024-03-01T09:30:00Z'), v: 3 },
        { at: new Date('2024-03-01T10:00:00Z'), v: 2 },
      ],
    }
    const bar = computeChartGeometry(intraday, specWith({ type: 'bar', encodings: { x: 'at', y: ['v'], series: null } }), dims)
    expect(bar.xTicks.map(t => t.label)).toEqual(['09:00', '09:30', '10:00'])
    expect(bar.xTicks.map(t => t.fullLabel)).toEqual(['2024-03-01 09:00', '2024-03-01 09:30', '2024-03-01 10:00'])
    expect(new Set(bar.series[0]!.bars.map(b => b.x)).size).toBe(3)

    const line = computeChartGeometry(intraday, specWith({ type: 'line', encodings: { x: 'at', y: ['v'], series: null } }), dims)
    const labels = line.xTicks.map(t => t.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain('09:30')
    const point = line.series[0]!.points[1]!
    expect(point.xLabel).toBe('2024-03-01 09:30')
    expect(line.xPixelForLabel(point.xLabel)).toBeCloseTo(point.cx, 6)
  })

  it('labels ticks seconds apart with their seconds', () => {
    const seconds: DataTable = {
      columns: [{ name: 'at', type: 'date' }, { name: 'v', type: 'number' }],
      rows: [
        { at: new Date('2024-03-01T09:00:00Z'), v: 1 },
        { at: new Date('2024-03-01T09:00:30Z'), v: 2 },
      ],
    }
    const line = computeChartGeometry(seconds, specWith({ type: 'line', encodings: { x: 'at', y: ['v'], series: null } }), dims)
    const labels = line.xTicks.map(t => t.label)
    expect(labels.length).toBeGreaterThan(1)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toContain('09:00:30')
  })

  it('keeps millisecond timestamps apart in bands, stacks and label lookup', () => {
    const millis: DataTable = {
      columns: [{ name: 'at', type: 'date' }, { name: 'a', type: 'number' }, { name: 'b', type: 'number' }],
      rows: [
        { at: new Date('2024-03-01T09:00:00.100Z'), a: 4, b: 1 },
        { at: new Date('2024-03-01T09:00:00.900Z'), a: 1, b: 4 },
      ],
    }
    const bar = computeChartGeometry(millis, specWith({ type: 'bar', encodings: { x: 'at', y: ['a'], series: null } }), dims)
    expect(bar.xTicks.map(t => t.fullLabel)).toEqual(['2024-03-01 09:00:00.100', '2024-03-01 09:00:00.900'])
    expect(new Set(bar.series[0]!.bars.map(b => b.x)).size).toBe(2)

    const stacked = computeChartGeometry(millis, specWith({ type: 'stacked-bar', encodings: { x: 'at', y: ['a', 'b'], series: null } }), dims)
    for (const bars of stacked.series.map(s => s.bars)) {
      for (const b of bars) expect(b.y).toBeGreaterThanOrEqual(stacked.plot.top - 0.5)
    }
    expect(stacked.series[1]!.bars[0]!.x).toBe(stacked.series[0]!.bars[0]!.x)

    const line = computeChartGeometry(millis, specWith({ type: 'line', encodings: { x: 'at', y: ['a'], series: null } }), dims)
    const second = line.series[0]!.points[1]!
    expect(second.xLabel).toBe('2024-03-01 09:00:00.900')
    expect(line.xPixelForLabel(second.xLabel)).toBeCloseTo(second.cx, 6)
    const labels = line.xTicks.map(t => t.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('prints the distinguishing time under each of six intraday bars', () => {
    const six: DataTable = {
      columns: [{ name: 'at', type: 'date' }, { name: 'v', type: 'number' }],
      rows: [0, 10, 20, 30, 40, 50].map((minute, i) => ({ at: new Date(Date.UTC(2024, 2, 1, 9, minute)), v: i + 1 })),
    }
    const bar = computeChartGeometry(six, specWith({ type: 'bar', encodings: { x: 'at', y: ['v'], series: null } }), dims)
    const labels = bar.xTicks.map(t => t.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels.every(label => !label.includes('…'))).toBe(true)
    expect(labels).toContain('09:10')

    const twoDays: DataTable = {
      columns: six.columns,
      rows: [{ at: new Date('2024-03-01T23:30:00Z'), v: 1 }, { at: new Date('2024-03-02T00:30:00Z'), v: 2 }],
    }
    const across = computeChartGeometry(twoDays, specWith({ type: 'bar', encodings: { x: 'at', y: ['v'], series: null } }), dims)
    expect(across.xTicks.map(t => t.label)).toEqual(['03-01 23:30', '03-02 00:30'])
  })

  /**
   * What a reader needs from an axis of moments: every printed label whole
   * and distinct, its time the tick's own, and the day named wherever it
   * changes — so no two ticks look alike and none seems to run backwards.
   */
  function expectReadableMoments(table: DataTable, type: 'line' | 'bar', width: number): string[] {
    const geometry = computeChartGeometry(table, specWith({ type, encodings: { x: 'at', y: ['v'], series: null } }), { width, height: 400 })
    const ticks = geometry.xTicks
    const labels = ticks.map(t => t.label)
    const where = `${type} at ${width}px: ${labels.join(' | ')}`
    expect(labels.length, where).toBeGreaterThan(1)
    expect(new Set(labels).size, where).toBe(labels.length)
    expect(labels.some(label => label.includes('…')), where).toBe(false)
    const dayOf = (i: number) => (ticks[i].fullLabel ?? '').slice(0, 10)
    const manyDays = ticks.some((_, i) => dayOf(i) !== dayOf(0))
    ticks.forEach((tick, i) => {
      const full = tick.fullLabel ?? ''
      expect(full.endsWith(tick.label.split(' ').pop()!), where).toBe(true)
      if (manyDays && (i === 0 || dayOf(i) !== dayOf(i - 1))) expect(tick.label, where).toContain(full.slice(5, 10))
    })
    return labels
  }

  const momentTable = (dates: Date[]): DataTable => ({
    columns: [{ name: 'at', type: 'date' }, { name: 'v', type: 'number' }],
    rows: dates.map((at, i) => ({ at, v: i + 1 })),
  })

  it('keeps visible times distinct for readings seconds apart across midnight', () => {
    const midnight = momentTable([0, 10, 20, 30, 40, 50].map(s => new Date(Date.UTC(2024, 2, 1, 23, 59, 30 + s))))
    for (const type of ['line', 'bar'] as const) {
      for (const width of [400, 600, 1000]) expectReadableMoments(midnight, type, width)
    }
    expect(expectReadableMoments(midnight, 'line', 600)).toEqual(['03-01 23:59:30', '23:59:40', '23:59:50', '03-02 00:00:00', '00:00:10', '00:00:20'])
    expect(expectReadableMoments(midnight, 'bar', 1000)).toEqual(['03-01 23:59:30', '23:59:40', '23:59:50', '03-02 00:00:00', '00:00:10', '00:00:20'])
  })

  it('keeps the same times on two days apart on a bar axis', () => {
    const twoDays = momentTable([1, 2].flatMap(d => [0, 10, 20].map(s => new Date(Date.UTC(2024, 2, d, 9, 0, s)))))
    for (const width of [400, 600, 1000]) expectReadableMoments(twoDays, 'bar', width)
    expect(expectReadableMoments(twoDays, 'bar', 600)).toEqual(['03-01 09:00:00', '09:00:20', '03-02 09:00:10'])
  })

  it('prints whole milliseconds on a narrow chart by showing fewer ticks', () => {
    const millis = momentTable([100, 110, 120, 130, 140, 150].map(ms => new Date(Date.UTC(2024, 2, 1, 9, 0, 0, ms))))
    for (const type of ['line', 'bar'] as const) {
      for (const width of [400, 600]) expectReadableMoments(millis, type, width)
    }
    expect(expectReadableMoments(millis, 'line', 400)).toEqual(['09:00:00.100', '09:00:00.120', '09:00:00.140'])
  })

  it('shows one complete moment when even two labels cannot fit', () => {
    const cases = [
      { width: 220, types: ['line', 'bar'] as const, dates: [100, 110, 120, 130, 140, 150].map(ms => new Date(Date.UTC(2024, 2, 1, 9, 0, 0, ms))) },
      { width: 250, types: ['line', 'bar'] as const, dates: ['2024-12-31T09:00:10Z', '2025-01-01T09:00:10Z'].map(s => new Date(s)) },
      { width: 320, types: ['bar'] as const, dates: ['2024-12-31T09:00:00.100Z', '2025-01-01T09:00:00.110Z'].map(s => new Date(s)) },
    ]
    for (const { width, types, dates } of cases) {
      for (const type of types) {
        const geometry = computeChartGeometry(momentTable(dates), specWith({ type, encodings: { x: 'at', y: ['v'], series: null } }), { width, height: 400 })
        expect(geometry.xTicks).toHaveLength(1)
        const tick = geometry.xTicks[0]!
        expect(tick.label).toBe(tick.fullLabel)
        expect(tick.label).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
        expect(tick.label).not.toContain('…')
        // Reducing labels must leave the plotted readings and lookup intact.
        expect(geometry.series[0]!.points).toHaveLength(dates.length)
        for (const point of geometry.series[0]!.points) {
          expect(geometry.xPixelForLabel(point.xLabel)).toBeCloseTo(point.cx, 6)
        }
      }
    }
  })

  it('accepts the ISO timestamps getChartData shows as range endpoints', () => {
    const intraday: DataTable = {
      columns: [{ name: 'at', type: 'date' }, { name: 'v', type: 'number' }],
      rows: [
        { at: new Date('2024-03-01T09:00:00Z'), v: 1 },
        { at: new Date('2024-03-01T09:30:00Z'), v: 3 },
        { at: new Date('2024-03-01T10:00:00Z'), v: 2 },
      ],
    }
    const range = {
      id: 'r', text: 'Morning', createdAt: 'now',
      target: {
        kind: 'range' as const,
        x: { from: '2024-03-01T09:00:00.000Z', to: '2024-03-01T09:30:00.000Z' },
        y: { from: 0, to: 5 },
        summary: { count: 2, min: 1, max: 3, average: 2, change: 2 },
      },
    }
    for (const type of ['line', 'bar'] as const) {
      const spec = specWith({ type, encodings: { x: 'at', y: ['v'], series: null }, annotations: [range] })
      const geometry = computeChartGeometry(intraday, spec, dims)
      expect(geometry.xPixelForLabel(range.target.x.from)).toBeCloseTo(geometry.series[0]!.points[0]!.cx, 6)
      expect(() => validateChartAnnotations(spec, [geometry])).not.toThrow()
    }
  })

  it('keeps day labels for dates that carry no time', () => {
    const daily: DataTable = {
      columns: [{ name: 'day', type: 'date' }, { name: 'v', type: 'number' }],
      rows: [
        { day: new Date('2024-03-01'), v: 1 },
        { day: new Date('2024-03-02'), v: 2 },
      ],
    }
    const bar = computeChartGeometry(daily, specWith({ type: 'bar', encodings: { x: 'day', y: ['v'], series: null } }), dims)
    expect(bar.xTicks.map(t => t.label)).toEqual(['2024-03-01', '2024-03-02'])
  })
})
