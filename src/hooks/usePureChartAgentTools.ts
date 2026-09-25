import { proposeChartHandler } from '../agents/handlers/write/proposeChart'
import { usePlatformAgentTools } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { useRef } from 'react'
import {
  AgentChartToolError,
  PURECHART_AGENT_LOG_LABEL,
  PURECHART_AGENT_TOOL_NAMES,
  type ChartAgentToolContext,
} from '../agents/catalog'
import { createChartHandler } from '../agents/handlers/create'
import { deleteChartDocumentHandler } from '../agents/handlers/delete'
import {
  describeChartHandler,
  getChartContextHandler,
  getChartDataHandler,
  getChartSpecHandler,
  listChartsHandler,
  reviewChartHandler,
  suggestChartFormsHandler,
} from '../agents/handlers/read'
import {
  addChartAnnotationHandler,
  applyChartFixHandler,
  chooseChartFormHandler,
  clearChartAnnotationsHandler,
  duplicateChartHandler,
  facetChartHandler,
  focusChartHandler,
  removeChartHandler,
  exportChartHandler,
  openChartHandler,
  replaceChartDataHandler,
  saveChartHandler,
  setChartAxisHandler,
  setChartCaptionHandler,
  setChartEncodingsHandler,
  setChartPaletteHandler,
  setChartStyleHandler,
  setChartTitleHandler,
  setChartTypeHandler,
  updateChartHandler,
} from '../agents/handlers/write'
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
    get sheet() { return session.liveSheet() },
    proposeChart: session.proposeChart,
    createDocument: session.createDocument,
    addChart: session.addChart,
    focusChart: session.focusChart,
    removeChart: session.removeChart,
    duplicateChart: session.duplicateChart,
    get documentPath() { return session.liveDocumentPath() },
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

  usePlatformAgentTools({
    ready,
    tools: PURECHART_AGENT_TOOL_NAMES,
    logLabel: PURECHART_AGENT_LOG_LABEL,
    errorType: AgentChartToolError,
    handlers: {
      proposeChart: invoke => proposeChartHandler(contextRef.current, invoke),
      getChartContext: () => getChartContextHandler(contextRef.current),
      getChartSpec: () => getChartSpecHandler(contextRef.current),
      getChartData: invoke => getChartDataHandler(contextRef.current, invoke),
      listCharts: () => listChartsHandler(contextRef.current),
      suggestChartForms: () => suggestChartFormsHandler(contextRef.current),
      reviewChart: () => reviewChartHandler(contextRef.current),
      describeChart: () => describeChartHandler(contextRef.current),
      createChart: invoke => createChartHandler(contextRef.current, invoke),
      openChart: invoke => openChartHandler(contextRef.current, invoke),
      setChartTitle: invoke => setChartTitleHandler(contextRef.current, invoke),
      setChartType: invoke => setChartTypeHandler(contextRef.current, invoke),
      setChartEncodings: invoke =>
        setChartEncodingsHandler(contextRef.current, invoke),
      setChartPalette: invoke =>
        setChartPaletteHandler(contextRef.current, invoke),
      setChartStyle: invoke => setChartStyleHandler(contextRef.current, invoke),
      updateChart: invoke => updateChartHandler(contextRef.current, invoke),
      chooseChartForm: invoke =>
        chooseChartFormHandler(contextRef.current, invoke),
      applyChartFix: invoke => applyChartFixHandler(contextRef.current, invoke),
      facetChart: invoke => facetChartHandler(contextRef.current, invoke),
      setChartAxis: invoke => setChartAxisHandler(contextRef.current, invoke),
      setChartCaption: invoke =>
        setChartCaptionHandler(contextRef.current, invoke),
      focusChart: invoke => focusChartHandler(contextRef.current, invoke),
      duplicateChart: invoke =>
        duplicateChartHandler(contextRef.current, invoke),
      removeChart: invoke => removeChartHandler(contextRef.current, invoke),
      replaceChartData: invoke =>
        replaceChartDataHandler(contextRef.current, invoke),
      addChartAnnotation: invoke =>
        addChartAnnotationHandler(contextRef.current, invoke),
      clearChartAnnotations: () =>
        clearChartAnnotationsHandler(contextRef.current),
      saveChart: () => saveChartHandler(contextRef.current),
      exportChart: invoke => exportChartHandler(contextRef.current, invoke),
      deleteChartDocument: invoke =>
        deleteChartDocumentHandler(contextRef.current, invoke),
    },
  })
}
