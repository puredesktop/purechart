import { describe, expect, it } from 'vitest'
import { renderChartSvg } from './chartRender'
import { CHART_TRANSIENT_ATTR } from './chartExport'
import { defaultSpec, type ChartSpec } from './chartSpec'
import { parseTable } from './dataParse'

const csv = [
  'month,region,nominations',
  '2026-01,Aotearoa,18',
  '2026-02,Aotearoa,24',
  '2026-03,Aotearoa,31',
  '2026-01,Pacific,4',
  '2026-02,Pacific,6',
  '2026-03,Pacific,9',
].join('\n')

function spec(): ChartSpec {
  const value = defaultSpec('Nominations by region')
  value.chart.encodings = { x: 'month', y: ['nominations'], series: 'region' }
  return value
}

const table = parseTable(csv)

describe('drawing a chart with no window open', () => {
  const rendered = renderChartSvg(table, spec())

  it('produces a standalone SVG document', () => {
    expect(rendered.svg.startsWith('<?xml version="1.0"')).toBe(true)
    expect(rendered.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('inlines the chart font so it renders away from the app', () => {
    expect(rendered.svg).toContain('font-family:')
  })

  it('draws the data, not a placeholder', () => {
    expect(rendered.svg).toContain('Aotearoa')
    expect(rendered.svg).toContain('Pacific')
    expect(rendered.svg).toContain('<path')
  })

  it('carries no live exploration state', () => {
    expect(rendered.svg).not.toContain(CHART_TRANSIENT_ATTR)
  })

  it('reports nothing wrong when there is something to draw', () => {
    expect(rendered.message).toBeNull()
  })
})

describe('the size it is asked for', () => {
  it('draws at the width a page needs, not the width of a screen', () => {
    const wide = renderChartSvg(table, spec(), { width: 1600, height: 500 })
    expect(wide.width).toBe(1600)
    expect(wide.svg).toContain('1600')
  })

  it('refuses to draw something too small to read', () => {
    const tiny = renderChartSvg(table, spec(), { width: 10, height: 10 })
    expect(tiny.message).toContain('dimensions')
    expect(tiny.svg).toBe('')
  })
})

describe('the ground behind it', () => {
  it('is paper by default, so a chart is never dark text on nothing', () => {
    expect(renderChartSvg(table, spec()).svg).toContain('fill="#fcfcfb"')
  })

  it('can be left out, for a figure placed on a coloured page', () => {
    const clear = renderChartSvg(table, spec(), { background: null })
    expect(clear.svg).not.toContain('<rect x="0" y="0"')
  })
})

describe('a chart with nothing to draw', () => {
  it('still returns an SVG, and says what is missing', () => {
    const empty = renderChartSvg(parseTable(''), defaultSpec())
    expect(empty.svg).toContain('<svg')
    expect(empty.message).toBe('No data yet.')
  })
})

describe('an axis someone named', () => {
  it('draws the name and the unit, once, not on every tick', () => {
    const named = spec()
    named.chart.axes.y = { name: 'Nominations', unit: 'per month', format: 'plain' }
    const svg = renderChartSvg(table, named).svg
    expect(svg).toContain('Nominations (per month)')
    expect(svg.split('Nominations (per month)')).toHaveLength(2)
  })

  it('falls back to the column name only when there is a unit to attach', () => {
    const unitOnly = spec()
    unitOnly.chart.axes.y = { name: null, unit: '%', format: 'plain' }
    expect(renderChartSvg(table, unitOnly).svg).toContain('nominations (%)')
  })
})

describe('a chart split into panels', () => {
  it('draws every panel in one figure', () => {
    const faceted = spec()
    faceted.chart.facet = { column: 'region', columns: 0 }
    const svg = renderChartSvg(table, faceted, { width: 900, height: 480 }).svg
    expect(svg).toContain('Aotearoa')
    expect(svg).toContain('Pacific')
    // One outer document, with each panel nested inside it.
    expect(svg.match(/<svg/g)!.length).toBeGreaterThan(2)
  })
})

it('keeps SVG definitions distinct across independently rendered thumbnails', () => {
  const first = renderChartSvg(table, spec()).svg
  const second = renderChartSvg(table, spec()).svg
  const ids = (svg: string) => [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  expect(ids(first).length).toBeGreaterThan(0)
  expect(ids(first).filter(id => ids(second).includes(id))).toEqual([])
  for (const svg of [first, second]) {
    for (const match of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids(svg)).toContain(match[1])
  }
})

 it.each([NaN, Infinity, -1, 5000])('rejects invalid export width %s before rendering', width => {
   const rendered = renderChartSvg(table, spec(), { width })
   expect(rendered.svg).toBe('')
   expect(rendered.message).toContain('dimensions')
 })
