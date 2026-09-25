import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  createChartAgentSpec,
  getChartAgentContext,
} from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'
import { readObjectArg } from '../args'

export async function createChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const { spec, table } = createChartAgentSpec(
    readObjectArg(args, 'chart') ?? args,
  )
  await context.createDocument(spec, table)
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table,
        documentPath: null,
        status: 'Chart created',
      }),
    ),
  }
}
