/**
 * Registering PureChart's exposed operations with the platform:
 *   - 6 composite `fn_*` functions (always exposed)
 *   - 7 core atomic tools (~23% of 31, always exposed)
 *   - 3 universal escape-hatch meta-tools (`discoverAppTools`,
 *     `callExtendedReadTool`, `callExtendedTool`) giving full on-demand access
 *     to all 24 specialist atomic tools.
 */
import { useMemo, useRef } from 'react'
import type { AgentToolHandler } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { usePlatformAgentTools } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import {
  AgentChartToolError,
  EXPOSED_TOOL_NAMES,
  PURECHART_AGENT_LOG_LABEL,
  type ChartAgentToolContext,
} from '../agents/catalog'
import { buildPureChartHandlers } from '../agents/operationsRegistry'
import type { ChartSession } from './useChartSession'

export interface ChartDocumentActions {
  saveDocument: () => Promise<string | null>
  /** Lifecycle-aware delete: detaches the bound document before removal. */
  deleteChartDocument: (path: string) => Promise<void>
  /** The rendered chart — the element the header export buttons serialize. */
  getChartSvg: () => SVGSVGElement | null
}

function toChartAgentToolContext(
  session: ChartSession,
  documentActions: ChartDocumentActions,
): ChartAgentToolContext {
  return {
    // Read through the live refs, never the rendered snapshot: two tool calls
    // in one tick must each see the other's write.
    get spec() {
      return session.liveSpec()
    },
    get table() {
      return session.liveTable()
    },
    get sheet() {
      return session.liveSheet()
    },
    proposeChart: session.proposeChart,
    createDocument: session.createDocument,
    addChart: session.addChart,
    focusChart: session.focusChart,
    removeChart: session.removeChart,
    duplicateChart: session.duplicateChart,
    get documentPath() {
      return session.liveDocumentPath()
    },
    status: session.status,
    applyChartSpec: session.applyChartSpec,
    openChartPath: session.openChartPath,
    saveDocument: documentActions.saveDocument,
    deleteChartDocument: documentActions.deleteChartDocument,
    getChartSvg: documentActions.getChartSvg,
    exportSvg: session.exportSvg,
    exportPng: session.exportPng,
  }
}

export function usePureChartAgentTools(
  ready: boolean,
  session: ChartSession,
  documentActions: ChartDocumentActions,
): void {
  const contextRef = useRef<ChartAgentToolContext>(
    toChartAgentToolContext(session, documentActions),
  )
  contextRef.current = toChartAgentToolContext(session, documentActions)

  const registryHandlers = useMemo(
    () => buildPureChartHandlers(() => contextRef.current),
    [],
  )

  // Statically key-preserving registration so `scripts/check-manifests.mjs`
  // can verify every manifest tool has a live registered handler at build time.
  const handlers = useMemo(
    () =>
      Object.fromEntries(
        EXPOSED_TOOL_NAMES.map(name => [
          name,
          async (invoke: Parameters<AgentToolHandler>[0]) =>
            registryHandlers[name]!(invoke),
        ]),
      ),
    [registryHandlers],
  )

  usePlatformAgentTools({
    ready,
    tools: EXPOSED_TOOL_NAMES,
    logLabel: PURECHART_AGENT_LOG_LABEL,
    errorType: AgentChartToolError,
    handlers,
  })
}
