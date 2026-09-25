import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { chartDescription, chartFindings } from '../../../lib/chartFindings'
import type { ChartAgentToolContext } from '../../context'

/**
 * What the chart says, as arithmetic.
 *
 * Quote these rather than reading a trend off the shape of the lines: each
 * one carries the working, and none of them can describe a chart other than
 * the one drawn.
 */
export async function describeChartHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  return {
    content: formatAgentToolJson({
      spoken: chartDescription(context.table, context.spec),
      findings: chartFindings(context.table, context.spec),
    }),
  }
}
