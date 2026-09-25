import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  getChartAgentContext,
  replaceChartDataAgentSpec,
} from '../../../lib/agentChartTools'
import type { DataFormat } from '../../../lib/dataParse'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg, readBooleanArg } from '../args'

export async function replaceChartDataHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const dataText = readAgentToolStringArg(args, 'dataText')
  if (!dataText) return { content: 'dataText is required', isError: true }
  const { spec, table } = replaceChartDataAgentSpec(context.spec, {
    dataText,
    format: readAgentToolStringArg(args, 'format') as DataFormat | undefined,
    resetChart: readBooleanArg(args, 'resetChart'),
  })
  context.applyChartSpec(spec, { table, status: 'Chart data replaced' })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table,
        documentPath: context.documentPath,
        status: 'Chart data replaced',
      }),
    ),
  }
}
