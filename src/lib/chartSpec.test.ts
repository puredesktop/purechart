import { describe, expect, it } from 'vitest'
import { parseDelimited, type DataTable } from './dataParse'
import {
  CHART_SCHEMA_VERSION,
  chartPackageFiles,
  defaultSpec,
  migrateSpec,
  parseSpecJson,
  serializeSpec,
  suggestEncodings,
} from './chartSpec'

const table: DataTable = {
  columns: [
    { name: 'year', type: 'date' },
    { name: 'region', type: 'string' },
    { name: 'sales', type: 'number' },
    { name: 'cost', type: 'number' },
  ],
  rows: [],
}

describe('suggestEncodings', () => {
  it('prefers a date column for x and all remaining numeric columns for y', () => {
    expect(suggestEncodings(table)).toEqual({
      x: 'year',
      y: ['sales', 'cost'],
      series: null,
      limitSeries: 0,
    })
  })

  it('falls back to the first column when no date exists', () => {
    expect(
      suggestEncodings({
        columns: [
          { name: 'label', type: 'string' },
          { name: 'count', type: 'number' },
        ],
        rows: [],
      }),
    ).toEqual({ x: 'label', y: ['count'], series: null , limitSeries: 0})
  })

  it('returns empty encodings for an empty table', () => {
    expect(suggestEncodings({ columns: [], rows: [] })).toEqual({
      x: null,
      y: [],
      series: null,
      limitSeries: 0,
    })
  })
})

describe('migrateSpec', () => {
  it('fills defaults from a partial spec', () => {
    const spec = migrateSpec({ title: 'Q1', chart: { type: 'bar' } })
    expect(spec.schemaVersion).toBe(CHART_SCHEMA_VERSION)
    expect(spec.title).toBe('Q1')
    expect(spec.chart.type).toBe('bar')
    expect(spec.chart.style.rangeFrame).toBe(true)
    expect(spec.chart.style.palette).toBe('science')
    expect(spec.chart.encodings).toEqual({ x: null, y: [], series: null , limitSeries: 0})
  })

  it('preserves known palettes and ignores unknown palettes', () => {
    expect(
      migrateSpec({ chart: { style: { palette: 'science' } } }).chart.style
        .palette,
    ).toBe('science')
    expect(
      migrateSpec({ chart: { style: { palette: 'rainbow' } } }).chart.style
        .palette,
    ).toBe('science')
  })

  it('preserves custom palettes when the selected palette is defined', () => {
    const spec = migrateSpec({
      chart: {
        style: {
          palette: 'custom-team',
          customPalettes: [
            {
              id: 'custom-team',
              label: 'Team palette',
              colors: ['#123456', '#abcdef'],
            },
          ],
        },
      },
    })

    expect(spec.chart.style.palette).toBe('custom-team')
    expect(spec.chart.style.customPalettes).toEqual([
      {
        id: 'custom-team',
        label: 'Team palette',
        colors: ['#123456', '#abcdef'],
        custom: true,
      },
    ])
  })

  it('coerces an unknown chart type to line and a string y to an array', () => {
    const spec = migrateSpec({
      chart: { type: 'pie', encodings: { x: 'a', y: 'b' } },
    })
    expect(spec.chart.type).toBe('line')
    expect(spec.chart.encodings.y).toEqual(['b'])
  })

  it('returns a clean default for garbage input', () => {
    expect(migrateSpec(null)).toEqual(defaultSpec())
  })

  it('normalizes an unknown data format to csv', () => {
    const spec = migrateSpec({
      data: { mode: 'inline', inline: { format: 'xlsx', text: 'a,b\n1,2' } },
    })
    expect(spec.data.inline?.format).toBe('csv')
    expect(
      migrateSpec({ data: { inline: { format: 'tsv', text: '' } } }).data
        .inline?.format,
    ).toBe('tsv')
  })
})

describe('chartPackageFiles', () => {
  it('writes a manifest and the spec as chart.json', () => {
    const spec = defaultSpec('Quarterly revenue')
    const files = chartPackageFiles(spec, '2026-01-01T00:00:00.000Z')
    expect(files.map(file => file.name)).toEqual(['manifest.json', 'chart.json'])
    expect(JSON.parse(files[0].content)).toEqual({
      schemaVersion: CHART_SCHEMA_VERSION,
      kind: 'purescience.chart.document',
      packageSuffix: '.chart',
      title: 'Quarterly revenue',
      savedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(parseSpecJson(files[1].content)).toEqual(spec)
  })
})

describe('serialize round-trip', () => {
  it('round-trips through JSON', () => {
    const spec = migrateSpec({
      title: 'T',
      chart: { type: 'scatter', encodings: { x: 'a', y: ['b', 'c'] } },
    })
    expect(parseSpecJson(serializeSpec(spec))).toEqual(spec)
  })

  it('opens the two retired chart types as the scatter they always drew', () => {
    expect(migrateSpec({ chart: { type: 'heatmap' } }).chart.type).toBe('scatter')
    expect(migrateSpec({ chart: { type: 'small-multiples' } }).chart.type).toBe('scatter')
    expect(migrateSpec({ chart: { type: 'histogram' } }).chart.type).toBe('histogram')
  })

  it('keeps range annotations in data coordinates and drops pixel-stored ones', () => {
    const spec = migrateSpec({
      chart: {
        annotations: [
          {
            id: 'new', text: 'span', createdAt: 'now',
            target: { kind: 'range', x: { from: '2020', to: '2022' }, y: { from: 9, to: 2 },
              summary: { count: 3, min: 2, max: 9, average: 5, change: 1 } },
          },
          {
            id: 'old', text: 'pixels', createdAt: 'then',
            target: { kind: 'range', range: { x0: 10, x1: 80, y0: 5, y1: 60 },
              summary: { count: 3, min: 2, max: 9, average: 5, change: 1 } },
          },
        ],
      },
    })
    expect(spec.chart.annotations).toHaveLength(1)
    expect(spec.chart.annotations[0]!.target).toMatchObject({
      kind: 'range', x: { from: '2020', to: '2022' }, y: { from: 2, to: 9 },
    })
  })
})


describe('a year column, which arrives as a number', () => {
  const byYear = parseDelimited(
    'year,north,south\n2018,12,8\n2019,15,11\n2020,9,14\n2021,18,16\n2022,21,15\n2023,24,19',
  )

  it('becomes the axis, never a measure', () => {
    const encodings = suggestEncodings(byYear)
    expect(encodings.x).toBe('year')
    expect(encodings.y).toEqual(['north', 'south'])
  })

  it('has nothing to measure when the only numbers are the axis', () => {
    // A column of years is an axis with nothing on it. Saying so beats
    // charting the years against themselves.
    const onlyYears = parseDelimited('year\n2018\n2019\n2020\n2021')
    const encodings = suggestEncodings(onlyYears)
    expect(encodings.x).toBe('year')
    expect(encodings.y).toEqual([])
  })
})
