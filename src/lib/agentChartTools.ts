import { isChartDocumentPath, isChartPackagePath } from './chartPaths'
import type { DataFormat, DataTable } from './dataParse'
import { EMPTY_TABLE, parseData } from './dataParse'
import {
  CHART_TYPES,
  defaultSpec,
  migrateSpec,
  suggestEncodings,
} from './chartSpec'
import type {
  ChartAnnotation,
  ChartSpec,
  ChartStyle,
  ChartType,
} from './chartSpec'
import { isChartPaletteId, type ChartPalette } from './chartTheme'

export class AgentChartToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentChartToolError'
  }
}

export interface ChartAgentContextSnapshot {
  documentPath: string | null
  status: string
  title: string
  type: ChartType
  encodings: ChartSpec['chart']['encodings']
  style: ChartStyle
  annotationCount: number
  data: ChartAgentDataSummary
}

export interface ChartAgentDataSummary {
  mode: ChartSpec['data']['mode']
  sourcePath: string | null
  format: DataFormat | null
  rowCount: number
  columnCount: number
  columns: DataTable['columns']
}

export interface ChartAgentDataSnapshot extends ChartAgentDataSummary {
  rows: Array<Record<string, unknown>>
  truncated: boolean
}

export interface ChartAgentCreateInput {
  title?: string
  dataText?: string
  format?: DataFormat
  type?: ChartType
}

/**
 * A partial edit. Every field is optional and `undefined` means "leave as
 * is" — a tool call that sets only `type` must never touch the encodings.
 * `x` / `series` accept `null` to clear the encoding; `y` accepts `[]`.
 */
export interface ChartAgentUpdateInput {
  title?: string
  type?: ChartType
  x?: string | null
  y?: string[]
  series?: string | null
  style?: Partial<ChartStyle>
}

export interface ChartAgentPaletteInput {
  palette?: string
  label?: string
  colors?: string[]
}

export interface ChartAgentReplaceDataInput {
  dataText: string
  format?: DataFormat
  resetChart?: boolean
}

const DEFAULT_ROW_LIMIT = 50
const MAX_ROW_LIMIT = 500

function detectInlineFormat(text: string): DataFormat {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  const firstLine = trimmed.split(/\r?\n/).find(line => line.trim()) ?? ''
  return firstLine.includes('\t') ? 'tsv' : 'csv'
}

function normalizeFormat(value: unknown, fallback: DataFormat): DataFormat {
  if (value === 'csv' || value === 'tsv' || value === 'json') return value
  return fallback
}

function normalizeChartType(value: unknown, fallback: ChartType): ChartType {
  if (CHART_TYPES.includes(value as ChartType)) return value as ChartType
  if (value === undefined || value === null) return fallback
  throw new AgentChartToolError(
    `type must be one of: ${CHART_TYPES.join(', ')}`,
  )
}

function ensureColumn(table: DataTable, value: string | null, label: string) {
  if (value === null) return
  if (!table.columns.some(column => column.name === value)) {
    throw new AgentChartToolError(`${label} column "${value}" was not found.`)
  }
}

function sanitizeStylePatch(
  current: ChartStyle,
  patch: Partial<ChartStyle> | undefined,
): Partial<ChartStyle> {
  if (!patch) return {}
  const next: Partial<ChartStyle> = {}
  if (typeof patch.rangeFrame === 'boolean') next.rangeFrame = patch.rangeFrame
  if (typeof patch.grid === 'boolean') next.grid = patch.grid
  if (typeof patch.directLabels === 'boolean')
    next.directLabels = patch.directLabels
  if (typeof patch.rug === 'boolean') next.rug = patch.rug
  if (typeof patch.strokeWidth === 'number' && patch.strokeWidth > 0) {
    next.strokeWidth = patch.strokeWidth
  }
  if (typeof patch.pointRadius === 'number' && patch.pointRadius >= 0) {
    next.pointRadius = patch.pointRadius
  }
  if (
    typeof patch.palette === 'string' &&
    (isChartPaletteId(patch.palette) ||
      current.customPalettes.some(palette => palette.id === patch.palette))
  ) {
    next.palette = patch.palette
  }
  if (Array.isArray(patch.customPalettes)) {
    next.customPalettes = patch.customPalettes
  }
  return next
}

function safePaletteId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `agent-${slug || 'palette'}`
}

function sanitizeAgentPalette(input: ChartAgentPaletteInput): ChartPalette {
  const label = input.label?.trim() || 'Agent palette'
  const colors = Array.isArray(input.colors)
    ? input.colors
        .map(color => color.trim())
        .filter(color => /^#[0-9a-f]{6}$/i.test(color))
    : []
  if (colors.length === 0) {
    throw new AgentChartToolError(
      'colors must include at least one #RRGGBB color.',
    )
  }
  return {
    id: input.palette?.trim() || safePaletteId(label),
    label,
    colors,
    custom: true,
  }
}

function serializeCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  return value
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializeCell(value)]),
  )
}

export function getChartAgentDataSummary(
  spec: ChartSpec,
  table: DataTable,
): ChartAgentDataSummary {
  return {
    mode: spec.data.mode,
    sourcePath: spec.data.source?.path ?? null,
    format: spec.data.source?.format ?? spec.data.inline?.format ?? null,
    rowCount: table.rows.length,
    columnCount: table.columns.length,
    columns: table.columns,
  }
}

export function getChartAgentContext(input: {
  spec: ChartSpec
  table: DataTable
  documentPath: string | null
  status: string
}): ChartAgentContextSnapshot {
  return {
    documentPath: input.documentPath,
    status: input.status,
    title: input.spec.title,
    type: input.spec.chart.type,
    encodings: input.spec.chart.encodings,
    style: input.spec.chart.style,
    annotationCount: input.spec.chart.annotations.length,
    data: getChartAgentDataSummary(input.spec, input.table),
  }
}

export function getChartAgentData(
  spec: ChartSpec,
  table: DataTable,
  limit = DEFAULT_ROW_LIMIT,
): ChartAgentDataSnapshot {
  const safeLimit = Math.max(0, Math.min(MAX_ROW_LIMIT, Math.floor(limit)))
  return {
    ...getChartAgentDataSummary(spec, table),
    rows: table.rows.slice(0, safeLimit).map(serializeRow),
    truncated: table.rows.length > safeLimit,
  }
}

export function createChartAgentSpec(input: ChartAgentCreateInput): {
  spec: ChartSpec
  table: DataTable
} {
  const title = input.title?.trim() || 'Untitled chart'
  const spec = defaultSpec(title)
  spec.chart.type = normalizeChartType(input.type, spec.chart.type)

  if (!input.dataText) return { spec, table: EMPTY_TABLE }

  const format = normalizeFormat(
    input.format,
    detectInlineFormat(input.dataText),
  )
  const table = parseData(input.dataText, format)
  spec.data = { mode: 'inline', inline: { format, text: input.dataText } }
  spec.chart.encodings = suggestEncodings(table)
  return { spec, table }
}

export function replaceChartDataAgentSpec(
  current: ChartSpec,
  input: ChartAgentReplaceDataInput,
): { spec: ChartSpec; table: DataTable } {
  if (typeof input.dataText !== 'string') {
    throw new AgentChartToolError('dataText is required.')
  }
  const format = normalizeFormat(
    input.format,
    detectInlineFormat(input.dataText),
  )
  const table = parseData(input.dataText, format)
  const spec: ChartSpec = {
    ...current,
    data: { mode: 'inline', inline: { format, text: input.dataText } },
  }
  if (input.resetChart || !current.chart.encodings.x) {
    spec.chart = {
      ...current.chart,
      encodings: suggestEncodings(table),
    }
  }
  return { spec: migrateSpec(spec), table }
}

export function updateChartAgentSpec(
  current: ChartSpec,
  table: DataTable,
  input: ChartAgentUpdateInput,
): ChartSpec {
  const next: ChartSpec = {
    ...current,
    title: input.title?.trim() || current.title,
    chart: {
      ...current.chart,
      type: normalizeChartType(input.type, current.chart.type),
      encodings: { ...current.chart.encodings },
      style: {
        ...current.chart.style,
        ...sanitizeStylePatch(current.chart.style, input.style),
      },
    },
  }

  // `in` checks would be wrong here: handlers build this object with every
  // key present, so only a defined value is an instruction to change.
  if (input.x !== undefined) {
    ensureColumn(table, input.x, 'x')
    next.chart.encodings.x = input.x
  }
  if (input.y !== undefined) {
    const y = Array.isArray(input.y) ? input.y : []
    for (const column of y) ensureColumn(table, column, 'y')
    next.chart.encodings.y = y
  }
  if (input.series !== undefined) {
    ensureColumn(table, input.series, 'series')
    next.chart.encodings.series = input.series
  }

  return migrateSpec(next)
}

export function setChartPaletteAgentSpec(
  current: ChartSpec,
  input: ChartAgentPaletteInput,
): ChartSpec {
  const palette = input.palette?.trim()
  if (palette && isChartPaletteId(palette)) {
    return updateChartAgentSpec(current, EMPTY_TABLE, {
      style: { palette },
    })
  }

  const existingCustom = palette
    ? current.chart.style.customPalettes.find(item => item.id === palette)
    : null
  if (existingCustom) {
    return updateChartAgentSpec(current, EMPTY_TABLE, {
      style: { palette: existingCustom.id },
    })
  }

  const customPalette = sanitizeAgentPalette(input)
  return migrateSpec({
    ...current,
    chart: {
      ...current.chart,
      style: {
        ...current.chart.style,
        palette: customPalette.id,
        customPalettes: [
          ...current.chart.style.customPalettes.filter(
            item => item.id !== customPalette.id,
          ),
          customPalette,
        ],
      },
    },
  })
}

export function addChartAgentAnnotationSpec(
  current: ChartSpec,
  annotation: ChartAnnotation,
): ChartSpec {
  const next = migrateSpec({
    ...current,
    chart: {
      ...current.chart,
      annotations: [...current.chart.annotations, annotation],
    },
  })
  if (next.chart.annotations.length !== current.chart.annotations.length + 1) {
    throw new AgentChartToolError('annotation target is invalid.')
  }
  return next
}

export function clearChartAgentAnnotationsSpec(current: ChartSpec): ChartSpec {
  return {
    ...current,
    chart: {
      ...current.chart,
      annotations: [],
    },
  }
}

/**
 * A chart document path the agent may save to or delete: a `.chart`
 * package folder (the format new charts are created in) or a legacy
 * `.chart.json` file. Trailing slashes are dropped so the same package is
 * never bound twice under two spellings.
 */
export function chartDocumentPathFromInput(path: string | null): string {
  if (!path) throw new AgentChartToolError('path is required.')
  const clean = path.trim().replace(/\/+$/, '')
  if (!isChartPackagePath(clean) && !isChartDocumentPath(clean)) {
    throw new AgentChartToolError(
      'path must end with .chart (a chart package) or .chart.json (a legacy chart file).',
    )
  }
  return clean
}

/**
 * The spec as the agent should read it: everything except the raw inline
 * data text, which can be megabytes and is what getChartData exists for.
 */
export function chartAgentSpecView(
  spec: ChartSpec,
  table: DataTable,
): Omit<ChartSpec, 'data'> & {
  data: Omit<ChartSpec['data'], 'inline'> & {
    inline?: { format: DataFormat; characters: number; elided: true }
  }
  dataSummary: ChartAgentDataSummary
} {
  const { data, ...rest } = spec
  const { inline, ...dataRest } = data
  return {
    ...rest,
    data: {
      ...dataRest,
      ...(inline
        ? {
            inline: {
              format: inline.format,
              characters: inline.text.length,
              elided: true,
            },
          }
        : {}),
    },
    dataSummary: getChartAgentDataSummary(spec, table),
  }
}
