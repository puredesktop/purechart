import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { specForChart } from '../../../lib/chartSheet'
import { reviewChart } from '../../../lib/chartReview'
import type { ChartAgentToolContext } from '../../context'

/**
 * Every chart on the sheet.
 *
 * A document holds several readings of one table, so "the chart" is ambiguous
 * until you know which. Call this before acting on one, and use the id.
 */
export async function listChartsHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const sheet = context.sheet
  return {
    content: formatAgentToolJson({
      document: sheet.title,
      palette: sheet.palette.id,
      focused: sheet.focusedId,
      onSheet: sheet.focusedId === null,
      charts: sheet.charts.map((chart, index) => {
        const spec = specForChart(sheet, chart.id)
        const review = reviewChart(context.table, spec)
        return {
          index,
          id: chart.id,
          name: spec.title,
          type: spec.chart.type,
          encodings: spec.chart.encodings,
          facet: spec.chart.facet.column,
          caption: spec.chart.caption,
          blocking: review.findings.filter(f => f.severity === 'blocking').length,
          checks: review.findings.filter(f => f.severity === 'check').length,
        }
      }),
      note: 'Data and palette belong to the sheet; everything else belongs to a chart.',
    }),
  }
}
