import { CHART_FONT_FAMILY } from './chartTheme'
import type { DataTable } from './dataParse'

/**
 * Marks SVG nodes that belong to the live exploration state — hover
 * tooltip, pinned points, brush, zoom readout, the pointer-capture rect —
 * and must never ship inside an export. Saved annotations live in the
 * spec and are NOT transient.
 */
export const CHART_TRANSIENT_ATTR = 'data-purechart-transient'

/**
 * Serialize a rendered chart `<svg>` into a standalone, self-contained string:
 * declares the SVG namespace and inlines the chart font so it renders anywhere
 * (file, email, another app) without the host stylesheet. This is the canonical
 * exportable + embeddable artifact.
 */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  for (const node of Array.from(clone.querySelectorAll(`[${CHART_TRANSIENT_ATTR}]`))) {
    node.remove()
  }

  const style = clone.ownerDocument.createElementNS(
    'http://www.w3.org/2000/svg',
    'style',
  )
  style.textContent = `text { font-family: ${CHART_FONT_FAMILY}; }`
  clone.insertBefore(style, clone.firstChild)

  const xml = new XMLSerializer().serializeToString(clone)
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}\n`
}

/** Wrap a serialized SVG as a copy-pasteable `<figure>` embed snippet. */
export function buildEmbedSnippet(svgString: string): string {
  const body = svgString.replace(/^<\?xml[^>]*\?>\s*/, '').trim()
  return `<figure class="pure-chart">\n${body}\n</figure>\n`
}

export interface PngOptions {
  /**
   * Pixels per SVG unit. A figure printed at 300dpi in a 6-inch column needs
   * about three times the pixels a screen does, and rasterizing at the
   * viewBox size is how a chart ends up soft in a PDF.
   */
  scale?: number
  /** Painted behind the chart; `null` leaves the PNG transparent. */
  background?: string | null
}

/** Shared by UI, agent exports and the rasterizer, before any allocation or write. */
export function validateChartExportSize(width: number, height: number, scale = 1): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 120 || height < 90 || width > 4096 || height > 4096) {
    return 'Figure dimensions must be finite numbers between 120 × 90 and 4096 × 4096 pixels.'
  }
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 8) return 'PNG scale must be a finite number between 0.25 and 8.'
  if (Math.ceil(width * scale) * Math.ceil(height * scale) > 40_000_000) return 'Choose no more than 40 million output pixels.'
  return null
}

/** Rasterize an exported SVG into PNG bytes using the browser canvas. */
export async function svgToPngBytes(
  svgString: string,
  width: number,
  height: number,
  options: PngOptions = {},
): Promise<Uint8Array> {
  const scale = options.scale ?? 1
  const sizeError = validateChartExportSize(width, height, scale)
  if (sizeError) throw new Error(sizeError)
  const background =
    options.background === undefined ? '#ffffff' : options.background
  const svgBlob = new Blob([svgString], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(svgBlob)

  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not render SVG for PNG.'))
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(width * scale))
    canvas.height = Math.max(1, Math.ceil(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas export is unavailable.')

    if (background !== null) {
      context.fillStyle = background
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('PNG export failed.'))
      }, 'image/png')
    })

    return new Uint8Array(await pngBlob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

const FORMULA_PREFIX_RE = /^(?:[\t\r\n]|[\s\uFEFF]*[=+\-@])/

/**
 * Format one CSV cell with RFC 4180 quoting and spreadsheet formula-injection
 * neutralization (`=`, `+`, `-`, `@`, `\t`, `\r` prefixed with `'`).
 * Finite numeric values remain unquoted numbers so numeric columns round-trip.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  if (FORMULA_PREFIX_RE.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** Serialize a DataTable as RFC 4180 CSV with formula-injection escaping. */
export function serializeTableCsv(table: DataTable): string {
  if (table.columns.length === 0) return ''
  const header = table.columns.map(column => escapeCsvCell(column.name)).join(',')
  const rows = table.rows.map(row =>
    table.columns.map(column => escapeCsvCell(row[column.name])).join(','),
  )
  return `${[header, ...rows].join('\n')}\n`
}

/** Serialize a DataTable as a JSON array of records (Dates as ISO strings). */
export function serializeTableJson(table: DataTable): string {
  const records = table.rows.map(row => {
    const out: Record<string, unknown> = {}
    for (const column of table.columns) {
      const value = row[column.name]
      out[column.name] = value instanceof Date ? value.toISOString() : value
    }
    return out
  })
  return `${JSON.stringify(records, null, 2)}\n`
}
