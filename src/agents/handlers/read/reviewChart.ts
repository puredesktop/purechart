import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type { AgentToolHandlerResult } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { reviewChart } from '../../../lib/chartReview'
import type { ChartAgentToolContext } from '../../context'

/**
 * What is wrong with the drawing, measured.
 *
 * The point of handing this to the drawer is that an assistant otherwise has
 * no way to check its own chart: it can assert the colours are fine, and be
 * wrong, and never find out. Each finding carries the fix that settles it,
 * applied with applyChartFix.
 */
export async function reviewChartHandler(
  context: ChartAgentToolContext,
): Promise<AgentToolHandlerResult> {
  const review = reviewChart(context.table, context.spec)
  return {
    content: formatAgentToolJson({
      findings: review.findings.map((finding, index) => ({
        index,
        id: finding.id,
        severity: finding.severity,
        title: finding.title,
        detail: finding.detail,
        about: finding.about,
        fixes: finding.fixes.map((fix, fixIndex) => ({
          index: fixIndex,
          label: fix.label,
        })),
      })),
      cleared: review.cleared,
      colour: review.colour,
      blocking: review.findings.filter(finding => finding.severity === 'blocking')
        .length,
    }),
  }
}
