import { describe, expect, it } from 'vitest'
import {
  CHART_TRANSIENT_ATTR,
  buildEmbedSnippet,
  serializeSvg,
  validateChartExportSize,
  svgToPngBytes,
} from './chartExport'

const SVG_NS = 'http://www.w3.org/2000/svg'

function makeSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', '120')
  svg.setAttribute('height', '80')
  const rect = document.createElementNS(SVG_NS, 'rect')
  rect.setAttribute('width', '10')
  rect.setAttribute('height', '10')
  svg.appendChild(rect)
  return svg
}

describe('serializeSvg', () => {
  it('produces a standalone string with namespace, inlined font, and content', () => {
    const out = serializeSvg(makeSvg())
    expect(out).toContain('<?xml')
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(out).toContain('<style')
    expect(out).toContain('font-family')
    expect(out).toContain('<rect')
  })

  it('does not mutate the source element', () => {
    const svg = makeSvg()
    serializeSvg(svg)
    expect(svg.querySelector('style')).toBeNull()
  })

  it('strips transient exploration overlays but keeps saved marks', () => {
    const svg = makeSvg()
    const tooltip = document.createElementNS(SVG_NS, 'g')
    tooltip.setAttribute(CHART_TRANSIENT_ATTR, '')
    tooltip.setAttribute('id', 'tooltip')
    svg.appendChild(tooltip)
    const annotation = document.createElementNS(SVG_NS, 'g')
    annotation.setAttribute('id', 'annotation')
    svg.appendChild(annotation)

    const out = serializeSvg(svg)
    expect(out).not.toContain('id="tooltip"')
    expect(out).toContain('id="annotation"')
    expect(svg.querySelector('#tooltip')).not.toBeNull()
  })
})

describe('buildEmbedSnippet', () => {
  it('strips the xml declaration and wraps in a figure', () => {
    const snippet = buildEmbedSnippet(serializeSvg(makeSvg()))
    expect(snippet.startsWith('<figure class="pure-chart">')).toBe(true)
    expect(snippet).not.toContain('<?xml')
    expect(snippet.trimEnd().endsWith('</figure>')).toBe(true)
  })
})

it('validates finite dimensions, scale and rounded pixel allocation', async () => {
  expect(validateChartExportSize(1800, 1200, 2)).toBeNull()
  expect(validateChartExportSize(4096, 4096, 2)).toContain('40 million')
  expect(validateChartExportSize(900, 540, NaN)).toContain('scale')
  expect(validateChartExportSize(Infinity, 540)).toContain('dimensions')
  await expect(svgToPngBytes('<svg/>', 4096, 4096, { scale: 8 })).rejects.toThrow('40 million')
})
