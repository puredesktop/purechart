import { describe, expect, it } from 'vitest'
import { facetColumns, facetLayout, facetValues } from './chartFacet'
import { defaultSpec, type ChartSpec } from './chartSpec'
import { parseTable } from './dataParse'

const entries = [
  'month,category,entries',
  ...[
    ['Zines', [20, 34, 58]],
    ['Poetry', [6, 12, 22]],
    ['Fiction', [18, 30, 47]],
  ].flatMap(([category, values]) =>
    (values as number[]).map(
      (value, index) =>
        `2026-0${index + 1},${category as string},${value}`,
    ),
  ),
].join('\n')

const table = parseTable(entries)

function spec(column: string | null, columns = 0): ChartSpec {
  const value = defaultSpec('Entries by category')
  value.chart.encodings = { x: 'month', y: ['entries'], series: 'category' }
  value.chart.facet = { column, columns }
  return value
}

describe('splitting a chart into panels', () => {
  const layout = facetLayout(table, spec('category'), { width: 900, height: 480 })!

  it('makes one panel per value of the column', () => {
    expect(layout.panels).toHaveLength(3)
    expect(layout.panels.map(panel => panel.value).sort()).toEqual([
      'Fiction',
      'Poetry',
      'Zines',
    ])
  })

  it('orders the panels by what they show, not by the alphabet', () => {
    expect(layout.panels.map(panel => panel.value)).toEqual([
      'Zines',
      'Fiction',
      'Poetry',
    ])
  })

  it('puts every panel on one scale, so they can be compared', () => {
    expect(layout.yDomain).toEqual([6, 58])
    const tops = layout.panels.map(panel => panel.geometry.yPixelForValue(58))
    expect(new Set(tops.map(value => Math.round(value))).size).toBe(1)
  })

  it('keeps ticks on the outside edges only', () => {
    expect(layout.panels[0]!.showsYAxis).toBe(true)
    expect(layout.panels[1]!.showsYAxis).toBe(false)
  })

  it('stops the facet column from also splitting each panel into series', () => {
    // One line per panel, not three.
    expect(layout.panels[0]!.geometry.series).toHaveLength(1)
  })
})

describe('when a facet would say nothing', () => {
  it('declines a column that is not there', () => {
    expect(facetLayout(table, spec('nonsense'), { width: 900, height: 480 })).toBeNull()
  })

  it('declines a column with only one value — that is just the chart', () => {
    const single = parseTable('month,category,entries\n2026-01,Zines,20\n2026-02,Zines,34')
    expect(facetLayout(single, spec('category'), { width: 900, height: 480 })).toBeNull()
  })

  it('declines when no column is chosen', () => {
    expect(facetLayout(table, spec(null), { width: 900, height: 480 })).toBeNull()
  })
})

describe('how many panels fit in a row', () => {
  it('stays roughly square when nothing is asked for', () => {
    expect(facetColumns(9, 0, 900)).toBe(3)
  })

  it('honours a choice, up to what the width can hold', () => {
    expect(facetColumns(9, 2, 900)).toBe(2)
    expect(facetColumns(9, 6, 400)).toBe(2)
  })

  it('never returns none', () => {
    expect(facetColumns(4, 0, 50)).toBe(1)
  })
})

describe('the values a column offers', () => {
  it('lists them once each, in the order they appear', () => {
    expect(facetValues(table, 'category')).toEqual(['Zines', 'Poetry', 'Fiction'])
  })
})

it('reserves global and panel headings inside the requested export dimensions', () => {
  const dims = { width: 600, height: 600 }
  const layout = facetLayout(table, spec('category', 2), dims)!
  for (const panel of layout.panels) {
    expect(panel.frame.y + panel.frame.height).toBeLessThanOrEqual(dims.height)
    expect(panel.frame.x + panel.frame.width).toBeLessThanOrEqual(dims.width)
    expect(panel.geometry.dims.height + 26).toBe(panel.frame.height)
  }
  expect(facetLayout(table, spec('category', 1), { width: 600, height: 240 })!.message).toContain('Increase chart size')
})
it('keeps matching X values aligned even when groups have different coverage', () => {
  const source = parseTable('month,category,entries\n2026-01,A,10\n2026-03,A,20\n2026-02,B,12\n2026-03,B,18')
  const layout = facetLayout(source, spec('category'), { width: 900, height: 480 })!
  expect(layout.panels[0].geometry.xPixelForLabel('2026-03-01')).toBe(layout.panels[1].geometry.xPixelForLabel('2026-03-01'))
})
it('keeps a zero baseline for faceted bars and common category positions', () => {
  const source = parseTable('month,category,entries\nJan,A,10\nMar,A,20\nFeb,B,12\nMar,B,18')
  const chart = spec('category'); chart.chart.type = 'bar'
  const layout = facetLayout(source, chart, { width: 900, height: 480 })!
  for (const panel of layout.panels) {
    expect(panel.geometry.yPixelForValue(0)).toBe(panel.geometry.plot.bottom)
    expect(panel.geometry.series[0].bars.every(bar => bar.height > 0)).toBe(true)
  }
  expect(layout.panels[0].geometry.xPixelForLabel('Mar')).toBe(layout.panels[1].geometry.xPixelForLabel('Mar'))
})
it('uses the same histogram bins across panels', () => {
  const source = parseTable('month,category,entries\nJan,A,1\nFeb,A,2\nJan,B,80\nFeb,B,100')
  const chart = spec('category'); chart.chart.type = 'histogram'
  const layout = facetLayout(source, chart, { width: 900, height: 480 })!
  expect(layout.panels[0].geometry.xTicks).toEqual(layout.panels[1].geometry.xTicks)
})

it('orders panels by their final plotted value, matching the displayed endpoint', () => {
  const source = parseTable('month,category,entries\n2026-01,A,100\n2026-03,A,1\n2026-01,B,10\n2026-03,B,20')
  const layout = facetLayout(source, spec('category'), { width: 900, height: 480 })!
  expect(layout.panels.map(panel => panel.value)).toEqual(['B', 'A'])
})

it('keeps series colors, bar slots and plot scales consistent when a panel is missing a series', () => {
  const source = parseTable('x,panel,series,value\nA,One,alpha,10\nA,One,beta,20\nA,Two,beta,30')
  const chart = defaultSpec('Consistent series')
  chart.chart.type = 'grouped-bar'
  chart.chart.encodings = { x: 'x', y: ['value'], series: 'series' }
  chart.chart.facet = { column: 'panel', columns: 2 }
  const layout = facetLayout(source, chart, { width: 900, height: 480 })!
  const first = layout.panels.find(p => p.value === 'One')!.geometry
  const second = layout.panels.find(p => p.value === 'Two')!.geometry
  const a = first.series.find(s => s.key === 'beta')!, b = second.series.find(s => s.key === 'beta')!
  expect(a.color).toBe(b.color)
  expect(a.bars[0].x).toBe(b.bars[0].x)
  expect(a.bars[0].width).toBe(b.bars[0].width)
  expect(first.yPixelForValue(20)).toBe(second.yPixelForValue(20))
})
it('chooses the same retained series globally when folding each panel into Other', () => {
  const source = parseTable('x,panel,series,value\nA,One,alpha,100\nA,One,beta,1\nA,Two,beta,50\nA,Two,alpha,1')
  const chart = defaultSpec()
  chart.chart.type = 'bar'
  chart.chart.encodings = { x: 'x', y: ['value'], series: 'series', limitSeries: 1 }
  chart.chart.facet = { column: 'panel', columns: 2 }
  const layout = facetLayout(source, chart, { width: 900, height: 480 })!
  for (const panel of layout.panels) expect(panel.geometry.series.map(s => s.key)).toEqual(['alpha', 'Other'])
  expect(layout.panels.find(p => p.value === 'Two')!.geometry.series[1].points[0].value).toBe(50)
})
