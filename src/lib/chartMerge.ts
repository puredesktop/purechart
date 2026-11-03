import type { ChartSheet } from './chartSheet'
import { threeWayMerge } from './threeWayMerge'

/** Two copies' work on one sheet: chart by chart, and field by field inside a chart. The chart on screen stays each copy's own. */
export function mergeSheets(base: ChartSheet, local: ChartSheet, remote: ChartSheet): ChartSheet {
  return threeWayMerge(base, local, remote, { ownFields: ['focusedId'] })
}
