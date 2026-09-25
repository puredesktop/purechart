import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg } from '../args'

export async function openChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const path = readAgentToolStringArg(args, 'path')
  if (!path) return { content: 'path is required', isError: true }
  const error = await context.openChartPath(path)
  if (error) {
    return {
      content: `Could not open "${path}": ${error}. Pass an absolute path to a .chart package, a .chart.json file, or a CSV/TSV/JSON data file.`,
      isError: true,
    }
  }
  return { content: formatAgentToolJson({ opened: path }) }
}
