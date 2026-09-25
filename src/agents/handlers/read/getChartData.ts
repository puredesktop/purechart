import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { getChartAgentData } from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'
import { readNumberArg } from '../args'

export async function getChartDataHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  return {
    content: formatAgentToolJson(
      getChartAgentData(
        context.spec,
        context.table,
        readNumberArg(args, 'limit'),
      ),
    ),
  }
}
