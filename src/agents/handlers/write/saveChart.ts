import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'

export async function saveChartHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const saved = await context.saveDocument()
  if (!saved) {
    throw new AgentChartToolError('could not save the chart document.')
  }
  return { content: formatAgentToolJson({ saved, artifactPaths: [saved] }) }
}
