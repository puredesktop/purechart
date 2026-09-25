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
import { readAgentToolStringArg, readStringArrayArg } from '../args'

export async function setChartEncodingsHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const spec = updateChartAgentSpec(context.spec, context.table, {
    x: 'x' in args ? readAgentToolStringArg(args, 'x') : undefined,
    y: readStringArrayArg(args, 'y'),
    series:
      'series' in args ? readAgentToolStringArg(args, 'series') : undefined,
  })
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Chart encodings updated',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Chart encodings updated',
      }),
    ),
  }
}
