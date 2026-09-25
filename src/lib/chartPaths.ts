import {
  CHART_FILE_SUFFIX,
  CHART_PACKAGE_CONTENT_FILE,
  CHART_PACKAGE_SUFFIX,
} from '../constants'

export type DataFormat = 'csv' | 'tsv' | 'json'

/** A `.chart.json` legacy chart document (our owned format) vs a raw data file. */
export function isChartDocumentPath(path: string): boolean {
  return path.trim().toLowerCase().endsWith(CHART_FILE_SUFFIX)
}

/** A `.chart` package folder — the format created for new charts. */
export function isChartPackagePath(path: string): boolean {
  return path.trim().replace(/\/+$/, '').toLowerCase().endsWith(CHART_PACKAGE_SUFFIX)
}

/** The spec file path inside a `.chart` package. */
export function chartPackageContentPath(packagePath: string): string {
  return `${packagePath.replace(/\/+$/, '')}/${CHART_PACKAGE_CONTENT_FILE}`
}

/** Detect the data format of a linked file from its extension. */
export function dataFormatFromPath(path: string): DataFormat | null {
  const lower = path.trim().toLowerCase()
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.tsv')) return 'tsv'
  if (lower.endsWith('.json')) return 'json'
  return null
}

/** Human title for a chart or data file (drops the multi-part extension). */
export function chartTitleFromPath(path: string): string {
  const base = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
  return base
    .replace(/\.chart\.json$/i, '')
    .replace(/\.chart$/i, '')
    .replace(/\.(csv|tsv|json)$/i, '')
    .trim()
}

function dirname(path: string): string {
  const clean = path.replace(/\\/g, '/')
  const index = clean.lastIndexOf('/')
  return index > 0 ? clean.slice(0, index) : '.'
}

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
}

function safeAssetStem(title: string): string {
  const stem = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || 'untitled-chart'
}

export interface ChartAssetExportPath {
  collectionPath: string
  relativePath: string
  absolutePath: string
}

/**
 * Output path for a chart export intended for cross-app reuse.
 * The asset library indexes files under `assets/`, so manuscript-ready chart
 * exports live in `assets/figures` beside the chart document.
 */
export function assetExportPathForChart(
  chartPath: string,
  title: string,
  extension: string,
): ChartAssetExportPath {
  const ext = extension.replace(/^\./, '').toLowerCase()
  // Packages own their assets dir; a legacy flat file exports beside itself.
  const collectionPath = isChartPackagePath(chartPath)
    ? chartPath.replace(/\/+$/, '')
    : dirname(chartPath)
  const fileName = `${safeAssetStem(
    title || chartTitleFromPath(chartPath),
  )}.${ext}`
  const relativePath = `assets/figures/${fileName}`
  return {
    collectionPath,
    relativePath,
    absolutePath: `${collectionPath}/${relativePath}`,
  }
}

export function relativeChartDocumentPath(chartPath: string): string {
  return basename(chartPath)
}
