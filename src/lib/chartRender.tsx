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

/** Drop the live-exploration nodes, which are never part of an export. */
function stripTransient(markup: string): string {
  // The transient attribute is written on whole elements; remove each element
  // it appears on, innermost first, without needing a DOM.
  let out = markup
  let guard = 0
  while (out.includes(CHART_TRANSIENT_ATTR) && guard < 500) {
    guard += 1
    const at = out.indexOf(CHART_TRANSIENT_ATTR)
    const open = out.lastIndexOf('<', at)
    const tagMatch = /^<([a-zA-Z][\w:-]*)/.exec(out.slice(open))
    if (!tagMatch) break
    const tag = tagMatch[1]!
    const openEnd = out.indexOf('>', at)
    if (openEnd === -1) break
    if (out[openEnd - 1] === '/') {
      out = out.slice(0, open) + out.slice(openEnd + 1)
      continue
    }
    // Walk to the matching close tag, counting nested opens of the same name.
    let depth = 1
    let cursor = openEnd + 1
    while (depth > 0 && cursor < out.length) {
      const nextOpen = out.indexOf(`<${tag}`, cursor)
      const nextClose = out.indexOf(`</${tag}>`, cursor)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1
        cursor = nextOpen + tag.length + 1
      } else {
        depth -= 1
        cursor = nextClose + tag.length + 3
      }
    }
    out = out.slice(0, open) + out.slice(cursor)
  }
  return out
}

export interface RenderedChart {
  svg: string
  width: number
  height: number
  /** Null when there is nothing to draw, with the reason in `message`. */
  message: string | null
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
  if (sizeError) return { svg: '', width, height, message: sizeError }
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
    options.background === undefined ? '#fcfcfb' : options.background
  const ground =
    background === null
      ? ''
      : `<rect x="0" y="0" width="${dims.width}" height="${dims.height}" fill="${background}"></rect>`

  const fullBody = body.replace(/^<svg[^>]*>/, tag => tag.replace(/height="[^"]*"/, `height="${dims.height}"`).replace(/viewBox="[^"]*"/, `viewBox="0 0 ${dims.width} ${dims.height}"`))
  const opened = fullBody.replace(
    /^<svg/,
    `<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"`,
  )
  const withGround = opened.replace(
    />/,
    `><style>text { font-family: ${CHART_FONT_FAMILY}; }</style>${ground}`,
  )

  const caption = captionLines.length ? renderToStaticMarkup(<g aria-label="Chart caption">{captionLines.map((line, i) => <text key={i} x={64} y={drawingDims.height + 16 + i * 17} fontSize={12} fill="#484f59">{line}</text>)}</g>) : ''
  const completed = withGround.replace(/<\/svg>$/, `${caption}</svg>`)
  return {
    svg: `<?xml version="1.0" encoding="UTF-8"?>\n${completed}\n`,
    width: dims.width,
    height: dims.height,
    message: captionHeight > dims.height - 120 ? 'Increase export height to fit the full caption.' : facets ? facets.message ?? facets.panels.find(panel => panel.geometry.empty)?.geometry.message ?? null : geometry.empty ? geometry.message : null,
  }
}
