import type { SheetChart } from './chartSheet'
import type { DataTable } from './dataParse'

/** Explain removed dependencies before changing shared data; never rewrite a calculation. */
export function chartDataImpact(charts: SheetChart[], table: DataTable): { title: string; missing: string[] }[] {
  const available = new Set(table.columns.map(column => column.name))
  return charts.flatMap(({ spec }, index) => {
    const { encodings, facet, transform, presentation } = spec.chart
    const required = [encodings.x, ...encodings.y, encodings.series, facet.column,
      ...(transform?.filters.map(filter => filter.column) ?? []), transform?.sort?.column,
      presentation?.errorBars?.lower, presentation?.errorBars?.upper]
    const missing = [...new Set(required.filter((name): name is string => Boolean(name) && !available.has(name!)))]
    return missing.length ? [{ title: spec.title || `Chart ${index + 1}`, missing }] : []
  })
}
