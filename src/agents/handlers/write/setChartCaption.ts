import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { chartFindings } from '../../../lib/chartFindings'
import { readAgentToolStringArg } from '../args'
import type { ChartAgentToolContext } from '../../context'

/**
 * The sentence under the chart.
 *
 * Read describeChart first and say what its findings say. The arithmetic is
 * what makes a caption true; you are what makes it worth reading, and what
 * can say why it happened — which no amount of arithmetic can. What you must
 * not do is describe a shape the numbers do not have.
 */
export async function setChartCaptionHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const caption = readAgentToolStringArg(args, 'caption')
  if (caption === undefined || caption === null) {
    throw new AgentChartToolError(
      'Pass the caption. An empty string clears it.',
    )
  }
  const spec = {
    ...context.spec,
    chart: { ...context.spec.chart, caption },
  }
  context.applyChartSpec(spec, {
    table: context.table,
    status: caption ? 'Caption written' : 'Caption cleared',
  })
  return {
    content: formatAgentToolJson({
      caption,
      /** So a wrong claim can be caught in the same turn it was made. */
      findings: chartFindings(context.table, spec).map(finding => finding.text),
    }),
  }
}
