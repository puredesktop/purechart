import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { getChartAgentContext } from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'

export async function getChartContextHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec: context.spec,
        table: context.table,
        documentPath: context.documentPath,
        status: context.status,
      }),
    ),
  }
}
