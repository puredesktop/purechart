import {
  chartFingerprint,
  livePathFor,
  withLiveSource,
} from '@purescience/platform-ui/components/assets/asset-library/model/live'

/**
 * The figures a chart has been drawn into, kept in `figures.json` inside the
 * `.chart` package.
 *
 * A figure placed in a book or a report is a copy of this chart at a moment.
 * The record says where it went and how it was drawn, so that when the data
 * moves the chart can redraw every figure in place — same file, same size,
 * same palette — instead of leaving a stale picture in somebody's chapter.
 * The library sees the same fact from its side through the tags the export
 * writes on the asset (`source:chart`, `fingerprint:`, `view:`, `render:`).
 */

export const FIGURES_FILE = 'figures.json'

export type FigurePalette = 'source' | 'monochrome'
export type FigureFormat = 'svg' | 'png'

export interface FigureRecord {
  /** The collection the figure lives in — a document package, or this chart's own. */
  collectionPath: string
  /** Under the collection: `assets/figures/<name>.<ext>`. */
  relativePath: string
  /** The chart on the sheet it was drawn from. */
  chartId: string | null
  format: FigureFormat
  width: number
  height: number
  scale: number
  transparent: boolean
  palette: FigurePalette
  /** What the chart looked like when it was drawn. */
  fingerprint: string
  exportedAt: string
}

const PALETTES: readonly FigurePalette[] = ['source', 'monochrome']

/** The records in the file, keeping only what reads as a figure. */
export function parseFigures(text: string | null | undefined): FigureRecord[] {
  if (!text) return []
  try {
    const parsed: unknown = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : (parsed as { figures?: unknown })?.figures
    if (!Array.isArray(list)) return []
    return list.flatMap(item => {
      if (typeof item !== 'object' || item === null) return []
      const entry = item as Record<string, unknown>
      if (typeof entry.collectionPath !== 'string' || typeof entry.relativePath !== 'string') return []
      if (typeof entry.fingerprint !== 'string' || (entry.format !== 'svg' && entry.format !== 'png')) return []
      const number = (key: string, fallback: number) =>
        typeof entry[key] === 'number' && Number.isFinite(entry[key]) && (entry[key] as number) > 0 ? (entry[key] as number) : fallback
      return [
        {
          collectionPath: entry.collectionPath,
          relativePath: entry.relativePath,
          chartId: typeof entry.chartId === 'string' ? entry.chartId : null,
          format: entry.format,
          width: number('width', 900),
          height: number('height', 540),
          scale: number('scale', 1),
          transparent: entry.transparent === true,
          palette: PALETTES.includes(entry.palette as FigurePalette) ? (entry.palette as FigurePalette) : 'source',
          fingerprint: entry.fingerprint,
          exportedAt: typeof entry.exportedAt === 'string' ? entry.exportedAt : '',
        },
      ]
    })
  } catch {
    return []
  }
}

export function serializeFigures(figures: readonly FigureRecord[]): string {
  return `${JSON.stringify({ figures }, null, 2)}\n`
}

/** The same figure again replaces its record; a figure is where it is, not when. */
export function recordFigure(figures: readonly FigureRecord[], figure: FigureRecord): FigureRecord[] {
  const same = (entry: FigureRecord) => entry.collectionPath === figure.collectionPath && entry.relativePath === figure.relativePath
  return [...figures.filter(entry => !same(entry)), figure]
}

export function forgetFigure(figures: readonly FigureRecord[], figure: Pick<FigureRecord, 'collectionPath' | 'relativePath'>): FigureRecord[] {
  return figures.filter(entry => !(entry.collectionPath === figure.collectionPath && entry.relativePath === figure.relativePath))
}

/**
 * The fingerprint of a chart as it will be read back from disk.
 *
 * Taken from the serialized sheet, not the live one, so that the library —
 * which only ever sees the file — computes the same value. Per chart when the
 * sheet has several.
 */
export function figureFingerprint(serializedSheet: string, chartId: string | null): string {
  return chartFingerprint(JSON.parse(serializedSheet), chartId)
}

/** The figures drawn before the chart last changed. */
export function staleFigures(figures: readonly FigureRecord[], fingerprintFor: (chartId: string | null) => string): FigureRecord[] {
  return figures.filter(figure => figure.fingerprint !== fingerprintFor(figure.chartId))
}

/** The line that says what happened, without alarm and without understatement. */
export function sayStale(count: number): string {
  if (count === 0) return 'Every figure drawn from this chart is current.'
  if (count === 1) return 'One figure was drawn before this chart last changed.'
  return `${count} figures were drawn before this chart last changed.`
}

/**
 * The asset's description: the library reads the chart, the fingerprint,
 * which chart on the sheet, and how it was drawn, from these tags.
 */
export function figureDescription(figure: Pick<FigureRecord, 'chartId' | 'fingerprint' | 'width' | 'height' | 'palette' | 'format'>): string {
  return withLiveSource('PureChart export linked to its source chart document.', {
    kind: 'chart',
    fingerprint: figure.fingerprint,
    view: figure.chartId,
    render: { width: figure.width, height: figure.height, palette: figure.palette, format: figure.format },
  })
}

/** What the asset records as its source: relative when the chart is inside the collection. */
export function figureSourcePath(collectionPath: string, chartDocumentPath: string): string {
  return livePathFor(collectionPath, chartDocumentPath)
}
