import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  getChartAgentContext,
  updateChartAgentSpec,
} from '../../../lib/agentChartTools'
import type { ChartType } from '../../../lib/chartSpec'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg } from '../args'

export async function setChartTypeHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const type = readAgentToolStringArg(args, 'type')
  if (!type) return { content: 'type is required', isError: true }
  const spec = updateChartAgentSpec(context.spec, context.table, {
    type: type as ChartType,
  })
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Chart type updated',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Chart type updated',
      }),
    ),
  }
}
