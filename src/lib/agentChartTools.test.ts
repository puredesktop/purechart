import { describe, expect, it } from 'vitest'
import {
  AgentChartToolError,
  chartAgentSpecView,
  chartDocumentPathFromInput,
  createChartAgentSpec,
  getChartAgentContext,
  getChartAgentData,
  replaceChartDataAgentSpec,
  setChartPaletteAgentSpec,
  updateChartAgentSpec,
} from './agentChartTools'

const CSV = `year,north,south
2022,12,8
2023,18,14
`

describe('agentChartTools', () => {
  it('creates a chart from inline data with suggested encodings', () => {
    const { spec, table } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
      type: 'bar',
    })

    expect(spec.title).toBe('Regional sales')
    expect(spec.chart.type).toBe('bar')
    expect(spec.chart.encodings).toEqual({
      x: 'year',
      y: ['north', 'south'],
      series: null,
      limitSeries: 0,
    })
    expect(table.rows).toHaveLength(2)
  })

  it('summarizes context and data without returning every row by default', () => {
    const { spec, table } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })

    expect(
      getChartAgentContext({
        spec,
        table,
        documentPath: '/tmp/sales.chart.json',
        status: 'All changes saved',
      }),
    ).toMatchObject({
      documentPath: '/tmp/sales.chart.json',
      title: 'Regional sales',
      data: { rowCount: 2, columnCount: 3 },
    })
    expect(getChartAgentData(spec, table, 1)).toMatchObject({
      rows: [{ year: 2022, north: 12, south: 8 }],
      truncated: true,
    })
  })

  it('updates chart encodings and style with column validation', () => {
    const { spec, table } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })
    const next = updateChartAgentSpec(spec, table, {
      type: 'line',
      x: 'year',
      y: ['south'],
      style: { grid: true, pointRadius: 4 },
    })

    expect(next.chart.encodings.y).toEqual(['south'])
    expect(next.chart.style.grid).toBe(true)
    expect(next.chart.style.pointRadius).toBe(4)
    expect(() => updateChartAgentSpec(spec, table, { x: 'missing' })).toThrow(
      AgentChartToolError,
    )
  })

  it('leaves encodings alone when a partial update omits them', () => {
    const { spec, table } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })
    // How the handlers build their input: every key present, unset ones
    // undefined. Only `type` is an instruction here.
    const next = updateChartAgentSpec(spec, table, {
      title: undefined,
      type: 'bar',
      x: undefined,
      y: undefined,
      series: undefined,
      style: undefined,
    })
    expect(next.chart.type).toBe('bar')
    expect(next.chart.encodings).toEqual(spec.chart.encodings)
    expect(next.title).toBe('Regional sales')
  })

  it('clears an encoding only on an explicit null or empty list', () => {
    const { spec, table } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })
    const cleared = updateChartAgentSpec(spec, table, { x: null, y: [] })
    expect(cleared.chart.encodings).toEqual({ x: null, y: [], series: null , limitSeries: 0})
    const onlyY = updateChartAgentSpec(spec, table, { y: ['south'] })
    expect(onlyY.chart.encodings).toEqual({
      x: 'year',
      y: ['south'],
      series: null,
      limitSeries: 0,
    })
  })

  it('accepts .chart packages and legacy .chart.json files as document paths', () => {
    expect(chartDocumentPathFromInput('/tmp/sales.chart')).toBe(
      '/tmp/sales.chart',
    )
    expect(chartDocumentPathFromInput('/tmp/sales.chart/')).toBe(
      '/tmp/sales.chart',
    )
    expect(chartDocumentPathFromInput('/tmp/sales.chart.json')).toBe(
      '/tmp/sales.chart.json',
    )
    expect(() => chartDocumentPathFromInput('/tmp/sales.csv')).toThrow(
      AgentChartToolError,
    )
    expect(() => chartDocumentPathFromInput(null)).toThrow(AgentChartToolError)
  })

  it('elides the inline data text from the spec view', () => {
    const { spec, table } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })
    const view = chartAgentSpecView(spec, table)
    expect(JSON.stringify(view)).not.toContain('2023,18,14')
    expect(view.data.inline).toEqual({
      format: 'csv',
      characters: CSV.length,
      elided: true,
    })
    expect(view.dataSummary.rowCount).toBe(2)
    expect(view.chart.encodings).toEqual(spec.chart.encodings)
  })

  it('sets built-in and custom palettes for chart color', () => {
    const { spec } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })
    const builtIn = setChartPaletteAgentSpec(spec, { palette: 'ember' })
    expect(builtIn.chart.style.palette).toBe('ember')

    const custom = setChartPaletteAgentSpec(spec, {
      label: 'Launch',
      colors: ['#123456', '#abcdef', 'not-a-color'],
    })
    expect(custom.chart.style.palette).toBe('agent-launch')
    expect(custom.chart.style.customPalettes).toEqual([
      {
        id: 'agent-launch',
        label: 'Launch',
        colors: ['#123456', '#abcdef'],
        custom: true,
      },
    ])
  })

  it('replaces data and can re-suggest encodings', () => {
    const { spec } = createChartAgentSpec({
      title: 'Regional sales',
      dataText: CSV,
    })
    const { spec: next, table } = replaceChartDataAgentSpec(spec, {
      dataText: 'quarter,total\nQ1,4\nQ2,9\n',
      resetChart: true,
    })

    expect(table.columns.map(column => column.name)).toEqual([
      'quarter',
      'total',
    ])
    expect(next.chart.encodings).toEqual({
      x: 'quarter',
      y: ['total'],
      series: null,
      limitSeries: 0,
    })
  })
})
