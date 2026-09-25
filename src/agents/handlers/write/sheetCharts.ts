import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { specForChart } from '../../../lib/chartSheet'
import { readAgentToolStringArg } from '../args'
import type { ChartAgentToolContext } from '../../context'

function resolve(context: ChartAgentToolContext, id: string | null): string {
  const charts = context.sheet.charts
  if (!id) {
    throw new AgentChartToolError(
      `Name the chart by its id. listCharts shows them: ${charts
        .map(chart => chart.id)
        .join(', ')}.`,
    )
  }
  if (!charts.some(chart => chart.id === id)) {
    throw new AgentChartToolError(
      `There is no chart "${id}" on this sheet. Its charts are: ${charts
        .map(chart => `${chart.id} (${specForChart(context.sheet, chart.id).title})`)
        .join(', ')}.`,
    )
  }
  return id
}

/** Work on one of the sheet's charts, or step back to the sheet itself. */
export async function focusChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const id = readAgentToolStringArg(args, 'chart')
  if (!id) {
    context.focusChart(null)
    return { content: formatAgentToolJson({ focused: null, onSheet: true }) }
  }
  const target = resolve(context, id)
  context.focusChart(target)
  return {
    content: formatAgentToolJson({
      focused: target,
      name: specForChart(context.sheet, target).title,
    }),
  }
}

/** A second reading of the same numbers, kept beside the first. */
export async function duplicateChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const target = resolve(context, readAgentToolStringArg(args, 'chart'))
  context.duplicateChart(target)
  return { content: formatAgentToolJson({ duplicated: target }) }
}

/** Take a chart off the sheet. The sheet always keeps at least one. */
export async function removeChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const target = resolve(context, readAgentToolStringArg(args, 'chart'))
  const name = specForChart(context.sheet, target).title
  context.removeChart(target)
  return { content: formatAgentToolJson({ removed: target, name }) }
}
