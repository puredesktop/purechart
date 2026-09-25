import type { ChartProposal, ChartProposalInput } from '../lib/chartProposal'
import type { DataTable } from '../lib/dataParse'
import type { ChartSpec } from '../lib/chartSpec'
import type { ChartSheet } from '../lib/chartSheet'
import type {
  ChartExportOptions,
  ChartExportResult,
} from '../hooks/useChartSession'

/** Tab-scoped values and mutators agent handlers may use. */
export interface ChartAgentToolContext {
  createDocument: (spec: ChartSpec, table: DataTable) => Promise<void>
  proposeChart: (input: ChartProposalInput) => ChartProposal
  /** The whole document: its shared data and palette, and every chart on it. */
  sheet: ChartSheet
  /** Add a chart without disturbing the ones already there. */
  addChart: (spec: ChartSpec, label?: string) => void
  /** Work on one of the sheet's charts, or on the sheet itself (null). */
  focusChart: (id: string | null) => void
  removeChart: (id: string) => void
  duplicateChart: (id: string) => void
  spec: ChartSpec
  table: DataTable
  documentPath: string | null
  status: string
  applyChartSpec: (
    spec: ChartSpec,
    options?: {
      table?: DataTable
      documentPath?: string | null
      status?: string
    },
  ) => void
  /** Resolves with `null` on success or the error message the app shows. */
  openChartPath: (path: string) => Promise<string | null>
  /** Save the bound document through the unified lifecycle (creates a draft
   * when the chart has never been saved); resolves with the document path. */
  saveDocument: () => Promise<string | null>
  deleteChartDocument: (path: string) => Promise<void>
  /** The rendered chart `<svg>` — the same element the export buttons use. */
  getChartSvg: () => SVGSVGElement | null
  exportSvg: (
    svg: SVGSVGElement | null,
    options?: ChartExportOptions,
  ) => Promise<ChartExportResult | null>
  exportPng: (
    svg: SVGSVGElement | null,
    options?: ChartExportOptions,
  ) => Promise<ChartExportResult | null>
}
