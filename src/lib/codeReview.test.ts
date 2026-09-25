import { expect, it } from 'vitest'
import { detectDelimiter, parseDelimited, parseJsonData } from './dataParse'
import { defaultSpec, migrateSpec, parseSpecJson, serializeSpec } from './chartSpec'

it('ignores quoted separators when detecting a table delimiter', () => {
  expect(detectDelimiter('"sales, costs, margin"\tvalue\nNorth\t12')).toBe('\t')
})
it('preserves special CSV column names as ordinary own properties', () => {
  const table = parseDelimited('__proto__,value\nNorth,12')
  expect(Object.hasOwn(table.rows[0], '__proto__')).toBe(true)
  expect(table.rows[0].__proto__).toBe('North')
})
it('preserves special JSON column names as ordinary own properties', () => {
  const table = parseJsonData('[{"__proto__":"North","value":12}]')
  expect(Object.hasOwn(table.rows[0], '__proto__')).toBe(true)
  expect(table.rows[0].__proto__).toBe('North')
})
it('does not classify unparseable dates as a date axis', () => {
  expect(parseDelimited('date,value\n2026-99-99,12').columns[0].type).toBe('string')
  expect(parseJsonData('[{"date":"2026-99-99"}]').columns[0].type).toBe('string')
})
it.each([null, [], { unrelated: true }, { ...defaultSpec(), schemaVersion: 2 }])('rejects an invalid or unsupported document: %j', raw => {
  expect(() => parseSpecJson(JSON.stringify(raw))).toThrow()
})
it('keeps valid document round trips and legacy chart normalization', () => {
  expect(parseSpecJson(serializeSpec(defaultSpec()))).toEqual(defaultSpec())
  expect(migrateSpec({ chart: { type: 'heatmap' } }).chart.type).toBe('scatter')
})
it('does not treat inherited object members as chart types', () => {
  expect(migrateSpec({ chart: { type: 'constructor' } }).chart.type).toBe('line')
})
it('normalizes invalid drawing sizes before rendering', () => {
  const style = migrateSpec({ chart: { style: { strokeWidth: -1, pointRadius: Infinity } } }).chart.style
  expect(style.strokeWidth).toBe(defaultSpec().chart.style.strokeWidth)
  expect(style.pointRadius).toBe(defaultSpec().chart.style.pointRadius)
})
