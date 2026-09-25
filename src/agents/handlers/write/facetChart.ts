import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { facetValues } from '../../../lib/chartFacet'
import { facetCandidates } from '../../../lib/chartReview'
import { readAgentToolStringArg, readNumberArg } from '../args'
import type { ChartAgentToolContext } from '../../context'

/** One panel per value of a column, on one shared scale. */
export async function facetChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const column = readAgentToolStringArg(args, 'column')
  const candidates = facetCandidates(context.table, context.spec)

  if (column === null || column === undefined || column === '') {
    const spec = {
      ...context.spec,
      chart: {
        ...context.spec.chart,
        facet: { ...context.spec.chart.facet, column: null },
      },
    }
    context.applyChartSpec(spec, {
      table: context.table,
      status: 'Back to one chart',
    })
    return { content: formatAgentToolJson({ facet: null, panels: 0 }) }
  }

  if (!context.table.columns.some(entry => entry.name === column)) {
    throw new AgentChartToolError(
      `There is no column "${column}". Columns that could be faceted: ${
        candidates.join(', ') || 'none — every column is numeric or is already the x axis'
      }.`,
    )
  }
  const values = facetValues(context.table, column)
  if (values.length < 2) {
    throw new AgentChartToolError(
      `"${column}" has ${values.length === 1 ? 'one value' : 'no values'}, so splitting by it would just be the chart again.`,
    )
  }

  const columns = readNumberArg(args, 'columns')
  const spec = {
    ...context.spec,
    chart: {
      ...context.spec.chart,
      facet: {
        column,
        columns: columns === undefined ? context.spec.chart.facet.columns : Math.max(0, Math.round(columns)),
      },
    },
  }
  context.applyChartSpec(spec, {
    table: context.table,
    status: `One panel per ${column}`,
  })
  return {
    content: formatAgentToolJson({
      facet: column,
      panels: values.length,
      values,
      note: 'Every panel shares one y scale, so the panels can be compared.',
    }),
  }
}
