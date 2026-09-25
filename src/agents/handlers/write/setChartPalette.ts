import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  getChartAgentContext,
  setChartPaletteAgentSpec,
} from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg, readStringArrayArg } from '../args'

export async function setChartPaletteHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const spec = setChartPaletteAgentSpec(context.spec, {
    palette: readAgentToolStringArg(args, 'palette') ?? undefined,
    label: readAgentToolStringArg(args, 'label') ?? undefined,
    colors: readStringArrayArg(args, 'colors'),
  })
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Chart palette updated',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Chart palette updated',
      }),
    ),
  }
}
