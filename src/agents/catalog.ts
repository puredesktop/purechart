/**
 * Exposed PureChart operations (must stay in sync 1:1 with `plugin.json` -> `app.agents.tools[].name`).
 *
 * 3-tier exposure (built on `@purescience/platform-ui/bridge/appFunctions`):
 *   1. 6 composite `function` workflows (`fn_*`) — replace 3–11 atomic round-trips each
 *   2. 7 core atomic tools (~23% of 31) — indispensable direct read/create/open/propose/save/export verbs
 *   3. 3 universal escape-hatch meta-tools (`discoverAppTools`, `callExtendedReadTool`, `callExtendedTool`)
 *      providing full on-demand access to the remaining 24 specialist atomic tools.
 */
export const PURECHART_FUNCTION_NAMES = [
  'fn_chartWorkspaceBriefing',
  'fn_auditAndDescribeChart',
  'fn_buildAndReviewChart',
  'fn_autoFixAndPolishChart',
  'fn_batchAnnotateChart',
  'fn_exportReadinessCheck',
] as const

export const PURECHART_CORE_TOOL_NAMES = [
  'getChartContext',
  'getChartData',
  'openChart',
  'createChart',
  'proposeChart',
  'saveChart',
  'exportChart',
] as const

export const PURECHART_META_TOOL_NAMES = [
  'discoverAppTools',
  'callExtendedReadTool',
  'callExtendedTool',
] as const

export const EXPOSED_TOOL_NAMES = [
  ...PURECHART_FUNCTION_NAMES,
  ...PURECHART_CORE_TOOL_NAMES,
  ...PURECHART_META_TOOL_NAMES,
] as const

/** Keep in sync with `plugin.json` -> `app.agents.tools[].name`. */
export const PURECHART_AGENT_TOOL_NAMES = EXPOSED_TOOL_NAMES

export const PURECHART_EXTENDED_TOOL_NAMES = [
  'getChartSpec',
  'listCharts',
  'suggestChartForms',
  'reviewChart',
  'describeChart',
  'setChartTitle',
  'setChartType',
  'setChartEncodings',
  'setChartPalette',
  'setChartStyle',
  'updateChart',
  'chooseChartForm',
  'applyChartFix',
  'facetChart',
  'setChartAxis',
  'setChartTrendline',
  'setChartCaption',
  'focusChart',
  'duplicateChart',
  'removeChart',
  'replaceChartData',
  'addChartAnnotation',
  'clearChartAnnotations',
  'deleteChartDocument',
] as const

export const PURECHART_ALL_ATOMIC_TOOL_NAMES = [
  ...PURECHART_CORE_TOOL_NAMES,
  ...PURECHART_EXTENDED_TOOL_NAMES,
] as const

export const PURECHART_AGENT_LOG_LABEL = 'purechart'

export { AgentChartToolError } from '../lib/agentChartTools'

export type { ChartAgentToolContext } from './context'
