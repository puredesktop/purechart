// Browser geometry checks complement SVG structural unit tests.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 920 } })
  await page.goto(process.env.PURECHART_URL ?? 'http://localhost:5193')
  const results = await page.evaluate(async () => {
    const { renderChartSvg } = await import('/src/lib/chartRender.tsx')
    const { defaultSpec } = await import('/src/lib/chartSpec.ts')
    const { parseTable } = await import('/src/lib/dataParse.ts')
    document.body.innerHTML = ''
    const measurements = []
    for (const [width, height] of [[320, 240], [600, 290], [1200, 800]]) {
      for (const column of ['north', 'A measurement with a very long descriptive name for the publication', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW']) {
        const spec = defaultSpec('Endpoint labels')
        spec.chart.encodings = { x: 'x', y: [column], series: null }
        const output = renderChartSvg(parseTable(`x,${column}\n1,10\n2,20\n3,30`), spec, { width, height })
        const node = document.createElement('div')
        node.innerHTML = output.svg
        document.body.append(node)
        const label = node.querySelector('[data-direct-label]')
        const bounds = label.getBBox()
        const clip = node.querySelector('clipPath[id*="marks-clip"] rect')
        const circles = [...node.querySelectorAll('circle')]
        measurements.push({ width, height, message: output.message, clipped: !!label.closest('[clip-path]'), right: bounds.x + bounds.width, bottom: bounds.y + bounds.height, top: bounds.y, edgeMarkersVisible: circles.every(circle => {
          const x = Number(circle.getAttribute('cx')), y = Number(circle.getAttribute('cy')), r = Number(circle.getAttribute('r'))
          return x - r >= Number(clip.getAttribute('x')) && y - r >= Number(clip.getAttribute('y')) && x + r <= Number(clip.getAttribute('x')) + Number(clip.getAttribute('width')) && y + r <= Number(clip.getAttribute('y')) + Number(clip.getAttribute('height'))
        }) })
        if (width !== 600 || column !== 'north') node.remove()
      }
    }
    return measurements
  })
  for (const result of results) {
    assert.equal(result.message, null)
    assert.equal(result.clipped, false)
    assert.ok(result.right <= result.width && result.bottom <= result.height && result.top >= 0, JSON.stringify(result))
    assert.equal(result.edgeMarkersVisible, true)
  }
  await page.screenshot({ path: '/tmp/purechart-edge-labels.png' })
  console.log(`${results.length} chart sizes/labels passed browser bounds and endpoint visibility checks.`)
} finally { await browser.close() }
