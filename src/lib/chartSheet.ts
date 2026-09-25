import {
  CHART_PACKAGE_CONTENT_FILE,
  CHART_PACKAGE_SUFFIX,
} from '../constants'
import {
  CHART_SCHEMA_VERSION,
  defaultSpec,
  migrateSpec,
  type ChartData,
  type ChartSpec,
} from './chartSpec'
import type { ChartPalette } from './chartTheme'

/**
 * A document is a sheet of charts, not a chart.
 *
 * One chart per document is what made the rail grow: every decision had to be
 * reachable at once, and every experiment destroyed the last one. A table is
 * worth three or four readings, so the document holds them all and two things
 * belong to the sheet rather than to any chart on it —
 *
 * **the data**, because one table feeds every reading of it, and it should be
 * read once, be live once, and change everything at the same moment; and
 *
 * **the palette**, because one sheet is one argument. A colour that means
 * Aotearoa in the first chart and Australia in the second is a lie the reader
 * has to catch.
 *
 * Everything else — form, encodings, axes, panels, notes, caption — is a
 * property of a single chart, and each chart is still an ordinary `ChartSpec`
 * so that every tool, handler and component that knew how to read one still
 * does.
 */

export const SHEET_SCHEMA_VERSION = 2

export interface SheetChart {
  id: string
  spec: ChartSpec
}

export interface ChartSheet {
  schemaVersion: typeof SHEET_SCHEMA_VERSION
  title: string
  /** The one table every chart on the sheet reads. */
  data: ChartData
  palette: { id: string; custom: ChartPalette[] }
  charts: SheetChart[]
  /** null means the sheet itself is on screen, not one of its charts. */
  focusedId: string | null
}

let counter = 0

export function chartId(): string {
  counter += 1
  return `c${Date.now().toString(36)}${counter.toString(36)}`
}

/** A sheet holding one chart — what every existing document becomes. */
export function sheetFromSpec(spec: ChartSpec): ChartSheet {
  return {
    schemaVersion: SHEET_SCHEMA_VERSION,
    title: spec.title,
    data: spec.data,
    palette: {
      id: spec.chart.style.palette,
      custom: [...spec.chart.style.customPalettes],
    },
    charts: [{ id: chartId(), spec }],
    focusedId: null,
  }
}

export function emptySheet(title = 'Untitled chart'): ChartSheet {
  return sheetFromSpec(defaultSpec(title))
}

/**
 * One chart of the sheet, as a whole ChartSpec.
 *
 * The sheet's data and palette are folded in, so anything downstream — the
 * renderer, the review, the agent handlers — reads a complete, ordinary spec
 * and never has to know it came from a sheet.
 */
export function specForChart(sheet: ChartSheet, id: string | null): ChartSpec {
  const chart =
    sheet.charts.find(entry => entry.id === id) ?? sheet.charts[0] ?? null
  const base = chart?.spec ?? defaultSpec(sheet.title)
  return {
    ...base,
    data: sheet.data,
    chart: {
      ...base.chart,
      style: {
        ...base.chart.style,
        palette: sheet.palette.id,
        customPalettes: sheet.palette.custom,
      },
    },
  }
}

/** The chart the person is working on, or the first one. */
export function focusedChartId(sheet: ChartSheet): string | null {
  if (sheet.focusedId && sheet.charts.some(c => c.id === sheet.focusedId)) {
    return sheet.focusedId
  }
  return sheet.charts[0]?.id ?? null
}

/**
 * Write a chart back, splitting the shared parts off again.
 *
 * Changing the data or the palette through one chart changes them for the
 * sheet — which is the point: they are shared, and pretending otherwise would
 * let two charts disagree about what a colour means.
 */
export function withChart(
  sheet: ChartSheet,
  id: string | null,
  spec: ChartSpec,
): ChartSheet {
  const target = id ?? focusedChartId(sheet)
  return {
    ...sheet,
    // The document's name is the sheet's, not the focused chart's: renaming a
    // chart on a sheet of four must not rename the file.
    data: spec.data,
    palette: {
      id: spec.chart.style.palette,
      custom: spec.chart.style.customPalettes,
    },
    charts: sheet.charts.map(entry =>
      entry.id === target ? { ...entry, spec } : entry,
    ),
  }
}

/** Rename the document itself. */
export function renameSheet(sheet: ChartSheet, title: string): ChartSheet {
  return { ...sheet, title }
}

/** Add a chart and focus it. Nothing already on the sheet is touched. */
export function addChart(sheet: ChartSheet, spec: ChartSpec): ChartSheet {
  const id = chartId()
  return {
    ...sheet,
    charts: [...sheet.charts, { id, spec }],
    focusedId: id,
  }
}

export function duplicateChart(sheet: ChartSheet, id: string): ChartSheet {
  const source = sheet.charts.find(entry => entry.id === id)
  if (!source) return sheet
  const copy = chartId()
  const index = sheet.charts.findIndex(entry => entry.id === id)
  const charts = [...sheet.charts]
  charts.splice(index + 1, 0, { id: copy, spec: { ...source.spec } })
  return { ...sheet, charts, focusedId: copy }
}

/** A sheet always holds at least one chart; removing the last leaves a blank. */
export function removeChart(sheet: ChartSheet, id: string): ChartSheet {
  const charts = sheet.charts.filter(entry => entry.id !== id)
  if (charts.length === 0) {
    return { ...sheet, charts: [{ id: chartId(), spec: defaultSpec(sheet.title) }], focusedId: null }
  }
  return {
    ...sheet,
    charts,
    focusedId: sheet.focusedId === id ? null : sheet.focusedId,
  }
}

export function moveChart(sheet: ChartSheet, id: string, to: number): ChartSheet {
  const from = sheet.charts.findIndex(entry => entry.id === id)
  if (from === -1) return sheet
  const charts = [...sheet.charts]
  const [moved] = charts.splice(from, 1)
  charts.splice(Math.max(0, Math.min(charts.length, to)), 0, moved!)
  return { ...sheet, charts }
}

/**
 * Read a document, whatever version wrote it.
 *
 * A v1 file is one chart; it opens as a sheet of one and looks no different
 * until a second chart is added, so nothing needs migrating on disk.
 */
export function migrateSheet(raw: unknown): ChartSheet {
  const value = (raw ?? {}) as Record<string, unknown>
  if (!Array.isArray(value.charts)) return sheetFromSpec(migrateSpec(raw))

  const charts = value.charts
    .map((entry): SheetChart | null => {
      const item = (entry ?? {}) as Record<string, unknown>
      const spec = migrateSpec(item.spec ?? item)
      return { id: typeof item.id === 'string' ? item.id : chartId(), spec }
    })
    .filter((entry): entry is SheetChart => entry !== null)

  if (charts.length === 0) return sheetFromSpec(migrateSpec(raw))

  const first = charts[0]!.spec
  const palette = (value.palette ?? {}) as Record<string, unknown>
  return {
    schemaVersion: SHEET_SCHEMA_VERSION,
    title: typeof value.title === 'string' ? value.title : first.title,
    data: (value.data as ChartData | undefined) ?? first.data,
    palette: {
      id:
        typeof palette.id === 'string'
          ? palette.id
          : first.chart.style.palette,
      custom: Array.isArray(palette.custom)
        ? (palette.custom as ChartPalette[])
        : first.chart.style.customPalettes,
    },
    charts,
    focusedId: typeof value.focusedId === 'string' ? value.focusedId : null,
  }
}

export function serializeSheet(sheet: ChartSheet): string {
  return `${JSON.stringify(
    {
      schemaVersion: SHEET_SCHEMA_VERSION,
      // A reader that only knows v1 finds the first chart where it expects a
      // chart, and the shared data where it expects data.
      chartSchemaVersion: CHART_SCHEMA_VERSION,
      title: sheet.title,
      data: sheet.data,
      palette: sheet.palette,
      chart: sheet.charts[0]?.spec.chart,
      charts: sheet.charts.map(entry => ({
        id: entry.id,
        spec: { ...entry.spec, data: { mode: 'inline', inline: { format: 'csv', text: '' } } },
      })),
    },
    null,
    2,
  )}\n`
}

export interface SheetPackageFile {
  name: string
  content: string
}

/** The files a `.chart` package holds: its manifest, and the sheet. */
export function sheetPackageFiles(
  sheet: ChartSheet,
  savedAt: string = new Date().toISOString(),
): SheetPackageFile[] {
  return [
    {
      name: 'manifest.json',
      content: `${JSON.stringify(
        {
          schemaVersion: SHEET_SCHEMA_VERSION,
          kind: 'purescience.chart.document',
          packageSuffix: CHART_PACKAGE_SUFFIX,
          title: sheet.title || 'Untitled chart',
          charts: sheet.charts.length,
          savedAt,
        },
        null,
        2,
      )}\n`,
    },
    { name: CHART_PACKAGE_CONTENT_FILE, content: serializeSheet(sheet) },
  ]
}
