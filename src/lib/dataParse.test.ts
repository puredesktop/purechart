import { describe, expect, it } from 'vitest'
import {
  detectDelimiter,
  parseData,
  parseDelimited,
  parseJsonData,
  parseTable,
} from './dataParse'

describe('detectDelimiter', () => {
  it('picks the delimiter that yields the most fields', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',')
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t')
    expect(detectDelimiter('a;b;c')).toBe(';')
  })
})

describe('parseDelimited', () => {
  it('parses CSV with header and infers column types', () => {
    const table = parseDelimited('year,value\n2020,3\n2021,5.5\n')
    expect(table.columns).toEqual([
      { name: 'year', type: 'number' },
      { name: 'value', type: 'number' },
    ])
    expect(table.rows).toEqual([
      { year: 2020, value: 3 },
      { year: 2021, value: 5.5 },
    ])
  })

  it('infers date and string columns', () => {
    const table = parseDelimited(
      'day,city,temp\n2024-01-01,Oslo,-3\n2024-01-02,Oslo,-1\n',
    )
    expect(table.columns.map(c => c.type)).toEqual(['date', 'string', 'number'])
    expect(table.rows[0].day).toBeInstanceOf(Date)
    expect(table.rows[0].city).toBe('Oslo')
    expect(table.rows[0].temp).toBe(-3)
  })

  it('handles tab-separated pasted tables and blank cells', () => {
    const table = parseDelimited('a\tb\n1\t\n2\t9', '\t')
    expect(table.rows[0].b).toBeNull()
    expect(table.rows[1].b).toBe(9)
  })

  it('keeps leading-zero identifiers as text', () => {
    const table = parseDelimited('code,value\n01234,1\n00007,2\n')
    expect(table.columns[0]).toEqual({ name: 'code', type: 'string' })
    expect(table.rows.map(row => row.code)).toEqual(['01234', '00007'])
    expect(parseDelimited('v\n0\n0.5\n-0.25\n').columns[0].type).toBe('number')
  })

  it('returns an empty table for blank input', () => {
    expect(parseDelimited('   ')).toEqual({ columns: [], rows: [] })
  })
})

describe('parseJsonData', () => {
  it('parses an array of records', () => {
    const table = parseJsonData('[{"x":1,"y":2},{"x":3,"y":4}]')
    expect(table.columns).toEqual([
      { name: 'x', type: 'number' },
      { name: 'y', type: 'number' },
    ])
    expect(table.rows).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
  })

  it('unwraps a { data: [...] } envelope and unions keys', () => {
    const table = parseJsonData('{"data":[{"a":1},{"a":2,"b":"x"}]}')
    expect(table.columns.map(c => c.name)).toEqual(['a', 'b'])
    expect(table.rows[0].b).toBeNull()
  })
})

describe('parseTable', () => {
  it('routes JSON-looking text to the JSON parser', () => {
    const table = parseTable('[{"n":1}]')
    expect(table.columns).toEqual([{ name: 'n', type: 'number' }])
  })

  it('routes delimited text to the delimited parser', () => {
    const table = parseTable('p,q\n1,2')
    expect(table.columns.map(c => c.name)).toEqual(['p', 'q'])
  })
})

it('rejects malformed JSON, duplicate headings and extra cells without silently dropping data', () => {
  expect(() => parseTable('[{"a":1}')).toThrow()
  expect(() => parseTable('a,a\n1,2')).toThrow('unique')
  expect(() => parseTable('a,b\n1,2,3')).toThrow('more cells')
})

describe('parseData', () => {
  it('reads a semicolon-separated file saved as .csv', () => {
    const table = parseData('region;value\nNorth;3\nSouth;5', 'csv')
    expect(table.columns.map(column => column.name)).toEqual(['region', 'value'])
    expect(table.rows.map(row => row.value)).toEqual([3, 5])
  })

  it('keeps a plain comma CSV on commas', () => {
    const table = parseData('region,value\nNorth,3', 'csv')
    expect(table.columns.map(column => column.name)).toEqual(['region', 'value'])
  })

  it('does not split a one-column CSV whose cells hold semicolons', () => {
    const table = parseData('note\nHello; world', 'csv')
    expect(table.columns.map(column => column.name)).toEqual(['note'])
    expect(table.rows[0]!.note).toBe('Hello; world')
  })

  it('never re-splits a tab file on the commas inside its cells', () => {
    const table = parseData('note\nHello, world', 'tsv')
    expect(table.columns.map(column => column.name)).toEqual(['note'])
    expect(table.rows[0]!.note).toBe('Hello, world')
  })
})
