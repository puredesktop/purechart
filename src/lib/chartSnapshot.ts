import { renderChartSvg } from './chartRender'
import { parseData } from './dataParse'
import type { ChartSpec } from './chartSpec'

/**
 * The switcher's thumbnail — the real chart, small.
 *
 * This used to draw its own approximation: the first series only, as mini
 * bars, in one hard-coded blue, with no axes. A thumbnail that disagrees with
 * the document it stands for is worse than no thumbnail, so it now renders
 * the same component at the same size the switcher shows.
 */
export function chartSnapshotHtml(spec: ChartSpec): string | null {
  const inline = spec.data.mode === 'inline' ? spec.data.inline : undefined
  if (!inline?.text?.trim()) return null
  try {
    const table = parseData(inline.text, inline.format, spec.data.columnTypes)
    if (table.columns.length === 0) return null
    const rendered = renderChartSvg(table, spec, { width: 900, height: 560 })
    if (rendered.message) return null
    return rendered.svg.replace(/^<\?xml[^>]*\?>\s*/, '')
  } catch {
    return null
  }
}
