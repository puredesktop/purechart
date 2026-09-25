import { beforeEach, expect, it, vi } from 'vitest'
import { CHART_STYLES_KEY, readChartStyles, saveChartStyle, deleteChartStyle, applyChartStyle } from './chartStyles'
import { defaultSpec } from './chartSpec'
import { defaultPresentation } from './chartPresentation'
beforeEach(() => localStorage.clear())
it('saves, replaces, reloads and deletes named styles without deleting charts', () => {
  const spec = defaultSpec('Source')
  spec.chart.style.grid = true
  saveChartStyle(localStorage, ' Report ', spec)
  expect(readChartStyles(localStorage)[0].name).toBe('Report')
  spec.chart.style.grid = false
  saveChartStyle(localStorage, 'Report', spec)
  expect(readChartStyles(localStorage)).toHaveLength(1)
  expect(readChartStyles(localStorage)[0].style.grid).toBe(false)
  deleteChartStyle(localStorage, 'Report')
  expect(readChartStyles(localStorage)).toEqual([])
  expect(spec.title).toBe('Source')
})
it('preserves data, axes, calculations, annotations and references when applying', () => {
  const spec = defaultSpec('Working chart')
  spec.data.inline = { format: 'csv', text: 'x,y\n1,10' }
  spec.chart.axes.y.max = 100
  spec.chart.presentation = { ...defaultPresentation(), references: [{ id: 'a', axis: 'y', value: 5, label: 'Target' }] }
  const source = defaultSpec(); source.chart.style.grid = true
  const saved = saveChartStyle(localStorage, 'Grid', source)[0]
  const applied = applyChartStyle(spec, saved)
  expect(applied.data).toBe(spec.data)
  expect(applied.chart.axes).toBe(spec.chart.axes)
  expect(applied.chart.annotations).toBe(spec.chart.annotations)
  expect(applied.chart.transform).toBe(spec.chart.transform)
  expect(applied.chart.presentation?.references).toBe(spec.chart.presentation.references)
  expect(applied.chart.style.grid).toBe(true)
  expect(spec.chart.style.grid).toBe(false)
})
it('normalizes invalid saved fields and preserves another window’s newer styles', () => {
  localStorage.setItem(CHART_STYLES_KEY, JSON.stringify([{ name: 'Imported', style: { pointRadius: -9 }, legend: 'wrong' }, { name: '', style: {} }]))
  expect(readChartStyles(localStorage)[0].legend).toBe('auto')
  expect(readChartStyles(localStorage)[0].style.pointRadius).toBeGreaterThan(0)
  saveChartStyle(localStorage, 'Second window', defaultSpec())
  saveChartStyle(localStorage, 'First window', defaultSpec())
  expect(readChartStyles(localStorage).map(style => style.name)).toEqual(['Imported', 'Second window', 'First window'])
})
it('does not claim success or overwrite unreadable libraries when storage fails', () => {
  localStorage.setItem(CHART_STYLES_KEY, 'broken')
  expect(() => saveChartStyle(localStorage, 'New', defaultSpec())).toThrow()
  expect(localStorage.getItem(CHART_STYLES_KEY)).toBe('broken')
  localStorage.clear()
  const storage = { getItem: () => null, setItem: vi.fn(() => { throw new Error('Quota exceeded') }) } as unknown as Storage
  expect(() => saveChartStyle(storage, 'New', defaultSpec())).toThrow('Quota exceeded')
})
