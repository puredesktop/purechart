import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult, AgentToolInvokeContext } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import type { ChartAgentToolContext } from '../../context'
import type { ChartProposalInput } from '../../../lib/chartProposal'

export async function proposeChartHandler(context: ChartAgentToolContext, { arguments: args }: AgentToolInvokeContext): Promise<AgentToolHandlerResult> {
  const proposal = context.proposeChart(args as unknown as ChartProposalInput)
  return { content: formatAgentToolJson({
    proposalId: proposal.id, status: 'Pending review in PureChart. No chart changes have been applied.',
    changes: proposal.changes, explanation: proposal.explanation,
    calculation: proposal.calculation, warnings: proposal.warnings, findings: proposal.findings,
  }) }
}
