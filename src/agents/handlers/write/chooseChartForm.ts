import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { applyForm, suggestForms } from '../../../lib/chartForms'
import { reviewChart } from '../../../lib/chartReview'
import { readBooleanArg, readNumberArg } from '../args'
import type { ChartAgentToolContext } from '../../context'

/**
 * Take one of suggestChartForms' candidates.
 *
 * It ADDS a chart to the sheet by default, because a document holds several
 * readings of one table and replacing the one you were looking at throws away
 * work nobody asked to lose. Pass `replace: true` to change the chart in
 * front of you instead.
 */
export async function chooseChartFormHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const forms = suggestForms(context.table)
  if (forms.length === 0) {
    throw new AgentChartToolError(
      'There is no data to suggest a form for. Load or create a chart first.',
    )
  }
  const index = readNumberArg(args, 'form')
  if (index === undefined) {
    throw new AgentChartToolError(
      `Name the form by index. Call suggestChartForms first; there are ${forms.length}.`,
    )
  }
  const candidate = forms[index]
  if (!candidate) {
    throw new AgentChartToolError(
      `There are ${forms.length} candidates (0–${forms.length - 1}), not ${index}.`,
    )
  }
  if (!candidate.supported) {
    throw new AgentChartToolError(
      `This table cannot support that form: ${candidate.because} Choose a supported one, or change the data.`,
    )
  }

  const spec = { ...applyForm(context.spec, candidate), title: candidate.job }
  const replace = readBooleanArg(args, 'replace') === true
  if (replace) {
    context.applyChartSpec(spec, { table: context.table, status: candidate.job })
  } else {
    context.addChart(spec, candidate.job)
  }
  const review = reviewChart(context.table, spec)
  return {
    content: formatAgentToolJson({
      chose: candidate.job,
      added: !replace,
      type: candidate.type,
      encodings: candidate.encodings,
      facet: candidate.facet,
      findings: review.findings.map(entry => ({
        id: entry.id,
        severity: entry.severity,
        title: entry.title,
      })),
    }),
  }
}
