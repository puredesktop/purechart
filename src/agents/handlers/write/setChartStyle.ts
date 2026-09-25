import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  getChartAgentContext,
  updateChartAgentSpec,
} from '../../../lib/agentChartTools'
import type { ChartStyle } from '../../../lib/chartSpec'
import type { ChartAgentToolContext } from '../../context'
import { readBooleanArg, readNumberArg } from '../args'

export async function setChartStyleHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const style: Partial<ChartStyle> = {
    rangeFrame: readBooleanArg(args, 'rangeFrame'),
    grid: readBooleanArg(args, 'grid'),
    directLabels: readBooleanArg(args, 'directLabels'),
    rug: readBooleanArg(args, 'rug'),
    strokeWidth: readNumberArg(args, 'strokeWidth'),
    pointRadius: readNumberArg(args, 'pointRadius'),
  }
  const spec = updateChartAgentSpec(context.spec, context.table, { style })
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Chart style updated',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Chart style updated',
      }),
    ),
  }
}
