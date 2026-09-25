import { createChartProposal, proposalBase, type ChartProposal, type ChartProposalInput } from '../lib/chartProposal'
import type { ChartTransform } from '../lib/chartTransform'
import { editSheetData, type DataEdit } from '../lib/dataEditing'
import { ChartHistory } from '../lib/chartHistory'
import { applyForm, suggestForms } from '../lib/chartForms'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { registerPlatformAppObject } from '@purescience/platform-ui/bridge/documents'
import { CHART_APP_SLUG } from '../constants'
import {
  deleteFile,
  readTextFile,
  updateAssetMetadata,
  updateChartSettings,
  writeBinaryFile,
  writeTextFile,
} from '../bridge/platformBridge'
import { renderChartSvg } from '../lib/chartRender'
import {
  FIGURES_FILE,
  figureDescription,
  figureFingerprint,
  figureSourcePath,
  forgetFigure as forgetFigureRecord,
  parseFigures,
  recordFigure,
  serializeFigures,
  staleFigures as findStaleFigures,
  type FigurePalette,
  type FigureRecord,
} from '../lib/chartFigures'
import {
  assetExportPathForChart,
  chartPackageContentPath,
  dataFormatFromPath,
  isChartDocumentPath,
  isChartPackagePath,
  chartTitleFromPath,
  relativeChartDocumentPath,
} from '../lib/chartPaths'
import { EMPTY_TABLE, parseData, parseTable } from '../lib/dataParse'
import type { DataTable } from '../lib/dataParse'
import {
  chartPackageFiles,
  defaultSpec,
  parseSpecJson,
  serializeSpec,
  suggestEncodings,
} from '../lib/chartSpec'
import type {
  ChartAnnotation,
  ChartSpec,
  ChartStyle,
  ChartType,
  ChartAxis,
} from '../lib/chartSpec'
import type { ChartPalette } from '../lib/chartTheme'
import {
  addChart as addChartToSheet,
  duplicateChart as duplicateSheetChart,
  emptySheet,
  migrateSheet,
  moveChart as moveSheetChart,
  removeChart as removeSheetChart,
  serializeSheet,
  sheetPackageFiles,
  specForChart,
  withChart,
  type ChartSheet,
} from '../lib/chartSheet'
import {
  buildEmbedSnippet,
  svgToPngBytes,
} from '../lib/chartExport'
import type { ChartAppSettings, ResourceOpenEvent } from '../types'

interface UseChartSessionArgs {
  beforeOpen?: () => Promise<void>
  ready: boolean
  appSettings: ChartAppSettings
  resource: ResourceOpenEvent | null
  onResourceHandled: () => void
}

/** Where an export landed: a file beside the document, or a browser download. */
export type ChartExportResult =
  | { kind: 'file'; path: string }
  | { kind: 'download'; fileName: string }

export interface ChartExportOptions {
  /**
   * The document the export belongs to. Defaults to the bound document;
   * callers that just created the draft pass its path because the session
   * state has not re-rendered yet.
   */
  basePath?: string | null
  /**
   * Where the file should land, when that is not this chart's own package.
   *
   * A figure is usually wanted somewhere else — a deck's assets, a report's
   * package — and an export that can only write beside itself leaves the
   * asking app to copy the file afterwards, or to build its own charts.
   */
  destination?: string | null
  /** Draw at the size the page needs rather than the size on screen. */
  width?: number
  height?: number
  /** PNG only: pixels per unit. 3 for print. */
  scale?: number
  /** Leave the ground unpainted. */
  transparent?: boolean
  /**
   * Draw with the chart's own colours, or in one ink for a print edition.
   * The figure remembers which, so a redraw keeps it.
   */
  palette?: FigurePalette
  /** Which chart on the sheet, when not the one on screen. */
  chartId?: string | null
  /**
   * Redraw an existing figure in place: the file it already is, under the
   * collection it already lives in. Set by re-render, not by people.
   */
  relativePath?: string
}

export type ChartStyleToggle = 'rangeFrame' | 'grid' | 'directLabels' | 'rug'

export interface ChartSession {
  createDocument: (spec: ChartSpec, table: DataTable) => Promise<void>
  reportSaveFailure: (error: unknown) => void
  acknowledgeSave: () => void
  proposal: ChartProposal | null
  proposeChart: (input: ChartProposalInput) => ChartProposal
  applyProposal: (id: string) => void
  discardProposal: () => void
  isLoadedSheet: (sheet: ChartSheet) => boolean
  liveSheet: () => ChartSheet
  liveDocumentPath: () => string | null
  setTransform: (transform: ChartTransform) => void
  editData: (edit: DataEdit) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  resetHistory: () => void
  /** The whole document: shared data and palette, and every chart on it. */
  sheet: ChartSheet
  /** Replace the whole document, charts and all. */
  applySheet: (sheet: ChartSheet) => void
  /** Show the sheet (null) or one of its charts. */
  focusChart: (id: string | null) => void
  /** Add a chart without disturbing the ones already there. */
  addChart: (spec: ChartSpec, label?: string) => void
  duplicateChart: (id: string) => void
  removeChart: (id: string) => void
  moveChart: (id: string, to: number) => void
  /** The focused chart, with the sheet's data and palette folded in. */
  spec: ChartSpec
  table: DataTable
  documentPath: string | null
  status: string
  error: string | null
  /** Renames the document. */
  setTitle: (title: string) => void
  /** Renames the focused chart, not the document. */
  setChartName: (title: string) => void
  /** The sentence under the chart; it travels with the figure. */
  setCaption: (caption: string) => void
  /** Split into one panel per value of a column, or back to one chart. */
  setFacet: (column: string | null) => void
  setAxis: (axis: 'x' | 'y', patch: Partial<ChartAxis>) => void
  setPastedText: (text: string, options?: { resetChart?: boolean }) => void
  setType: (type: ChartType) => void
  setX: (column: string) => void
  setY: (column: string) => void
  addY: (column: string) => void
  removeY: (column: string) => void
  setSeries: (column: string | null) => void
  toggleStyle: (key: ChartStyleToggle) => void
  /** Numeric style options (stroke width, point radius). */
  setStyle: (
    patch: Pick<Partial<ChartStyle>, 'strokeWidth' | 'pointRadius'>,
  ) => void
  setPalette: (palette: string) => void
  addCustomPalette: (palette: { label: string; colors: string[] }) => string
  addAnnotation: (annotation: ChartAnnotation) => void
  clearAnnotations: () => void
  /** The spec as it is now — never a value captured at render time. */
  liveSpec: () => ChartSpec
  /** The table as it is now, for the same reason. */
  liveTable: () => DataTable
  applyChartSpec: (
    spec: ChartSpec,
    options?: {
      table?: DataTable
      documentPath?: string | null
      status?: string
    },
  ) => void
  /** Resolves with `null` on success or the error message shown in the app. */
  openChartPath: (path: string, options?: { externalChange?: boolean }) => Promise<string | null>
  saveChartAs: (path: string) => Promise<void>
  deleteChartDocument: (path: string) => Promise<void>
  /** Record the lifecycle-owned document path without touching the disk. */
  bindDocumentPath: (path: string | null) => void
  loadDataFile: (file: File) => Promise<void>
  /** Resolves with where the export went, or `null` after a reported error. */
  exportSvg: (
    svg: SVGSVGElement | null,
    options?: ChartExportOptions,
  ) => Promise<ChartExportResult | null>
  exportPng: (
    svg: SVGSVGElement | null,
    options?: ChartExportOptions,
  ) => Promise<ChartExportResult | null>
  /** Every figure this chart has been drawn into, from the package's figures.json. */
  figures: FigureRecord[]
  /** The ones drawn before the chart last changed. */
  staleFigures: FigureRecord[]
  /** Redraw figures in place — the stale ones unless told which. Resolves with how many were redrawn. */
  rerenderFigures: (figures?: readonly FigureRecord[]) => Promise<number>
  /** Stop tracking a figure that was removed from its collection. */
  forgetFigure: (figure: FigureRecord) => Promise<void>
}

/** Re-derive the working table from a spec's embedded or referenced data. */
async function materializeTable(spec: ChartSpec): Promise<DataTable> {
  if (spec.data.mode === 'reference' && spec.data.source?.path) {
    const text = await readTextFile(spec.data.source.path)
    return parseData(text, spec.data.source.format, spec.data.columnTypes)
  }
  if (spec.data.inline?.text) return parseTable(spec.data.inline.text, spec.data.columnTypes)
  return EMPTY_TABLE
}

function detectInlineFormat(text: string): 'csv' | 'tsv' | 'json' {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  const firstLine = trimmed.split(/\r?\n/).find(line => line.trim()) ?? ''
  if (firstLine.includes('\t')) return 'tsv'
  return 'csv'
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox.baseVal
  const rect = svg.getBoundingClientRect()
  return {
    width: viewBox?.width || rect.width || 1200,
    height: viewBox?.height || rect.height || 800,
  }
}

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
}

function safeFileStem(title: string): string {
  const stem = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || 'untitled-chart'
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function paletteIdFromLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `custom-${slug || 'palette'}-${Date.now().toString(36)}`
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function toUtf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function useChartSession({
  ready,
  appSettings,
  resource,
  onResourceHandled,
  beforeOpen,
}: UseChartSessionArgs): ChartSession {
  const beforeOpenRef = useRef(beforeOpen)
  beforeOpenRef.current = beforeOpen
  const [sheet, setSheet] = useState<ChartSheet>(() => emptySheet())
  // Every existing reader wants one chart, so the focused chart is served as a
  // whole spec with the sheet's shared data and palette folded back in.
  const spec = useMemo(
    () => specForChart(sheet, sheet.focusedId),
    [sheet],
  )
  const [table, setTable] = useState<DataTable>(EMPTY_TABLE)
  /**
   * The spec and table as they are right now, not as they were at the last
   * render. Two agent tool calls can arrive in the same tick; if both read the
   * React state they both start from the same snapshot and the second one's
   * write silently discards the first's. Every mutator updates these first,
   * and anything applying a change reads them rather than the rendered value.
   */
  const loadedSheetRef = useRef<ChartSheet | null>(null)
  const liveSheetRef = useRef<ChartSheet>(sheet)
  const liveSpecRef = useRef<ChartSpec>(spec)
  // The figures this chart was drawn into, kept in the package beside it.
  const [figures, setFigures] = useState<FigureRecord[]>([])
  const figuresRef = useRef<FigureRecord[]>([])
  figuresRef.current = figures
  const liveTableRef = useRef<DataTable>(table)
  liveSheetRef.current = sheet
  liveSpecRef.current = spec
  liveTableRef.current = table
  const [proposal, setProposal] = useState<ChartProposal | null>(null)
  const proposalRef = useRef<ChartProposal | null>(null)
  const discardProposal = useCallback(() => { proposalRef.current = null; setProposal(null) }, [])
  const history = useRef(new ChartHistory<{ sheet: ChartSheet; table: DataTable }>())
  const [, refreshHistory] = useState(0)
  const resetHistory = useCallback(() => {
    discardProposal()
    history.current.reset()
    refreshHistory(value => value + 1)
  }, [])
  const recordHistory = useCallback((group?: string) => {
    history.current.record({ sheet: liveSheetRef.current, table: liveTableRef.current }, group)
    refreshHistory(value => value + 1)
  }, [])
  const liveSpec = useCallback((): ChartSpec => liveSpecRef.current, [])
  /**
   * Change the spec through the live ref as well as React state, so a second
   * change arriving in the same tick starts from the first one's result.
   */
  const updateSpec = useCallback(
    (change: (current: ChartSpec) => ChartSpec, group?: string): ChartSpec => {
      const next = change(liveSpecRef.current)
      if (next === liveSpecRef.current) return next
      recordHistory(group ? `${liveSheetRef.current.focusedId}:${group}` : undefined)
      liveSpecRef.current = next
      const nextSheet = withChart(
        liveSheetRef.current,
        liveSheetRef.current.focusedId,
        next,
      )
      liveSheetRef.current = nextSheet
      setSheet(nextSheet)
      return next
    },
    [],
  )
  const liveTable = useCallback((): DataTable => liveTableRef.current, [])
  const applySheet = useCallback((next: ChartSheet, group?: string): void => {
    const current = liveSheetRef.current
    if (current.title !== next.title || current.data !== next.data || current.palette !== next.palette || current.charts !== next.charts) recordHistory(group)
    liveSheetRef.current = next
    liveSpecRef.current = specForChart(next, next.focusedId)
    setSheet(next)
  }, [])

  const applyTable = useCallback((next: DataTable): void => {
    liveTableRef.current = next
    setTable(next)
  }, [])
  const [documentPath, setDocumentPathState] = useState<string | null>(null)
  const documentPathRef = useRef<string | null>(null)
  const setDocumentPath = useCallback((path: string | null) => {
    documentPathRef.current = path
    setDocumentPathState(path)
  }, [])
  const [status, setStatus] = useState('Paste a table or open a CSV to begin.')
  const [error, setError] = useState<string | null>(null)

  // The boot snapshot is read once; later opens accumulate here, or the
  // list would only ever hold the boot entries plus the newest path.
  const loadGeneration = useRef(0)
  useEffect(
    () => () => {
      loadGeneration.current += 1
    },
    [],
  )
  const restoreHistory = useCallback((direction: 'undo' | 'redo') => {
    const current = { sheet: liveSheetRef.current, table: liveTableRef.current }
    const restored = history.current[direction](current)
    if (!restored) return
    loadGeneration.current += 1
    liveSheetRef.current = restored.sheet
    liveSpecRef.current = specForChart(restored.sheet, restored.sheet.focusedId)
    liveTableRef.current = restored.table
    setSheet(restored.sheet)
    setTable(restored.table)
    setError(null)
    setStatus(direction === 'undo' ? 'Undid last change' : 'Redid last change')
    refreshHistory(value => value + 1)
  }, [])
  const undo = useCallback(() => restoreHistory('undo'), [restoreHistory])
  const redo = useCallback(() => restoreHistory('redo'), [restoreHistory])

  const editData = useCallback((edit: DataEdit) => {
    try {
      const next = editSheetData(liveSheetRef.current, liveTableRef.current, edit)
      loadGeneration.current += 1
      applySheet(next.sheet)
      applyTable(next.table)
      setError(null)
      setStatus('Data updated for all charts')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [applySheet, applyTable])

  const recentPathsRef = useRef<string[]>(appSettings.recentPaths ?? [])
  const rememberPath = useCallback((path: string) => {
    const recent = [
      path,
      ...recentPathsRef.current.filter(item => item !== path),
    ].slice(0, 10)
    recentPathsRef.current = recent
    void updateChartSettings({ recentPaths: recent }).catch(() => undefined)
  }, [])

  const openChartPath = useCallback(
    async (filePath: string, options?: { externalChange?: boolean }): Promise<string | null> => {
      const startingSheet = liveSheetRef.current
      if (options?.externalChange && filePath !== documentPathRef.current) return 'Document is no longer open.'
      const generation = ++loadGeneration.current
      const superseded = () => generation !== loadGeneration.current || Boolean(options?.externalChange && (liveSheetRef.current !== startingSheet || documentPathRef.current !== filePath))
      setError(null)
      if (!options?.externalChange) setStatus('Opening…')
      try {
        if (!options?.externalChange) await beforeOpenRef.current?.()
        if (superseded()) return 'Open superseded by a newer document.'
        if (isChartPackagePath(filePath)) {
          // A `.chart` package: the spec lives in its content file.
          const packagePath = filePath.trim().replace(/\/+$/, '')
          const nextSheet = migrateSheet(
            JSON.parse(await readTextFile(chartPackageContentPath(packagePath))),
          )
          const nextTable = await materializeTable(specForChart(nextSheet, null))
          if (superseded())
            return 'Open superseded by a newer document.'
          loadedSheetRef.current = nextSheet
          applySheet(nextSheet)
          applyTable(nextTable)
          setDocumentPath(packagePath)
          setStatus(`Opened ${chartTitleFromPath(packagePath)}`)
          resetHistory()
          rememberPath(packagePath)
          return null
        }
        const text = await readTextFile(filePath)
        if (superseded())
          return 'Open superseded by a newer document.'
        if (isChartDocumentPath(filePath)) {
          const nextSheet = migrateSheet(JSON.parse(text))
          const nextTable = await materializeTable(specForChart(nextSheet, null))
          if (superseded())
            return 'Open superseded by a newer document.'
          loadedSheetRef.current = nextSheet
          applySheet(nextSheet)
          applyTable(nextTable)
          setDocumentPath(filePath)
          setStatus(`Opened ${chartTitleFromPath(filePath)}`)
        } else {
          const format = dataFormatFromPath(filePath) ?? 'csv'
          const nextTable = parseData(text, format)
          const nextSpec = defaultSpec(chartTitleFromPath(filePath))
          nextSpec.data = { mode: 'inline', inline: { format, text } }
          const candidate = suggestForms(nextTable).find(form => form.supported)
          nextSpec.chart = candidate ? applyForm(nextSpec, candidate).chart : { ...nextSpec.chart, encodings: suggestEncodings(nextTable) }
          const imported = migrateSheet(nextSpec)
          applySheet({ ...imported, focusedId: imported.charts[0]?.id ?? null })
          applyTable(nextTable)
          setDocumentPath(null)
          setStatus(
            `Loaded ${chartTitleFromPath(filePath)} — adjust and export`,
          )
        }
        resetHistory()
        rememberPath(filePath)
        return null
      } catch (loadError) {
        if (superseded())
          return 'Open superseded by a newer document.'
        const message =
          loadError instanceof Error ? loadError.message : String(loadError)
        setError(message)
        setStatus('Could not open file.')
        return message
      }
    },
    [rememberPath],
  )

  // Load a chart document or a raw data file delivered by the shell.
  useEffect(() => {
    const path = resource?.path?.trim()
    if (!ready || !path) return

    void openChartPath(path).finally(onResourceHandled)
  }, [ready, resource, onResourceHandled, openChartPath])

  // Autosave is owned by the unified document lifecycle (see App.tsx) — the
  // session only tracks which document the tab is bound to.
  const bindDocumentPath = useCallback((path: string | null) => {
    setDocumentPath(path)
  }, [])

  /** The document's name. */
  const setTitle = useCallback(
    (title: string) => {
      applySheet({ ...liveSheetRef.current, title }, 'document-title')
    },
    [applySheet],
  )

  /** This chart's own name, which is how it is known on the sheet. */
  const setChartName = useCallback(
    (title: string) => {
      updateSpec(current => ({ ...current, title }), 'title')
    },
    [updateSpec],
  )

  const setCaption = useCallback(
    (caption: string) => {
      updateSpec(current => ({
        ...current,
        chart: { ...current.chart, caption },
      }), 'caption')
    },
    [updateSpec],
  )

  const setFacet = useCallback(
    (column: string | null) => {
      updateSpec(current => ({
        ...current,
        chart: {
          ...current.chart,
          facet: { ...current.chart.facet, column },
        },
      }))
    },
    [updateSpec],
  )

  const setAxis = useCallback(
    (axis: 'x' | 'y', patch: Partial<ChartAxis>) => {
      updateSpec(current => ({
        ...current,
        chart: {
          ...current.chart,
          axes: {
            ...current.chart.axes,
            [axis]: { ...current.chart.axes[axis], ...patch },
          },
        },
      }), `axis:${axis}:${Object.keys(patch).sort().join(',')}`)
    },
    [updateSpec],
  )

  /** Show the sheet itself, or one of its charts. */
  const focusChart = useCallback(
    (id: string | null) => {
      applySheet({ ...liveSheetRef.current, focusedId: id })
    },
    [applySheet],
  )

  /**
   * Put a chart on the sheet. Nothing already there is touched — which is the
   * whole point: trying a second reading used to destroy the first.
   */
  const addChart = useCallback(
    (next: ChartSpec, label?: string) => {
      // A chart's name on the sheet is the job it does, which is exactly what
      // the person just clicked.
      const named = label ? { ...next, title: label } : next
      applySheet(addChartToSheet(liveSheetRef.current, named))
      setStatus(label ? `Added "${label}"` : 'Added a chart')
    },
    [applySheet],
  )

  const duplicateChart = useCallback(
    (id: string) => {
      applySheet(duplicateSheetChart(liveSheetRef.current, id))
      setStatus('Duplicated')
    },
    [applySheet],
  )

  const removeChart = useCallback(
    (id: string) => {
      applySheet(removeSheetChart(liveSheetRef.current, id))
      setStatus('Removed from the sheet')
    },
    [applySheet],
  )

  const moveChart = useCallback(
    (id: string, to: number) => {
      applySheet(moveSheetChart(liveSheetRef.current, id, to))
    },
    [applySheet],
  )

  const setPastedText = useCallback(
    (text: string, options?: { resetChart?: boolean }) => {
      loadGeneration.current += 1
      const format = detectInlineFormat(text)
      const columnTypes = liveSheetRef.current.data.columnTypes
      const nextTable = parseTable(text, columnTypes)
      updateSpec(current => {
        const next: ChartSpec = {
          ...current,
          data: { mode: 'inline', inline: { format, text }, columnTypes },
        }
        const enc = current.chart.encodings
        const has = (name: string | null): boolean =>
          name === null || nextTable.columns.some(column => column.name === name)
        // Encodings the new table cannot honour are not encodings: keeping
        // them leaves a blank stage and a chart that quietly says nothing.
        const stillFits =
          has(enc.x) && enc.y.every(name => has(name)) && has(enc.series)
        if (options?.resetChart || !enc.x || !enc.y.length || !stillFits) {
          const candidate = suggestForms(nextTable).find(form => form.supported)
          next.chart = candidate
            ? applyForm(next, candidate).chart
            : { ...current.chart, type: 'line', encodings: suggestEncodings(nextTable) }
        }
        return next
      })
      applyTable(nextTable)
      setStatus(
        nextTable.columns.length
          ? `${nextTable.rows.length} rows · ${nextTable.columns.length} columns`
          : 'Paste a table or open a CSV to begin.',
      )
    },
    [],
  )

  const loadDataFile = useCallback(async (file: File) => {
    const generation = ++loadGeneration.current
    setError(null)
    setStatus(`Loading ${file.name}…`)
    try {
      await beforeOpenRef.current?.()
      if (generation !== loadGeneration.current) return
      const text = await file.text()
      if (generation !== loadGeneration.current) return
      const format = dataFormatFromPath(file.name) ?? detectInlineFormat(text)
      const nextTable = parseData(text, format)
      const nextSpec = defaultSpec(chartTitleFromPath(file.name))
      nextSpec.data = { mode: 'inline', inline: { format, text } }
      const candidate = suggestForms(nextTable).find(form => form.supported)
      nextSpec.chart = candidate ? applyForm(nextSpec, candidate).chart : { ...nextSpec.chart, encodings: suggestEncodings(nextTable) }
      const imported = migrateSheet(nextSpec)
      applySheet({ ...imported, focusedId: imported.charts[0]?.id ?? null })
      applyTable(nextTable)
      setDocumentPath(null)
      resetHistory()
      setStatus(
        `Loaded ${file.name} — ${nextTable.rows.length} rows · ${nextTable.columns.length} columns`,
      )
    } catch (loadError) {
      if (generation !== loadGeneration.current) return
      setError(
        loadError instanceof Error ? loadError.message : String(loadError),
      )
      setStatus('Could not load data file.')
    }
  }, [])

  const patchEncodings = useCallback(
    (patch: Partial<ChartSpec['chart']['encodings']>) => {
      updateSpec(current => ({
        ...current,
        chart: {
          ...current.chart,
          encodings: { ...current.chart.encodings, ...patch },
        },
      }))
    },
    [],
  )

  const setType = useCallback((type: ChartType) => {
    updateSpec(current => ({ ...current, chart: { ...current.chart, type } }))
  }, [])

  const setX = useCallback(
    (column: string) => patchEncodings({ x: column }),
    [patchEncodings],
  )
  const setY = useCallback(
    (column: string) => patchEncodings({ y: [column] }),
    [patchEncodings],
  )
  const addY = useCallback((column: string) => {
    updateSpec(current => {
      if (current.chart.encodings.y.includes(column)) return current
      return {
        ...current,
        chart: {
          ...current.chart,
          encodings: {
            ...current.chart.encodings,
            y: [...current.chart.encodings.y, column],
          },
        },
      }
    })
  }, [])
  const removeY = useCallback((column: string) => {
    updateSpec(current => {
      const nextY = current.chart.encodings.y.filter(item => item !== column)
      return {
        ...current,
        chart: {
          ...current.chart,
          encodings: {
            ...current.chart.encodings,
            y: nextY,
          },
        },
      }
    })
  }, [])
  const setSeries = useCallback(
    (column: string | null) => patchEncodings({ series: column }),
    [patchEncodings],
  )

  const toggleStyle = useCallback((key: ChartStyleToggle) => {
    updateSpec(current => ({
      ...current,
      chart: {
        ...current.chart,
        style: { ...current.chart.style, [key]: !current.chart.style[key] },
      },
    }))
  }, [])

  const setStyle = useCallback(
    (patch: Pick<Partial<ChartStyle>, 'strokeWidth' | 'pointRadius'>) => {
      updateSpec(current => {
        const next = { ...current.chart.style }
        if (typeof patch.strokeWidth === 'number' && patch.strokeWidth > 0) {
          next.strokeWidth = patch.strokeWidth
        }
        if (typeof patch.pointRadius === 'number' && patch.pointRadius >= 0) {
          next.pointRadius = patch.pointRadius
        }
        return { ...current, chart: { ...current.chart, style: next } }
      }, `style:${Object.keys(patch).sort().join(',')}`)
    },
    [],
  )

  const setPalette = useCallback((palette: string) => {
    updateSpec(current => ({
      ...current,
      chart: {
        ...current.chart,
        style: { ...current.chart.style, palette },
      },
    }))
  }, [])

  const addCustomPalette = useCallback(
    (input: { label: string; colors: string[] }) => {
      const label = input.label.trim() || 'Custom palette'
      const palette: ChartPalette = {
        id: paletteIdFromLabel(label),
        label,
        colors: input.colors,
        custom: true,
      }
      updateSpec(current => ({
        ...current,
        chart: {
          ...current.chart,
          style: {
            ...current.chart.style,
            palette: palette.id,
            customPalettes: [
              ...current.chart.style.customPalettes.filter(
                item => item.id !== palette.id,
              ),
              palette,
            ],
          },
        },
      }))
      setStatus(`Saved ${label} palette`)
      return palette.id
    },
    [],
  )

  const addAnnotation = useCallback((annotation: ChartAnnotation) => {
    updateSpec(current => ({
      ...current,
      chart: {
        ...current.chart,
        annotations: [...current.chart.annotations, annotation],
      },
    }))
    setStatus('Annotation saved')
  }, [])

  const clearAnnotations = useCallback(() => {
    updateSpec(current => {
      if (current.chart.annotations.length === 0) return current
      return {
        ...current,
        chart: {
          ...current.chart,
          annotations: [],
        },
      }
    })
    setStatus('View reset')
  }, [])

  const applyChartSpec = useCallback(
    (
      nextSpec: ChartSpec,
      options?: {
        table?: DataTable
        documentPath?: string | null
        status?: string
      },
    ) => {
      const generation = ++loadGeneration.current
      updateSpec(() => nextSpec)
      if (options?.table) {
        applyTable(options.table)
      } else {
        void materializeTable(nextSpec)
          .then(table => {
            if (generation !== loadGeneration.current) return
            applyTable(table)
          })
          .catch(loadError => {
            if (generation !== loadGeneration.current) return
            setError(
              loadError instanceof Error
                ? loadError.message
                : String(loadError),
            )
          })
      }
      if (options && 'documentPath' in options) {
        setDocumentPath(options.documentPath ?? null)
      }
      setError(null)
      setStatus(options?.status ?? 'Chart updated')
    },
    [],
  )

  const createDocument = useCallback(async (next: ChartSpec, nextTable: DataTable) => {
    const generation = ++loadGeneration.current
    await beforeOpenRef.current?.()
    if (generation !== loadGeneration.current) throw new Error('New document superseded by another open request.')
    applySheet(emptySheet(next.title))
    applyChartSpec(next, { table: nextTable, documentPath: null, status: 'New chart — paste a table or open a CSV.' })
    if (nextTable.rows.length && liveSheetRef.current.charts[0]) {
      applySheet({ ...liveSheetRef.current, focusedId: liveSheetRef.current.charts[0].id })
    }
    resetHistory()
  }, [applySheet, applyChartSpec, resetHistory])

  const proposeChart = useCallback((input: ChartProposalInput) => {
    const next = createChartProposal(liveSheetRef.current.focusedId, liveSpecRef.current, liveTableRef.current, input)
    proposalRef.current = next
    setProposal(next)
    return next
  }, [])
  const applyProposal = useCallback((id: string) => {
    const pending = proposalRef.current
    if (!pending || pending.id !== id) throw new Error('This proposal is no longer available.')
    if (pending.base !== proposalBase(liveSheetRef.current.focusedId, liveSpecRef.current, liveTableRef.current)) {
      throw new Error('The chart or data changed after this proposal. Request a fresh preview before applying.')
    }
    applyChartSpec(pending.spec, { table: liveTableRef.current, status: 'Proposal applied — Undo restores the previous chart' })
    discardProposal()
  }, [applyChartSpec, discardProposal])

  // Save-as writes the same package the lifecycle autosaves (manifest +
  // chart.json); only a path that already names a legacy `.chart.json`
  // file stays a single file.
  const saveChartAs = useCallback(
    async (path: string) => {
      const clean = path.trim().replace(/\/+$/, '')
      const snapshot = liveSheetRef.current
      if (isChartPackagePath(clean)) {
        for (const file of sheetPackageFiles(snapshot)) {
          await writeTextFile(`${clean}/${file.name}`, file.content)
        }
        await registerPlatformAppObject({ appSlug: CHART_APP_SLUG, path: clean })
      } else {
        await writeTextFile(clean, serializeSheet(snapshot))
      }
      setDocumentPath(clean)
      rememberPath(clean)
      setError(null)
      setStatus(`Saved ${fileNameFromPath(clean)}`)
    },
    [rememberPath, spec],
  )

  const deleteChartDocument = useCallback(
    async (path: string) => {
      const clean = path.trim().replace(/\/+$/, '')
      // A `.chart` package is a folder; it only goes with `recursive`.
      await deleteFile(clean, isChartPackagePath(clean))
      if (documentPath === clean) setDocumentPath(null)
      setError(null)
      setStatus(`Deleted ${fileNameFromPath(clean)}`)
    },
    [documentPath],
  )

  // The chart to draw: the one on screen, or the one a figure names; in its
  // own colours, or in one ink for print.
  const specToDraw = (options?: ChartExportOptions): ChartSpec => {
    const base = options?.chartId ? specForChart(liveSheetRef.current, options.chartId) : liveSpecRef.current
    if (options?.palette !== 'monochrome') return base
    return { ...base, chart: { ...base.chart, style: { ...base.chart.style, palette: 'mono' } } }
  }

  // Where the file goes: a fresh path from the title, or the file a figure
  // already is when it is being redrawn in place.
  const outputFor = (base: string, title: string, ext: 'svg' | 'png', options?: ChartExportOptions) => {
    if (!options?.relativePath) return assetExportPathForChart(base, title, ext)
    const collectionPath = base.replace(/\/+$/, '')
    return { collectionPath, relativePath: options.relativePath, absolutePath: `${collectionPath}/${options.relativePath}` }
  }

  // Tell the library where the figure came from, and remember the figure
  // here so it can be redrawn when the chart changes.
  const registerFigure = async (
    output: { collectionPath: string; relativePath: string; absolutePath: string },
    base: string,
    title: string,
    format: 'svg' | 'png',
    drawn: { width: number; height: number },
    options?: ChartExportOptions,
  ) => {
    const chartPath = documentPathRef.current
    const sheet = liveSheetRef.current
    const chartId = options?.chartId ?? sheet.focusedId ?? sheet.charts[0]?.id ?? null
    const figure: FigureRecord | null = chartPath
      ? {
          collectionPath: output.collectionPath,
          relativePath: output.relativePath,
          chartId,
          format,
          width: drawn.width,
          height: drawn.height,
          scale: options?.scale ?? 1,
          transparent: options?.transparent ?? false,
          palette: options?.palette ?? 'source',
          fingerprint: figureFingerprint(serializeSheet(sheet), chartId),
          exportedAt: new Date().toISOString(),
        }
      : null
    await updateAssetMetadata({
      collectionPath: output.collectionPath,
      relativePath: output.relativePath,
      label: title,
      caption: title,
      description: figure ? figureDescription(figure) : 'PureChart export linked to its source chart document.',
      sourceDocumentPath: chartPath ? figureSourcePath(output.collectionPath, chartPath) : relativeChartDocumentPath(base),
      sourceAppSlug: CHART_APP_SLUG,
    })
    if (figure && chartPath && isChartPackagePath(chartPath)) {
      const next = recordFigure(figuresRef.current, figure)
      await writeTextFile(`${chartPath}/${FIGURES_FILE}`, serializeFigures(next))
      figuresRef.current = next
      setFigures(next)
    }
  }

  const exportSvg = useCallback(
    async (
      svg: SVGSVGElement | null,
      options?: ChartExportOptions,
    ): Promise<ChartExportResult | null> => {
      setError(null)
      const snapshot = specToDraw(options)
      const sourcePath = documentPathRef.current
      const sourceTable = liveTableRef.current
      // Use the export preview renderer so captions and layout travel together.
      const drawn = renderChartSvg(sourceTable, snapshot, {
        width: options?.width, height: options?.height,
        background: options?.transparent ? null : undefined,
      })
      if (drawn.message) { setError(drawn.message); return null }
      const svgString = drawn.svg
      const snippet = buildEmbedSnippet(svgString)
      // A redraw in place is not something anyone asked to paste.
      if (!options?.relativePath) {
        try {
          await navigator.clipboard?.writeText(snippet)
        } catch {
          // clipboard may be blocked in the iframe — non-fatal
        }
      }
      const base =
        options?.destination ??
        options?.basePath ??
        sourcePath ??
        snapshot.data.source?.path ??
        null
      if (!base) {
        const fileName = `${safeFileStem(snapshot.title)}.svg`
        downloadBlob(
          fileName,
          new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }),
        )
        setStatus(`Downloaded ${fileName} + copied embed`)
        return { kind: 'download', fileName }
      }
      const output = outputFor(base, snapshot.title, 'svg', options)
      try {
        await writeBinaryFile(output.absolutePath, toUtf8Bytes(svgString))
        await registerFigure(output, base, snapshot.title, 'svg', drawn, options)
        setStatus(
          options?.relativePath
            ? `Redrew ${fileNameFromPath(output.absolutePath)}`
            : `Exported ${fileNameFromPath(output.absolutePath)} + copied embed`,
        )
        return { kind: 'file', path: output.absolutePath }
      } catch (exportError) {
        setError(
          exportError instanceof Error
            ? exportError.message
            : String(exportError),
        )
        return null
      }
    },
    [],
  )

  const exportPng = useCallback(
    async (
      svg: SVGSVGElement | null,
      options?: ChartExportOptions,
    ): Promise<ChartExportResult | null> => {
      setError(null)
      const snapshot = specToDraw(options)
      const sourcePath = documentPathRef.current
      const sourceTable = liveTableRef.current
      const base =
        options?.destination ??
        options?.basePath ??
        sourcePath ??
        snapshot.data.source?.path ??
        null
      try {
        const drawn = renderChartSvg(sourceTable, snapshot, {
          width: options?.width, height: options?.height,
          background: options?.transparent ? null : undefined,
        })
        if (drawn.message) { setError(drawn.message); return null }
        const svgString = drawn.svg
        const { width, height } = drawn
        const pngBytes = await svgToPngBytes(svgString, width, height, {
          scale: options?.scale,
          background: options?.transparent ? null : undefined,
        })
        if (!base) {
          const fileName = `${safeFileStem(snapshot.title)}.png`
          downloadBlob(
            fileName,
            new Blob([toArrayBuffer(pngBytes)], { type: 'image/png' }),
          )
          setStatus(`Downloaded ${fileName}`)
          return { kind: 'download', fileName }
        }
        const output = outputFor(base, snapshot.title, 'png', options)
        await writeBinaryFile(output.absolutePath, pngBytes)
        await registerFigure(output, base, snapshot.title, 'png', drawn, options)
        setStatus(options?.relativePath ? `Redrew ${fileNameFromPath(output.absolutePath)}` : `Exported ${fileNameFromPath(output.absolutePath)}`)
        return { kind: 'file', path: output.absolutePath }
      } catch (exportError) {
        setError(
          exportError instanceof Error
            ? exportError.message
            : String(exportError),
        )
        return null
      }
    },
    [],
  )

  // The figures travel with the package: read when it opens, gone when it closes.
  useEffect(() => {
    let cancelled = false
    if (!documentPath || !isChartPackagePath(documentPath)) {
      figuresRef.current = []
      setFigures([])
      return
    }
    void (async () => {
      let next: FigureRecord[] = []
      try {
        // A package without the file has simply never been exported.
        next = parseFigures(await readTextFile(`${documentPath}/${FIGURES_FILE}`))
      } catch {
        next = []
      }
      if (cancelled) return
      figuresRef.current = next
      setFigures(next)
    })()
    return () => {
      cancelled = true
    }
  }, [documentPath])

  // Measured against the sheet as it will be written, per chart, so that a
  // change to one chart leaves the figures of another current.
  const staleFigures = useMemo(() => {
    if (!figures.length) return []
    const text = serializeSheet(sheet)
    return findStaleFigures(figures, chartId => figureFingerprint(text, chartId))
  }, [figures, sheet])

  const rerenderFigures = useCallback(
    async (which?: readonly FigureRecord[]): Promise<number> => {
      const list = which ?? staleFigures
      let redrawn = 0
      for (const figure of list) {
        const options: ChartExportOptions = {
          destination: figure.collectionPath,
          relativePath: figure.relativePath,
          chartId: figure.chartId,
          width: figure.width,
          height: figure.height,
          scale: figure.scale,
          transparent: figure.transparent,
          palette: figure.palette,
        }
        const result = figure.format === 'png' ? await exportPng(null, options) : await exportSvg(null, options)
        if (result?.kind === 'file') redrawn += 1
      }
      if (list.length) setStatus(redrawn === list.length ? `Redrew ${redrawn} ${redrawn === 1 ? 'figure' : 'figures'} in place` : `Redrew ${redrawn} of ${list.length} figures; the rest reported errors`)
      return redrawn
    },
    [exportPng, exportSvg, staleFigures],
  )

  const forgetFigure = useCallback(async (figure: FigureRecord) => {
    const chartPath = documentPathRef.current
    const next = forgetFigureRecord(figuresRef.current, figure)
    figuresRef.current = next
    setFigures(next)
    if (chartPath && isChartPackagePath(chartPath)) await writeTextFile(`${chartPath}/${FIGURES_FILE}`, serializeFigures(next))
  }, [])

  return {
    createDocument,
    reportSaveFailure: failure => setStatus(`Could not save the outgoing chart: ${failure instanceof Error ? failure.message : String(failure)}. Current chart kept.`),
    acknowledgeSave: () => setStatus(current => current.startsWith('Could not save the outgoing chart:') ? 'Saved pending changes' : current),
    proposal, proposeChart, applyProposal, discardProposal,
    isLoadedSheet: candidate => candidate === loadedSheetRef.current,
    liveSheet: () => liveSheetRef.current,
    liveDocumentPath: () => documentPathRef.current,
    setTransform: transform => updateSpec(current => ({ ...current, chart: { ...current.chart, transform, axes: { ...current.chart.axes, y: { ...current.chart.axes.y, format: transform.aggregate === 'percent' ? 'percent' : current.chart.axes.y.format } } } })),
    editData,
    canUndo: history.current.canUndo,
    canRedo: history.current.canRedo,
    undo, redo, resetHistory,
    spec,
    table,
    documentPath,
    status,
    error,
    sheet,
    applySheet,
    focusChart,
    addChart,
    duplicateChart,
    removeChart,
    moveChart,
    setTitle,
    setChartName,
    setCaption,
    setFacet,
    setAxis,
    setPastedText,
    setType,
    setX,
    setY,
    addY,
    removeY,
    setSeries,
    toggleStyle,
    setStyle,
    setPalette,
    addCustomPalette,
    addAnnotation,
    clearAnnotations,
    applyChartSpec,
    liveSpec,
    liveTable,
    openChartPath,
    saveChartAs,
    deleteChartDocument,
    bindDocumentPath,
    loadDataFile,
    exportSvg,
    exportPng,
    figures,
    staleFigures,
    rerenderFigures,
    forgetFigure,
  }
}
