import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  clearChartAgentAnnotationsSpec,
  getChartAgentContext,
} from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'

export async function clearChartAnnotationsHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const spec = clearChartAgentAnnotationsSpec(context.spec)
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Annotations cleared',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Annotations cleared',
      }),
    ),
  }
}
