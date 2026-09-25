import { validateChartAnnotations } from '../../../lib/chartAnnotationValidation'
import { computeChartGeometry } from '../../../lib/chartLayout'
import { facetLayout } from '../../../lib/chartFacet'
import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  addChartAgentAnnotationSpec,
  getChartAgentContext,
} from '../../../lib/agentChartTools'
import type { ChartAnnotation } from '../../../lib/chartSpec'
import type { ChartAgentToolContext } from '../../context'
import { readObjectArg } from '../args'

export async function addChartAnnotationHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const raw = readObjectArg(args, 'annotation') ?? args
  const annotation = {
    ...raw,
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id
        : `agent-${Date.now().toString(36)}`,
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt
        : new Date().toISOString(),
  } as ChartAnnotation
  const spec = addChartAgentAnnotationSpec(context.spec, annotation)
  const dims = { width: 900, height: 540 }
  const facets = facetLayout(context.table, spec, dims)
  validateChartAnnotations(spec, facets ? facets.panels.map(p => p.geometry) : [computeChartGeometry(context.table, spec, dims)])
  context.applyChartSpec(spec, {
    table: context.table,
    status: 'Annotation saved',
  })
  return {
    content: formatAgentToolJson(
      getChartAgentContext({
        spec,
        table: context.table,
        documentPath: context.documentPath,
        status: 'Annotation saved',
      }),
    ),
  }
}
