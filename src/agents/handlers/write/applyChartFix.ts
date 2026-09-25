import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { applyChartFix, reviewChart } from '../../../lib/chartReview'
import { readAgentToolStringArg, readNumberArg } from '../args'
import type { ChartAgentToolContext } from '../../context'

/**
 * Carry out a fix reviewChart offered, then report what is left.
 *
 * Returning the fresh review is the point: it closes the loop, so the run is
 * draw, review, fix, review rather than draw and hope.
 */
export async function applyChartFixHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const findingId = readAgentToolStringArg(args, 'finding')
  if (!findingId) {
    throw new AgentChartToolError(
      'Name the finding to fix, as reviewChart reported its id.',
    )
  }
  const before = reviewChart(context.table, context.spec)
  const finding = before.findings.find(entry => entry.id === findingId)
  if (!finding) {
    throw new AgentChartToolError(
      `There is no finding "${findingId}" on this chart. Current findings: ${
        before.findings.map(entry => entry.id).join(', ') || 'none'
      }.`,
    )
  }
  const index = readNumberArg(args, 'fix') ?? 0
  const fix = finding.fixes[index]
  if (!fix) {
    throw new AgentChartToolError(
      finding.fixes.length === 0
        ? `"${findingId}" offers nothing to apply — it is telling you something about the data, not the drawing.`
        : `"${findingId}" offers ${finding.fixes.length} fixes (0–${finding.fixes.length - 1}), not ${index}.`,
    )
  }

  const spec = applyChartFix(context.spec, fix)
  const status = `Applied: ${fix.label}`
  context.applyChartSpec(spec, { table: context.table, status })
  const after = reviewChart(context.table, spec)
  return {
    content: formatAgentToolJson({
      applied: fix.label,
      remaining: after.findings.map(entry => ({
        id: entry.id,
        severity: entry.severity,
        title: entry.title,
      })),
      blocking: after.findings.filter(entry => entry.severity === 'blocking').length,
    }),
  }
}
