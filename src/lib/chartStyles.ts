import { migrateSpec, type ChartSpec, type ChartStyle } from './chartSpec'
import { defaultPresentation, sanitizePresentation, type ChartPresentation } from './chartPresentation'

export interface SavedChartStyle { name: string; style: ChartStyle; legend: ChartPresentation['legend'] }
export const CHART_STYLES_KEY = 'purechart:chart-styles:v1'
export function readChartStyles(storage: Storage): SavedChartStyle[] {
  const text = storage.getItem(CHART_STYLES_KEY)
  if (!text) return []
  const values: unknown = JSON.parse(text)
  if (!Array.isArray(values)) throw new Error('The saved style library is invalid.')
  const unique = new Map<string, SavedChartStyle>()
  for (const raw of values) {
    if (!raw || typeof raw.name !== 'string' || !raw.name.trim() || !raw.style || typeof raw.style !== 'object' || Array.isArray(raw.style)) continue
    const name = raw.name.trim()
    unique.set(name, { name, style: migrateSpec({ chart: { style: raw.style } }).chart.style, legend: sanitizePresentation({ legend: raw.legend })!.legend })
  }
  return [...unique.values()]
}
export function saveChartStyle(storage: Storage, name: string, spec: ChartSpec): SavedChartStyle[] {
  name = name.trim()
  if (!name) throw new Error('Give this style a name.')
  const styles = readChartStyles(storage)
  const saved = { name, style: migrateSpec(spec).chart.style, legend: spec.chart.presentation?.legend ?? 'auto' }
  const next = [...styles.filter(style => style.name !== name), saved]
  storage.setItem(CHART_STYLES_KEY, JSON.stringify(next))
  return next
}
export function deleteChartStyle(storage: Storage, name: string): SavedChartStyle[] {
  const next = readChartStyles(storage).filter(style => style.name !== name)
  storage.setItem(CHART_STYLES_KEY, JSON.stringify(next))
  return next
}
export function applyChartStyle(spec: ChartSpec, saved: SavedChartStyle): ChartSpec {
  return { ...spec, chart: { ...spec.chart, style: saved.style, presentation: { ...spec.chart.presentation ?? defaultPresentation(), legend: saved.legend } } }
}
