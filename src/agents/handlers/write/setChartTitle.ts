import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  getChartAgentContext,
  updateChartAgentSpec,
} from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg } from '../args'

export async function setChartTitleHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const title = readAgentToolStringArg(args, 'title')
  if (!title) return { content: 'title is required', isError: true }
  const spec = updateChartAgentSpec(context.spec, context.table, { title })
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Chart title updated',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Chart title updated',
      }),
    ),
  }
}
