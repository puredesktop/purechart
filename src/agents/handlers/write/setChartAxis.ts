import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import type { ChartAxis } from '../../../lib/chartSpec'
import { readAgentToolStringArg } from '../args'
import type { ChartAgentToolContext } from '../../context'

const FORMATS: ChartAxis['format'][] = ['plain', 'grouped', 'percent', 'compact']

/**
 * Name an axis and say how its numbers read.
 *
 * An axis labelled with a bare column name — `rating`, out of what? — carries
 * that ambiguity into every document the figure is placed in.
 */
export async function setChartAxisHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const axis = readAgentToolStringArg(args, 'axis')
  if (axis !== 'x' && axis !== 'y') {
    throw new AgentChartToolError('axis must be "x" or "y".')
  }
  const format = readAgentToolStringArg(args, 'format')
  if (format && !FORMATS.includes(format as ChartAxis['format'])) {
    throw new AgentChartToolError(`format must be one of: ${FORMATS.join(', ')}.`)
  }

  const current = context.spec.chart.axes[axis]
  const name = readAgentToolStringArg(args, 'name')
  const unit = readAgentToolStringArg(args, 'unit')
  const next: ChartAxis = {
    name: name === undefined ? current.name : name === '' ? null : name,
    unit: unit === undefined ? current.unit : unit === '' ? null : unit,
    format: (format as ChartAxis['format'] | undefined) ?? current.format,
  }

  const spec = {
    ...context.spec,
    chart: { ...context.spec.chart, axes: { ...context.spec.chart.axes, [axis]: next } },
  }
  context.applyChartSpec(spec, {
    table: context.table,
    status: `${axis === 'x' ? 'X' : 'Y'} axis updated`,
  })
  return { content: formatAgentToolJson({ axis, ...next }) }
}
