import { describe, expect, it } from 'vitest'
import {
  figureDescription,
  figureFingerprint,
  figureSourcePath,
  forgetFigure,
  parseFigures,
  recordFigure,
  sayStale,
  serializeFigures,
  staleFigures,
  type FigureRecord,
} from './chartFigures'

const figure: FigureRecord = {
  collectionPath: '/books/Reef.book',
  relativePath: 'assets/figures/catch-by-year.svg',
  chartId: 'c1',
  format: 'svg',
  width: 1200,
  height: 800,
  scale: 1,
  transparent: false,
  palette: 'source',
  fingerprint: 'aaaa.bbbb',
  exportedAt: '2026-09-23T00:00:00.000Z',
}

describe('the figures a chart was drawn into', () => {
  it('comes back from disk as it went, and drops what is not a figure', () => {
    const kept = parseFigures(serializeFigures([figure]))
    expect(kept).toEqual([figure])
    expect(parseFigures('{"figures":[{"relativePath":"x"}]}')).toEqual([])
    expect(parseFigures('nope')).toEqual([])
  })

  it('records the same figure once, and forgets it by where it is', () => {
    const again = { ...figure, fingerprint: 'cccc.dddd', palette: 'monochrome' as const }
    const list = recordFigure(recordFigure([], figure), again)
    expect(list).toHaveLength(1)
    expect(list[0]!.fingerprint).toBe('cccc.dddd')
    expect(forgetFigure(list, figure)).toEqual([])
  })

  it('finds the figures drawn before the chart changed, per chart on the sheet', () => {
    const other = { ...figure, relativePath: 'assets/figures/other.png', chartId: 'c2', format: 'png' as const }
    const stale = staleFigures([figure, other], id => (id === 'c1' ? 'aaaa.bbbb' : 'moved.moved'))
    expect(stale.map(entry => entry.chartId)).toEqual(['c2'])
    expect(sayStale(stale.length)).toBe('One figure was drawn before this chart last changed.')
    expect(sayStale(0)).toContain('current')
  })

  it('fingerprints the serialized sheet the way the library will read it', () => {
    const sheet = { title: 'Catch', data: { mode: 'inline', inline: { format: 'csv', text: 'x,y\n1,2' } }, palette: { id: 'science', custom: [] }, charts: [{ id: 'c1', spec: { chart: { type: 'bar' } } }, { id: 'c2', spec: { chart: { type: 'line' } } }] }
    const text = JSON.stringify(sheet)
    const one = figureFingerprint(text, 'c1')
    expect(one).toBe(figureFingerprint(text, 'c1'))
    expect(one).not.toBe(figureFingerprint(text, 'c2'))
    // Changing the other chart leaves this one's figures current.
    const changed = JSON.stringify({ ...sheet, charts: [sheet.charts[0], { id: 'c2', spec: { chart: { type: 'area' } } }] })
    expect(figureFingerprint(changed, 'c1')).toBe(one)
    expect(figureFingerprint(changed, 'c2')).not.toBe(figureFingerprint(text, 'c2'))
    // Changing the data changes every chart's.
    const moved = JSON.stringify({ ...sheet, data: { mode: 'inline', inline: { format: 'csv', text: 'x,y\n1,3' } } })
    expect(figureFingerprint(moved, 'c1').split('.')[0]).not.toBe(one.split('.')[0])
  })

  it('writes the tags the library reads, and names the source relative to the collection', () => {
    const text = figureDescription(figure)
    expect(text).toContain('source:chart')
    expect(text).toContain('fingerprint:aaaa.bbbb')
    expect(text).toContain('view:c1')
    expect(text).toContain('render:1200x800:source:svg')
    expect(figureSourcePath('/books/Reef.book', '/books/Reef.book/charts/Catch.chart')).toBe('charts/Catch.chart')
    expect(figureSourcePath('/books/Reef.book', '/charts/Catch.chart')).toBe('/charts/Catch.chart')
  })
})
