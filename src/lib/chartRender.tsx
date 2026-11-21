import { renderToStaticMarkup } from 'react-dom/server'
import { ChartCanvas } from '../components/ChartCanvas'
import { FacetCanvas } from '../components/FacetCanvas'
import { facetLayout } from './chartFacet'
import { CHART_TRANSIENT_ATTR, validateChartExportSize } from './chartExport'
import { computeChartGeometry, type ChartDims } from './chartLayout'
import { CHART_FONT_FAMILY } from './chartTheme'
import type { ChartSpec } from './chartSpec'
import type { DataTable } from './dataParse'

/**
 * Draw a chart without a window open.
 *
 * Export used to mean reaching into the rendered page and serializing the
 * `<svg>` that happened to be on screen, which meant a chart could only be
 * exported while someone was looking at it — no thumbnails worth the name, no
 * figure another app could ask for, no rendering a saved chart at the size the
 * page it is going into actually needs.
 *
 * This renders the same component, off-screen, from a spec and a table. There
 * is deliberately no second drawing path: a headless renderer that drew its
 * own approximation of a chart would drift from the one people see, and the
 * two would disagree exactly when it mattered.
 */

export interface RenderChartOptions {
  /** In-place redraws must preserve the existing asset when any panel is lost. */
  allowPartialPanels?: boolean
  width?: number
  height?: number
  /** Painted behind the chart. `null` leaves it transparent. */
  background?: string | null
  /**
   * Marks and axes only — no title, legend, axis names or per-bar values.
   * For thumbnails, where that chrome is unreadable and says nothing the
   * surrounding card does not already say.
   */
  bare?: boolean
}

export const DEFAULT_RENDER_SIZE: ChartDims = { width: 900, height: 540 }

const SVG_NS = 'http://www.w3.org/2000/svg'

const DEFAULT_BACKGROUND = '#fcfcfb'
const SAFE_HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const SAFE_NAMED_COLOR_RE = /^[a-z]{3,24}$/i
const SAFE_FUNC_COLOR_RE =
  /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(\s*[0-9.,%\s/+-]+(?:\s*(?:deg|rad|grad|turn))?[0-9.,%\s/+-]*\)$/i

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Validate a CSS color for `<rect fill="...">`, falling back to paper ground on unsafe input. */
export function sanitizeSvgColor(value: string, fallback = DEFAULT_BACKGROUND): string {
  const trimmed = value.trim()
  if (
    SAFE_HEX_COLOR_RE.test(trimmed) ||
    SAFE_NAMED_COLOR_RE.test(trimmed) ||
    SAFE_FUNC_COLOR_RE.test(trimmed)
  ) {
    return escapeXmlAttr(trimmed)
  }
  return fallback
}

/** Find the closing `>` of a tag starting after `<`, respecting quoted attribute values. */
function findTagEnd(src: string, start: number): number {
  let quote: string | null = null
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i]!
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '>') {
      return i
    }
  }
  return -1
}

/** Check whether the opening `<svg ...>` tag already declares an `xmlns` attribute. */
function hasSvgXmlns(markup: string): boolean {
  if (!markup.startsWith('<svg')) return false
  const end = findTagEnd(markup, 4)
  if (end === -1) return false
  const attrs = markup.slice(4, end).replace(/"[^"]*"|'[^']*'/g, ' ')
  return /(?:^|\s)xmlns\s*=/.test(attrs)
}

/** Token-aware XML fallback for environments without DOMParser. */
export function stripTransientFallback(markup: string): string {
  const attrPattern = new RegExp(`(?:^|\\s)${CHART_TRANSIENT_ATTR}(?:=|\\s|$)`)

  let out = ''
  let cursor = 0
  while (cursor < markup.length) {
    const open = markup.indexOf('<', cursor)
    if (open === -1) {
      out += markup.slice(cursor)
      break
    }
    out += markup.slice(cursor, open)
    if (markup.startsWith('<!--', open)) {
      const end = markup.indexOf('-->', open + 4)
      if (end === -1) {
        out += markup.slice(open)
        break
      }
      out += markup.slice(open, end + 3)
      cursor = end + 3
      continue
    }
    const close = findTagEnd(markup, open + 1)
    if (close === -1) {
      out += markup.slice(open)
      break
    }
    const tagText = markup.slice(open, close + 1)
    const openMatch = /^<([a-zA-Z][\w:-]*)([\s\S]*?)(\/?)>$/.exec(tagText)
    const strippedAttrValues = openMatch ? openMatch[2]!.replace(/"[^"]*"|'[^']*'/g, ' ') : ''
    if (!openMatch || !attrPattern.test(strippedAttrValues)) {
      out += tagText
      cursor = close + 1
      continue
    }
    const tagName = openMatch[1]!
    const selfClosing = openMatch[3] === '/'
    if (selfClosing) {
      cursor = close + 1
      continue
    }
    // Skip through matching nested elements of the same exact tag name, ignoring comments.
    let depth = 1
    let scan = close + 1
    while (depth > 0 && scan < markup.length) {
      const next = markup.indexOf('<', scan)
      if (next === -1) {
        scan = markup.length
        break
      }
      if (markup.startsWith('<!--', next)) {
        const commentEnd = markup.indexOf('-->', next + 4)
        scan = commentEnd === -1 ? markup.length : commentEnd + 3
        continue
      }
      const nextEnd = findTagEnd(markup, next + 1)
      if (nextEnd === -1) {
        scan = markup.length
        break
      }
      const inner = markup.slice(next, nextEnd + 1)
      const closeMatch = /^<\/([a-zA-Z][\w:-]*)\s*>$/.exec(inner)
      const nestedOpen = /^<([a-zA-Z][\w:-]*)(?=[\s/>])([\s\S]*?)(\/?)>$/.exec(inner)
      if (closeMatch && closeMatch[1] === tagName) {
        depth -= 1
      } else if (nestedOpen && nestedOpen[1] === tagName && nestedOpen[3] !== '/') {
        depth += 1
      }
      scan = nextEnd + 1
    }
    cursor = scan
  }
  return out
}

/** Drop the live-exploration nodes, which are never part of an export. */
export function stripTransient(markup: string): string {
  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    const wrapped = hasSvgXmlns(markup)
      ? markup
      : markup.replace(/^<svg(?=\s|>)/, `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"`)
    const doc = new DOMParser().parseFromString(wrapped, 'image/svg+xml')
    if (doc.documentElement && doc.documentElement.tagName.toLowerCase() === 'svg' && !doc.querySelector('parsererror')) {
      for (const node of Array.from(doc.querySelectorAll(`[${CHART_TRANSIENT_ATTR}]`))) {
        node.remove()
      }
      return new XMLSerializer().serializeToString(doc.documentElement)
    }
  }
  return stripTransientFallback(markup)
}

export interface RenderedChart {
  svg: string
  width: number
  height: number
  /** Blocking reason, or null when the figure can be used. */
  message: string | null
  /** Non-blocking omissions, named so callers can report the affected panels. */
  warnings: string[]
}

/**
 * The chart as a standalone SVG document: namespaced, with the chart font
 * inlined so it renders in a file, an email or another app without the host
 * stylesheet. The same string the SVG export button writes.
 */
let renderSequence = 0

export function renderChartSvg(
  table: DataTable,
  spec: ChartSpec,
  options: RenderChartOptions = {},
): RenderedChart {
  const width = options.width ?? DEFAULT_RENDER_SIZE.width
  const height = options.height ?? DEFAULT_RENDER_SIZE.height
  const sizeError = validateChartExportSize(width, height)
  if (sizeError) return { svg: '', width, height, message: sizeError, warnings: [] }
  const dims: ChartDims = { width: Math.round(width), height: Math.round(height) }
  const bare = options.bare ?? false
  const captionLines: string[] = []
  const maxChars = Math.max(12, Math.floor((dims.width - 128) / 6.5))
  if (!bare && spec.chart.caption.trim()) {
    for (const paragraph of spec.chart.caption.split('\n')) {
      let line = ''
      for (const word of paragraph.split(/\s+/)) {
        if (line && line.length + word.length + 1 > maxChars) { captionLines.push(line); line = '' }
        if (word.length > maxChars) {
          if (line) { captionLines.push(line); line = '' }
          for (let at = 0; at < word.length; at += maxChars) captionLines.push(word.slice(at, at + maxChars))
        } else line += `${line ? ' ' : ''}${word}`
      }
      if (line || !paragraph) captionLines.push(line)
    }
  }
  const captionHeight = captionLines.length ? captionLines.length * 17 + 16 : 0
  const drawingDims = { ...dims, height: Math.max(90, dims.height - captionHeight) }
  const facets = facetLayout(table, spec, drawingDims, { compact: bare })
  const geometry = computeChartGeometry(table, spec, drawingDims, { compact: bare })
  const warnings = facets?.panels.filter(panel => panel.geometry.empty).map(panel =>
    `Panel “${panel.value}” excluded: ${panel.geometry.message ?? 'No values to plot.'}`,
  ) ?? []
  const facetError = facets?.message ?? (facets && !facets.panels.some(panel => !panel.geometry.empty)
    ? warnings.join(' ') || 'No panels to plot.'
    : facets?.panels.some(panel => panel.geometry.empty && (options.allowPartialPanels === false || panel.geometry.refusalReason !== 'log-y-non-positive'))
      ? warnings.join(' ') : null)

  const body = stripTransient(
    renderToStaticMarkup(
      facets ? (
        <FacetCanvas
          layout={facets}
          spec={spec}
          dims={drawingDims}
          onAddAnnotation={() => {}}
        />
      ) : (
        <ChartCanvas
          geometry={geometry}
          spec={spec}
          interactionMode="read"
          resetToken={0}
          onAddAnnotation={() => {}}
          bare={bare}
        />
      ),
      { identifierPrefix: `figure-${++renderSequence}-` },
    ),
  )

  const background =
    options.background === undefined
      ? DEFAULT_BACKGROUND
      : options.background === null
        ? null
        : sanitizeSvgColor(options.background)
  const ground =
    background === null
      ? ''
      : `<rect x="0" y="0" width="${dims.width}" height="${dims.height}" fill="${background}"></rect>`

  const svgOpenEnd = body.startsWith('<svg') ? findTagEnd(body, 4) : -1
  let withGround = body
  if (svgOpenEnd !== -1) {
    let openTag = body
      .slice(0, svgOpenEnd + 1)
      .replace(/height="[^"]*"/, `height="${dims.height}"`)
      .replace(/viewBox="[^"]*"/, `viewBox="0 0 ${dims.width} ${dims.height}"`)
    if (!hasSvgXmlns(openTag)) {
      openTag = openTag.replace(
        /^<svg(?=\s|>)/,
        `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"`,
      )
    }
    withGround = `${openTag}<style>text { font-family: ${CHART_FONT_FAMILY}; }</style>${ground}${body.slice(svgOpenEnd + 1)}`
  }

  const caption = captionLines.length ? renderToStaticMarkup(<g aria-label="Chart caption">{captionLines.map((line, i) => <text key={i} x={64} y={drawingDims.height + 16 + i * 17} fontSize={12} fill="#484f59">{line}</text>)}</g>) : ''
  const completed = withGround.replace(/<\/svg>$/, `${caption}</svg>`)
  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n${completed}\n`,
    width: dims.width,
    height: dims.height,
    message: captionHeight > dims.height - 120 ? 'Increase export height to fit the full caption.' : facets ? facetError : geometry.empty ? geometry.message : null,
    warnings,
  }
}
