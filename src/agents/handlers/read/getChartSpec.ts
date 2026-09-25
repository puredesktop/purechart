import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { chartAgentSpecView } from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'

// The inline data text is elided: it is the whole dataset and would flood
// the model on every read. getChartData pages the rows instead.
export async function getChartSpecHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  return {
    content: formatAgentToolJson(
      chartAgentSpecView(context.spec, context.table),
    ),
  }
}
