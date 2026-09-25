import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 940, height: 740 } })
  await page.goto(process.env.PURECHART_URL ?? 'http://localhost:5193')
  const results = await page.evaluate(async () => {
    const { renderChartSvg } = await import('/src/lib/chartRender.tsx')
    const { defaultSpec } = await import('/src/lib/chartSpec.ts')
    const { parseTable } = await import('/src/lib/dataParse.ts')
    const spec = defaultSpec('Comparing groups over time')
    spec.chart.encodings = { x: 'month', y: ['value'], series: 'group' }
    spec.chart.facet = { column: 'group', columns: 2 }
    spec.chart.caption = 'Panels share the same horizontal and vertical scales.'
    const source = parseTable('month,group,value\n2026-01,A,10\n2026-03,A,20\n2026-02,B,12\n2026-03,B,18\n2026-01,C,8\n2026-02,C,14\n2026-01,D,11\n2026-03,D,23')
    const results = []
    for (const type of ['line', 'bar', 'histogram']) {
      spec.chart.type = type
      const output = renderChartSvg(source, spec, { width: 900, height: 700 })
      document.body.innerHTML = output.svg
      const root = document.querySelector('svg').getBoundingClientRect()
      const overflow = [...document.querySelectorAll('text')].filter(node => node.textContent.trim()).filter(node => {
        const bounds = node.getBoundingClientRect()
        return bounds.left < root.left - 1 || bounds.right > root.right + 1 || bounds.top < root.top - 1 || bounds.bottom > root.bottom + 1
      }).map(node => node.textContent)
      results.push({ type, message: output.message, overflow })
      if (type === 'line') window.facetSnapshot = output.svg
    }
    document.body.innerHTML = window.facetSnapshot
    return results
  })
  for (const result of results) { assert.equal(result.message, null); assert.deepEqual(result.overflow, [], JSON.stringify(result)) }
  await page.screenshot({ path: '/tmp/purechart-facet-layout.png' })
  console.log('Line, bar and histogram facets with captions fit within the exported figure.')
} finally { await browser.close() }
