import {
  createAppOperationsRegistry,
  defineAppTool,
  type AppAtomicToolDefinition,
  type BuildHandlersOptions,
} from '@purescience/platform-ui/bridge/appFunctions'
import type {
  AgentToolHandler,
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { PURECHART_ATOMIC_TOOL_SCHEMAS } from './atomicToolSchemas'
import { AgentChartToolError, type ChartAgentToolContext } from './catalog'
import { PURECHART_FUNCTIONS } from './functions'
import { createChartHandler } from './handlers/create'
import { deleteChartDocumentHandler } from './handlers/delete'
import {
  describeChartHandler,
  getChartContextHandler,
  getChartDataHandler,
  getChartSpecHandler,
  listChartsHandler,
  reviewChartHandler,
  suggestChartFormsHandler,
} from './handlers/read'
import {
  addChartAnnotationHandler,
  applyChartFixHandler,
  chooseChartFormHandler,
  clearChartAnnotationsHandler,
  duplicateChartHandler,
  exportChartHandler,
  facetChartHandler,
  focusChartHandler,
  openChartHandler,
  removeChartHandler,
  replaceChartDataHandler,
  saveChartHandler,
  setChartAxisHandler,
  setChartCaptionHandler,
  setChartEncodingsHandler,
  setChartPaletteHandler,
  setChartStyleHandler,
  setChartTitleHandler,
  setChartTrendlineHandler,
  setChartTypeHandler,
  updateChartHandler,
} from './handlers/write'
import { proposeChartHandler } from './handlers/write/proposeChart'

type AtomicRunner = (
  ctx: ChartAgentToolContext,
  invoke: AgentToolInvokeContext,
) => AgentToolHandlerResult | Promise<AgentToolHandlerResult>

const ATOMIC_RUNNERS: Record<string, AtomicRunner> = {
  getChartContext: ctx => getChartContextHandler(ctx),
  getChartSpec: ctx => getChartSpecHandler(ctx),
  getChartData: (ctx, invoke) => getChartDataHandler(ctx, invoke),
  listCharts: ctx => listChartsHandler(ctx),
  suggestChartForms: ctx => suggestChartFormsHandler(ctx),
  reviewChart: ctx => reviewChartHandler(ctx),
  describeChart: ctx => describeChartHandler(ctx),
  createChart: (ctx, invoke) => createChartHandler(ctx, invoke),
  openChart: (ctx, invoke) => openChartHandler(ctx, invoke),
  setChartTitle: (ctx, invoke) => setChartTitleHandler(ctx, invoke),
  setChartType: (ctx, invoke) => setChartTypeHandler(ctx, invoke),
  setChartEncodings: (ctx, invoke) => setChartEncodingsHandler(ctx, invoke),
  setChartPalette: (ctx, invoke) => setChartPaletteHandler(ctx, invoke),
  setChartStyle: (ctx, invoke) => setChartStyleHandler(ctx, invoke),
  updateChart: (ctx, invoke) => updateChartHandler(ctx, invoke),
  proposeChart: (ctx, invoke) => proposeChartHandler(ctx, invoke),
  chooseChartForm: (ctx, invoke) => chooseChartFormHandler(ctx, invoke),
  applyChartFix: (ctx, invoke) => applyChartFixHandler(ctx, invoke),
  facetChart: (ctx, invoke) => facetChartHandler(ctx, invoke),
  setChartAxis: (ctx, invoke) => setChartAxisHandler(ctx, invoke),
  setChartTrendline: (ctx, invoke) => setChartTrendlineHandler(ctx, invoke),
  setChartCaption: (ctx, invoke) => setChartCaptionHandler(ctx, invoke),
  focusChart: (ctx, invoke) => focusChartHandler(ctx, invoke),
  duplicateChart: (ctx, invoke) => duplicateChartHandler(ctx, invoke),
  removeChart: (ctx, invoke) => removeChartHandler(ctx, invoke),
  replaceChartData: (ctx, invoke) => replaceChartDataHandler(ctx, invoke),
  addChartAnnotation: (ctx, invoke) => addChartAnnotationHandler(ctx, invoke),
  clearChartAnnotations: ctx => clearChartAnnotationsHandler(ctx),
  saveChart: ctx => saveChartHandler(ctx),
  exportChart: (ctx, invoke) => exportChartHandler(ctx, invoke),
  deleteChartDocument: (ctx, invoke) => deleteChartDocumentHandler(ctx, invoke),
}

const atomicTools: AppAtomicToolDefinition<ChartAgentToolContext>[] =
  PURECHART_ATOMIC_TOOL_SCHEMAS.map(schema =>
    defineAppTool<ChartAgentToolContext>({
      ...schema,
      run: async (ctx, args, invoke) => {
        const runner = ATOMIC_RUNNERS[schema.name]
        if (!runner) {
          throw new AgentChartToolError(
            `Missing atomic tool handler for "${schema.name}".`,
          )
        }
        return runner(ctx, { ...invoke, shortName: schema.name, arguments: args })
      },
    }),
  )

/**
 * PureChart's unified Operations Registry built on `@purescience/platform-ui/bridge/appFunctions`:
 *   - 6 composite `function` workflows (`fn_*`, always exposed)
 *   - 7 core atomic tools (~23% of 31, always exposed)
 *   - 3 universal escape-hatch meta-tools (always exposed)
 *   - 24 extended specialist atomic tools (hidden by default, 100% reachable on demand)
 */
export const PURECHART_OPERATIONS_REGISTRY =
  createAppOperationsRegistry<ChartAgentToolContext>({
    appSlug: 'chart',
    appName: 'PureChart',
    functions: PURECHART_FUNCTIONS,
    tools: atomicTools,
  })

export function buildPureChartHandlers(
  getCtx: () => ChartAgentToolContext,
  options: BuildHandlersOptions<ChartAgentToolContext> = {},
): Record<string, AgentToolHandler> {
  return PURECHART_OPERATIONS_REGISTRY.buildHandlers(getCtx, {
    createError: message => new AgentChartToolError(message),
    ...options,
  })
}
