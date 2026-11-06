import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { computeChartGeometry } from '../../../lib/chartLayout'
import { ChartOptionError, withTrendline } from '../../../lib/chartOptions'
import type { TrendSpec } from '../../../lib/chartTrend'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg } from '../args'

/**
 * Fit a trend through each series, the same edit as the Trendline control,
 * and reply with what each fit claims: its equation and R², or why no line
 * could be drawn. A trendline is a claim, so the reply carries the evidence.
 */
export async function setChartTrendlineHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const kind = readAgentToolStringArg(args, 'kind')
  if (!kind) throw new AgentChartToolError('kind is required: none, linear, exponential or polynomial.')
  const degree = Number(args.degree) === 3 ? 3 : 2
  const trend: TrendSpec | null = kind === 'none'
    ? null
    : kind === 'polynomial'
      ? { kind, degree }
      : { kind: kind as TrendSpec['kind'] }
  let spec
  try {
    spec = withTrendline(context.spec, trend)
  } catch (error) {
    if (error instanceof ChartOptionError) throw new AgentChartToolError(error.message)
    throw error
  }
  context.applyChartSpec(spec, {
    table: context.table,
    status: trend ? 'Trendline added' : 'Trendline removed',
  })
  const geometry = computeChartGeometry(context.table, spec, { width: 900, height: 540 })
  return {
    content: formatAgentToolJson({
      trendline: trend,
      fits: trend
        ? geometry.series.map(series => ({
            series: series.key,
            ...(series.trend?.error
              ? { error: series.trend.error }
              : { equation: series.trend?.equation ?? null, r2: series.trend?.r2 ?? null }),
          }))
        : [],
      ...(geometry.empty ? { message: geometry.message } : {}),
    }),
  }
}
