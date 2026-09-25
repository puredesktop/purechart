import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { chartDocumentPathFromInput } from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg } from '../args'

export async function deleteChartDocumentHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const path = chartDocumentPathFromInput(readAgentToolStringArg(args, 'path'))
  await context.deleteChartDocument(path)
  return { content: formatAgentToolJson({ deleted: path }) }
}
