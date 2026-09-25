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
import {
  readObjectArg,
  readStringArrayArg,
  readAgentToolStringArg,
} from '../args'

export async function updateChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const patch = readObjectArg(args, 'patch') ?? args
  const spec = updateChartAgentSpec(context.spec, context.table, {
    title: readAgentToolStringArg(patch, 'title') ?? undefined,
    type: readAgentToolStringArg(patch, 'type') as never,
    x: 'x' in patch ? readAgentToolStringArg(patch, 'x') : undefined,
    y: readStringArrayArg(patch, 'y'),
    series:
      'series' in patch ? readAgentToolStringArg(patch, 'series') : undefined,
    style: readObjectArg(patch, 'style'),
  })
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Chart updated',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Chart updated',
      }),
    ),
  }
}
