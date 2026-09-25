/** Keep in sync with `plugin.json` -> `app.agents.tools[].name`. */
export const PURECHART_AGENT_TOOL_NAMES = [
  'getChartContext',
  'getChartSpec',
  'getChartData',
  'listCharts',
  'suggestChartForms',
  'reviewChart',
  'describeChart',
  'createChart',
  'openChart',
  'setChartTitle',
  'setChartType',
  'setChartEncodings',
  'setChartPalette',
  'setChartStyle',
  'updateChart',
  'proposeChart',
  'chooseChartForm',
  'applyChartFix',
  'facetChart',
  'setChartAxis',
  'setChartCaption',
  'focusChart',
  'duplicateChart',
  'removeChart',
  'replaceChartData',
  'addChartAnnotation',
  'clearChartAnnotations',
  'saveChart',
  'exportChart',
  'deleteChartDocument',
] as const

export const PURECHART_AGENT_LOG_LABEL = 'purechart'

export { AgentChartToolError } from '../lib/agentChartTools'

export type { ChartAgentToolContext } from './context'
