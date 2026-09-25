import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import type {
  AgentToolHandlerResult,
  AgentToolInvokeContext,
} from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { AgentChartToolError } from '../../../lib/agentChartTools'
import { validateChartExportSize } from '../../../lib/chartExport'
import type { FigurePalette } from '../../../lib/chartFigures'
import { renderChartSvg } from '../../../lib/chartRender'
import type { ChartAgentToolContext } from '../../context'
import { readAgentToolStringArg, readBooleanArg, readNumberArg } from '../args'

/**
 * The drawer twin of the SVG / PNG header buttons.
 *
 * It renders from the spec, so it no longer needs the chart to be on screen,
 * and it can write into another document's package — which is what makes a
 * chart something a deck or a report can ask for rather than a file left
 * where only this chart can find it. A chart that has never been saved still
 * gets its own draft first, so there is a document to attribute the figure
 * to.
 */
export async function exportChartHandler(
  context: ChartAgentToolContext,
  { arguments: args }: AgentToolInvokeContext,
): Promise<AgentToolHandlerResult> {
  const format = (readAgentToolStringArg(args, 'format') ?? 'svg').toLowerCase()
  if (format !== 'svg' && format !== 'png') {
    throw new AgentChartToolError("format must be 'svg' or 'png'.")
  }
  for (const key of ['width', 'height', 'scale']) {
    if (args[key] !== undefined && (typeof args[key] !== 'number' || !Number.isFinite(args[key]))) {
      throw new AgentChartToolError(`${key} must be a finite number.`)
    }
  }
  const width = readNumberArg(args, 'width')
  const height = readNumberArg(args, 'height')
  const drawn = renderChartSvg(context.table, context.spec, { width, height })
  if (drawn.message) {
    throw new AgentChartToolError(
      `nothing to export: ${drawn.message} Give the chart data (createChart or replaceChartData) and x/y encodings first — getChartContext shows what is missing.`,
    )
  }
  const sizeError = validateChartExportSize(drawn.width, drawn.height, format === 'png' ? readNumberArg(args, 'scale') : 1)
  if (sizeError) throw new AgentChartToolError(sizeError)
  const svg = context.getChartSvg()
  const basePath = context.documentPath ?? (await context.saveDocument())
  if (!basePath) {
    throw new AgentChartToolError(
      'could not create the chart document the export belongs to.',
    )
  }
  const destination = readAgentToolStringArg(args, 'destination') ?? undefined
  const paletteArg = readAgentToolStringArg(args, 'palette') ?? 'source'
  if (paletteArg !== 'source' && paletteArg !== 'monochrome') {
    throw new AgentChartToolError("palette must be 'source' (the chart's own colours) or 'monochrome' (one ink, for print).")
  }
  const palette: FigurePalette = paletteArg
  const options = {
    palette,
    basePath,
    destination,
    width,
    height,
    scale: readNumberArg(args, 'scale'),
    transparent: readBooleanArg(args, 'transparent'),
  }
  const result =
    format === 'png'
      ? await context.exportPng(svg, options)
      : await context.exportSvg(svg, options)
  if (!result || result.kind !== 'file') {
    throw new AgentChartToolError(
      `the ${format.toUpperCase()} export failed; the app shows the error.`,
    )
  }
  return {
    content: formatAgentToolJson({
      exported: result.path,
      format,
      width: drawn.width,
      height: drawn.height,
      documentPath: basePath,
      placedIn: destination ?? null,
      palette,
      // The figure remembers this chart; when the data moves, rerenderFigures
      // (or the person, from Export) redraws it in place.
      linked: true,
    }),
  }
}
