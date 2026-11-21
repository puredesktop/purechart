import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import manifest from '../../plugin.json'
import { renderChartSvg, sanitizeSvgColor, stripTransient, stripTransientFallback } from './chartRender'
import { migrateSheet, sheetFromSpec } from './chartSheet'
import { isSafeCollectionPath, isSafeRelativePath, parseFigures } from './chartFigures'
import { threeWayMerge } from './threeWayMerge'
import { defaultSpec, type ChartSpec } from './chartSpec'
import {
  AgentChartToolError,
  createChartAgentSpec,
  getChartAgentData,
  replaceChartDataAgentSpec,
  setChartPaletteAgentSpec,
  updateChartAgentSpec,
} from './agentChartTools'
import { createChartProposal } from './chartProposal'
import { setChartAxisHandler } from '../agents/handlers/write/setChartAxis'
import { setChartCaptionHandler } from '../agents/handlers/write/setChartCaption'
import { setChartEncodingsHandler } from '../agents/handlers/write/setChartEncodings'
import { updateChartHandler } from '../agents/handlers/write/updateChart'
import { addChartAnnotationHandler } from '../agents/handlers/write/addChartAnnotation'
import type { ChartAgentToolContext } from '../agents/context'
import type { AgentToolInvokeContext } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { fitTrend } from './chartTrend'
import { computeChartGeometry } from './chartLayout'
import { transformChartData } from './chartTransform'
import { facetLayout } from './chartFacet'
import { chartDescription } from './chartFindings'
import { summarizeBrush, type InteractivePoint } from './chartInteraction'
import { suggestForms } from './chartForms'
import { reviewChart } from './chartReview'
import { parseData, parseDelimited, parseTable } from './dataParse'
import { editGrid, editSheetData } from './dataEditing'
import { chartDataImpact } from './chartDataImpact'
import { escapeCsvCell, serializeTableCsv, serializeTableJson } from './chartExport'
import { SAMPLE_DATASETS } from './sampleDatasets'
import { defaultPresentation } from './chartPresentation'
import { ChartCanvas } from '../components/ChartCanvas'
import { DataPanel } from '../components/DataPanel'
import { ExportPanel } from '../components/ExportPanel'
import { SheetView } from '../components/SheetView'
import { SelectField } from '../components/SelectField'
import type { ChartSession } from '../hooks/useChartSession'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const invoke = (args: Record<string, unknown>): AgentToolInvokeContext => ({
  toolCallId: 'test-call',
  shortName: 'test',
  arguments: args,
})

describe('A. Security & validation fixes', () => {
  it('strips [data-purechart-transient] via DOM without corrupting text containing the attribute name or > in attributes', () => {
    const raw = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">',
      '<g data-label="a > b"><text>data-purechart-transient stays in text</text></g>',
      '<g data-purechart-transient=""><rect width="10" height="10"/><g><circle r="2"/></g></g>',
      '<rect data-purechart-transient="" width="5" height="5"/>',
      '<g class="keep"><text>Kept</text></g>',
      '</svg>',
    ].join('')
    const cleaned = stripTransient(raw)
    expect(cleaned).toContain('data-purechart-transient stays in text')
    expect(cleaned).toContain('Kept')
    expect(cleaned).not.toContain('<rect')
    expect(cleaned).not.toContain('<circle')

    // Fallback: attribute value containing the transient name must NOT be stripped,
    // and comments containing closing tags inside a transient block must not break depth.
    const fallbackInput = [
      '<svg width="200" height="100" aria-label="A > B">',
      '<g aria-label="note data-purechart-transient=1"><text>KeepAttr</text></g>',
      '<g data-purechart-transient=""><!-- </g> --><rect width="1" height="1"/></g>',
      '<text>After</text>',
      '</svg>',
    ].join('')
    const fallbackOut = stripTransientFallback(fallbackInput)
    expect(fallbackOut).toContain('KeepAttr')
    expect(fallbackOut).toContain('After')
    expect(fallbackOut).not.toContain('<rect')

    // renderChartSvg handles `>` inside `<svg aria-label="...">` via quote-aware findTagEnd
    const gtTable = parseTable('x,y\n1,10\n2,20')
    const gtSpec = defaultSpec('A > B')
    gtSpec.chart.encodings = { x: 'x', y: ['y'], series: null }
    const rendered = renderChartSvg(gtTable, gtSpec)
    expect(rendered.svg).toContain('aria-label="A &gt; B"')
    expect(rendered.svg).toContain('<style>')
  })

  it('validates and sanitizes options.background against attribute/script injection', () => {
    const table = parseTable('x,y\n1,10\n2,20')
    const spec = defaultSpec('Safe bg')
    spec.chart.encodings = { x: 'x', y: ['y'], series: null }

    const malicious = renderChartSvg(table, spec, {
      background: '#fff"/><script>alert(1)</script><rect fill="#fff',
    })
    expect(malicious.svg).not.toContain('<script>')
    expect(malicious.svg).not.toContain('alert(1)')
    expect(malicious.svg).toContain('fill="#fcfcfb"')

    const validRgb = renderChartSvg(table, spec, { background: 'rgb(240, 244, 248)' })
    expect(validRgb.svg).toContain('fill="rgb(240, 244, 248)"')
    expect(sanitizeSvgColor('white')).toBe('white')
    expect(sanitizeSvgColor('url(javascript:alert(1))')).toBe('#fcfcfb')
  })

  it('sanitizes value.data, palette.custom, and deduplicates chart IDs during v2 migration', () => {
    const migrated = migrateSheet({
      schemaVersion: 2,
      title: 'Dirty v2',
      data: {
        mode: 'bogus',
        columnTypes: { a: 'number', bad: 'executable' },
        inline: { format: 'evil', text: 12345 },
      },
      palette: {
        id: 'nonexistent',
        custom: [
          { id: 'good', label: 'Good', colors: ['#112233', 'not-a-color', 42] },
          { id: 'bad', label: '', colors: ['nope'] },
        ],
      },
      charts: [
        { id: 'dup', spec: defaultSpec('One') },
        { id: 'dup', spec: defaultSpec('Two') },
        { id: '   ', spec: defaultSpec('Three') },
      ],
    })
    expect(migrated.data.mode).toBe('inline')
    expect(migrated.data.inline).toEqual({ format: 'csv', text: '' })
    expect(migrated.data.columnTypes).toEqual({ a: 'number' })
    expect(migrated.palette.custom).toEqual([
      { id: 'good', label: 'Good', colors: ['#112233'], custom: true },
    ])
    expect(migrated.palette.id).toBe('science')
    const ids = migrated.charts.map(c => c.id)
    expect(new Set(ids).size).toBe(3)
    expect(ids.every(id => id.trim().length > 0)).toBe(true)
  })

  it('rejects path traversal, leading slashes, and backslashes in figure paths', () => {
    expect(isSafeRelativePath('assets/figures/chart.svg')).toBe(true)
    expect(isSafeRelativePath('../secret.svg')).toBe(false)
    expect(isSafeRelativePath('assets/../../secret.svg')).toBe(false)
    expect(isSafeRelativePath('/etc/passwd')).toBe(false)
    expect(isSafeRelativePath('assets\\figures\\chart.svg')).toBe(false)
    expect(isSafeRelativePath('C:secret.svg')).toBe(false)
    expect(isSafeRelativePath('file:secret.svg')).toBe(false)

    expect(isSafeCollectionPath('/books/Reef.book')).toBe(true)
    expect(isSafeCollectionPath('/books/../etc')).toBe(false)
    expect(isSafeCollectionPath('C:\\books\\Reef.book')).toBe(false)
    expect(isSafeCollectionPath('C:/books/Reef.book')).toBe(false)
    expect(isSafeCollectionPath('/books/./Reef.book')).toBe(false)
    expect(isSafeCollectionPath('/books//Reef.book')).toBe(false)

    const base = {
      chartId: 'c1',
      format: 'svg',
      width: 900,
      height: 540,
      scale: 1,
      transparent: false,
      palette: 'source',
      fingerprint: 'fp',
      exportedAt: '2026-01-01T00:00:00Z',
    }
    const parsed = parseFigures(
      JSON.stringify({
        figures: [
          { ...base, collectionPath: '/books/A.book', relativePath: 'assets/figures/ok.svg' },
          { ...base, collectionPath: '/books/A.book', relativePath: '../escape.svg' },
          { ...base, collectionPath: '/books/A.book', relativePath: '/abs.svg' },
          { ...base, collectionPath: '/books/A.book', relativePath: 'assets\\win.svg' },
          { ...base, collectionPath: '/books/../etc', relativePath: 'assets/figures/ok.svg' },
          { ...base, collectionPath: 'C:\\win\\book', relativePath: 'assets/figures/ok.svg' },
        ],
      }),
    )
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.relativePath).toBe('assets/figures/ok.svg')
  })

  it('guards __proto__, constructor, and prototype keys across all branches in threeWayMerge', () => {
    const base = JSON.parse('{"title":"a"}')
    const local = JSON.parse('{"title":"a","__proto__":{"polluted":true},"constructor":{"bad":1}}')
    const remote = JSON.parse('{"title":"b","prototype":{"evil":true}}')
    const merged = threeWayMerge<Record<string, unknown>>(base, local, remote)
    expect(merged.title).toBe('b')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
    expect(Object.hasOwn(merged, '__proto__')).toBe(false)
    expect(Object.hasOwn(merged, 'constructor')).toBe(false)
    expect(Object.hasOwn(merged, 'prototype')).toBe(false)

    // One-sided remote change (same(b, l) early-return branch) with nested __proto__
    const baseOne = JSON.parse('{"title":"a","nested":{"x":1},"items":[]}')
    const localOne = JSON.parse('{"title":"a","nested":{"x":1},"items":[]}')
    const remoteOne = JSON.parse(
      '{"title":"a","nested":{"x":2,"__proto__":{"p":1}},"items":[{"id":"1","__proto__":{"q":2},"constructor":{"r":3}}],"__proto__":{"top":1}}',
    )
    const mergedOne = threeWayMerge<Record<string, any>>(baseOne, localOne, remoteOne)
    expect(mergedOne.nested.x).toBe(2)
    expect(Object.hasOwn(mergedOne, '__proto__')).toBe(false)
    expect(Object.hasOwn(mergedOne.nested, '__proto__')).toBe(false)
    expect(Object.hasOwn(mergedOne.items[0], '__proto__')).toBe(false)
    expect(Object.hasOwn(mergedOne.items[0], 'constructor')).toBe(false)
  })
})

describe('B. Agent tool bugs & manifest parity', () => {
  it('preserves unsent axis fields and min/max/scale in setChartAxis', async () => {
    const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,100' })
    spec.chart.axes.y = { name: 'Revenue', unit: 'NZ$', format: 'plain', min: 1, max: 500, scale: 'log' }
    let applied = spec
    const ctx = {
      get spec() { return applied },
      table,
      applyChartSpec: vi.fn((next: ChartSpec) => { applied = next }),
    } as unknown as ChartAgentToolContext

    await setChartAxisHandler(ctx, invoke({ axis: 'y', format: 'compact' }))
    expect(applied.chart.axes.y).toEqual({
      name: 'Revenue',
      unit: 'NZ$',
      format: 'compact',
      min: 1,
      max: 500,
      scale: 'log',
    })

    await setChartAxisHandler(ctx, invoke({ axis: 'y', unit: '' }))
    expect(applied.chart.axes.y).toEqual({
      name: 'Revenue',
      unit: null,
      format: 'compact',
      min: 1,
      max: 500,
      scale: 'log',
    })
  })

  it('allows clearing the caption with empty string in setChartCaption', async () => {
    const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,20' })
    spec.chart.caption = 'Initial caption'
    let applied = spec
    const ctx = {
      get spec() { return applied },
      table,
      applyChartSpec: vi.fn((next: ChartSpec) => { applied = next }),
    } as unknown as ChartAgentToolContext

    await setChartCaptionHandler(ctx, invoke({ caption: '' }))
    expect(applied.chart.caption).toBe('')
    await expect(setChartCaptionHandler(ctx, invoke({}))).rejects.toThrow(AgentChartToolError)
  })

  it('declares and applies limitSeries in setChartEncodings and plugin.json', async () => {
    const tool = manifest.app.agents.tools.find(t => t.name === 'setChartEncodings')
    expect(tool?.inputSchema.properties).toHaveProperty('limitSeries')

    const { spec, table } = createChartAgentSpec({ dataText: 'x,a,b,c\n1,10,20,30\n2,15,25,35' })
    let applied = spec
    const ctx = {
      get spec() { return applied },
      table,
      documentPath: null,
      applyChartSpec: vi.fn((next: ChartSpec) => { applied = next }),
    } as unknown as ChartAgentToolContext

    await setChartEncodingsHandler(ctx, invoke({ limitSeries: 2 }))
    expect(applied.chart.encodings.limitSeries).toBe(2)

    await setChartEncodingsHandler(ctx, invoke({ limitSeries: 0 }))
    expect(applied.chart.encodings.limitSeries).toBe(0)

    // Explicit undefined leaves limitSeries unchanged rather than throwing NaN
    await setChartEncodingsHandler(ctx, invoke({ limitSeries: 2 }))
    await setChartEncodingsHandler(ctx, invoke({ limitSeries: undefined }))
    expect(applied.chart.encodings.limitSeries).toBe(2)
    await updateChartHandler(ctx, invoke({ limitSeries: undefined, title: 'Updated' }))
    expect(applied.chart.encodings.limitSeries).toBe(2)

    await expect(setChartEncodingsHandler(ctx, invoke({ limitSeries: -1 }))).rejects.toThrow(
      AgentChartToolError,
    )

    const replaceTool = manifest.app.agents.tools.find(t => t.name === 'replaceChartData')
    expect(replaceTool?.description).toMatch(/disappears/i)
  })

  it('allows size and normalized defaults in chartProposal', () => {
    const { spec, table } = createChartAgentSpec({
      dataText: 'a,b,s\n1,10,4\n2,20,16\n3,30,9',
      type: 'scatter',
    })
    const bubbleProposal = createChartProposal('c1', spec, table, {
      explanation: 'Show third measure as bubble area.',
      patch: { type: 'bubble', x: 'a', y: ['b'], size: 's' },
    })
    expect(bubbleProposal.spec.chart.encodings.size).toBe('s')

    const withBounds: ChartSpec = {
      ...spec,
      chart: {
        ...spec.chart,
        axes: {
          ...spec.chart.axes,
          y: { ...spec.chart.axes.y, min: 0, max: 50, scale: 'log' },
        },
        presentation: { ...defaultPresentation(), trendline: { kind: 'linear' } },
      },
    }
    const resetDefaults = createChartProposal('c1', withBounds, table, {
      explanation: 'Return to auto linear bounds without trendline.',
      patch: {
        axes: {
          x: withBounds.chart.axes.x,
          y: { ...withBounds.chart.axes.y, min: null, max: null, scale: 'linear' },
        },
        presentation: { ...defaultPresentation(), trendline: null },
      },
    })
    expect(resetDefaults.spec.chart.axes.y.min).toBeUndefined()
    expect(resetDefaults.spec.chart.axes.y.scale).toBeUndefined()
    expect(resetDefaults.spec.chart.presentation?.trendline).toBeUndefined()
  })

  it('generates unique annotation IDs, rejects blank text, and throws AgentChartToolError', async () => {
    const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
    let applied = spec
    const ctx = {
      get spec() { return applied },
      table,
      documentPath: null,
      applyChartSpec: vi.fn((next: ChartSpec) => { applied = next }),
    } as unknown as ChartAgentToolContext

    await expect(
      addChartAnnotationHandler(
        ctx,
        invoke({ annotation: { text: '   ', target: { kind: 'point', seriesKey: 'y', xLabel: '1', value: 10 } } }),
      ),
    ).rejects.toThrow(AgentChartToolError)

    await expect(
      addChartAnnotationHandler(
        ctx,
        invoke({ annotation: { text: 'Wrong', target: { kind: 'point', seriesKey: 'y', xLabel: '1', value: 999 } } }),
      ),
    ).rejects.toThrow(AgentChartToolError)

    await addChartAnnotationHandler(
      ctx,
      invoke({ annotation: { text: 'First', target: { kind: 'point', seriesKey: 'y', xLabel: '1', value: 10 } } }),
    )
    await addChartAnnotationHandler(
      ctx,
      invoke({ annotation: { text: 'Second', target: { kind: 'point', seriesKey: 'y', xLabel: '2', value: 20 } } }),
    )
    expect(applied.chart.annotations).toHaveLength(2)
    expect(applied.chart.annotations[0]!.id).not.toBe(applied.chart.annotations[1]!.id)
  })

  it('re-suggests encodings on disappeared columns and validates palette/style/limit inputs', () => {
    const { spec, table } = createChartAgentSpec({ dataText: 'year,sales\n2023,10\n2024,20' })
    const replaced = replaceChartDataAgentSpec(spec, {
      dataText: 'region,count\nNorth,5\nSouth,8',
    })
    expect(replaced.spec.chart.encodings.x).toBe('region')
    expect(replaced.spec.chart.encodings.y).toEqual(['count'])

    const custom = setChartPaletteAgentSpec(spec, {
      label: 'Mixed',
      colors: [123 as unknown as string, null as unknown as string, '#123456'],
    })
    expect(custom.chart.style.customPalettes[0]!.colors).toEqual(['#123456'])

    const styled = updateChartAgentSpec(spec, table, {
      style: { strokeWidth: Infinity, pointRadius: Number.NaN },
    })
    expect(styled.chart.style.strokeWidth).toBe(spec.chart.style.strokeWidth)
    expect(styled.chart.style.pointRadius).toBe(spec.chart.style.pointRadius)

    expect(getChartAgentData(spec, table, Number.NaN).rows).toHaveLength(2)
    expect(getChartAgentData(spec, table, Infinity).rows).toHaveLength(2)
  })
})

describe('C. Chart math, scales, transforms, facets, forms, review & CSV', () => {
  it('fits linear trends accurately on large Unix millisecond timestamps', () => {
    const day = 86_400_000
    const start = Date.UTC(2026, 0, 1)
    const pairs = [0, 1, 2, 3, 4, 5].map(i => ({ x: start + i * day, y: 100 + 2.5 * i }))
    const fit = fitTrend(pairs, { kind: 'linear' })
    if ('error' in fit) throw new Error(fit.error)
    expect(fit.r2).toBeCloseTo(1, 10)
    expect(fit.predict(start + 10 * day)).toBeCloseTo(125, 6)
  })

  it('samples 80 points for a linear trendline on a log Y axis', () => {
    const table = parseTable('x,y\n1,10\n2,40\n3,90\n4,160\n5,250')
    const spec = defaultSpec('Log trend')
    spec.chart.encodings = { x: 'x', y: ['y'], series: null }
    spec.chart.axes.y.scale = 'log'
    spec.chart.presentation = { ...defaultPresentation(), trendline: { kind: 'linear' } }
    const geo = computeChartGeometry(table, spec, { width: 800, height: 500 })
    const segments = geo.series[0]!.trend!.path!.split('L').length
    expect(segments).toBeGreaterThan(20)
  })

  it('clamps vertical bar baseline inside negative-only y bounds', () => {
    const table = parseTable('cat,val\nA,-10\nB,-20')
    const spec = defaultSpec('Neg bars')
    spec.chart.type = 'bar'
    spec.chart.encodings = { x: 'cat', y: ['val'], series: null }
    spec.chart.axes.y.min = -30
    spec.chart.axes.y.max = -5
    const geo = computeChartGeometry(table, spec, { width: 600, height: 400 })
    for (const bar of geo.series[0]!.bars) {
      expect(bar.y).toBeGreaterThanOrEqual(geo.plot.top - 0.01)
      expect(bar.y + bar.height).toBeLessThanOrEqual(geo.plot.bottom + 0.01)
    }
  })

  it('guards single-date X domain and sorts unsorted line points with direct label at rightmost point', () => {
    const singleDate = parseTable('day,val\n2026-03-15,42')
    const s1 = defaultSpec('One day')
    s1.chart.encodings = { x: 'day', y: ['val'], series: null }
    const g1 = computeChartGeometry(singleDate, s1, { width: 600, height: 400 })
    expect(g1.empty).toBe(false)
    expect(g1.xTicks.length).toBeGreaterThan(0)
    expect(Number.isFinite(g1.series[0]!.points[0]!.cx)).toBe(true)

    const unsorted = parseTable('x,y\n3,30\n1,10\n2,20')
    const s2 = defaultSpec('Unsorted')
    s2.chart.encodings = { x: 'x', y: ['y'], series: null }
    const g2 = computeChartGeometry(unsorted, s2, { width: 600, height: 400 })
    const xs = g2.series[0]!.points.map(p => p.cx)
    expect(xs[0]!).toBeLessThan(xs[1]!)
    expect(xs[1]!).toBeLessThan(xs[2]!)
    expect(g2.series[0]!.label!.x).toBeCloseTo(xs[2]! + 6)
  })

  it('ignores blank gt/lt filter values and keeps nulls last on desc sort', () => {
    const table = parseTable('cat,val\nA,10\nB,\nC,30')
    const spec = defaultSpec('Transform')
    spec.chart.encodings = { x: 'cat', y: ['val'], series: null }
    spec.chart.transform = {
      aggregate: 'none',
      missing: 'omit',
      filters: [{ column: 'val', op: 'gt', value: '' }],
      sort: { column: 'val', direction: 'desc' },
    }
    const result = transformChartData(table, spec)
    expect(result.table.rows.map(r => r.cat)).toEqual(['C', 'A', 'B'])
  })

  it('excludes empty facet panels from shared yDomain and ignores blank string x coercion', () => {
    const table = parseTable('x,panel,val\n1,Good,100\n2,Good,120\n1,Empty,\n2,Empty,')
    const spec = defaultSpec('Facets')
    spec.chart.encodings = { x: 'x', y: ['val'], series: null }
    spec.chart.facet = { column: 'panel', columns: 2 }
    const layout = facetLayout(table, spec, { width: 800, height: 400 })
    expect(layout).not.toBeNull()
    expect(layout!.yDomain).toEqual([100, 120])
  })

  it('avoids stack overflow on >150k values in summarizeBrush and chartDescription', () => {
    const count = 160_000
    const points: InteractivePoint[] = Array.from({ length: count }, (_, i) => ({
      id: `p-${i}`,
      cx: 10,
      cy: 10,
      value: i,
      xLabel: String(i),
      seriesKey: 's',
      color: '#2a78d6',
    }))
    const summary = summarizeBrush(points, { x0: 0, x1: 20, y0: 0, y1: 20 })
    expect(summary).toMatchObject({ count, min: 0, max: count - 1 })

    const bigGeometry = {
      ...computeChartGeometry(parseTable('x,y\n1,1\n2,2'), (() => {
        const s = defaultSpec('Big')
        s.chart.encodings = { x: 'x', y: ['y'], series: null }
        return s
      })(), { width: 600, height: 400 }),
      series: [
        {
          key: 'y',
          color: '#2a78d6',
          linePath: null,
          areaPath: null,
          bars: [],
          label: null,
          points: Array.from({ length: count }, (_, i) => ({
            cx: i,
            cy: i,
            value: i,
            xLabel: String(i),
          })),
        },
      ],
    }
    const desc = chartDescription(parseTable('x,y\n1,1'), defaultSpec('Big'), bigGeometry)
    expect(desc).toContain('low 0, high 159999')
  })

  it('fixes Pie Other overflow, 1-color limitSeries, horizontal-bar BAR_FORMS, bubble ALL_PAIRS_FORMS, and negative Pie/Bubble checks', () => {
    // Pie with > capacity slices folds into Other without blocking colour-overflow
    const many = parseTable(['k,v', ...'abcdefghij'.split('').map((k, i) => `${k},${20 - i}`)].join('\n'))
    const pieSpec = defaultSpec('Pie')
    pieSpec.chart.type = 'pie'
    pieSpec.chart.encodings = { x: 'k', y: ['v'], series: null }
    pieSpec.chart.style.palette = 'mono'
    const pieReview = reviewChart(many, pieSpec)
    expect(pieReview.findings.find(f => f.id === 'colour-overflow')).toBeUndefined()

    // 1-color palette suggests count >= 1 (never 0)
    const oneColorSpec = defaultSpec('One colour')
    oneColorSpec.chart.type = 'line'
    oneColorSpec.chart.encodings = { x: 'm', y: ['v'], series: 'g' }
    oneColorSpec.chart.style.palette = 'single'
    oneColorSpec.chart.style.customPalettes = [{ id: 'single', label: 'Single', colors: ['#2a78d6'], custom: true }]
    const oneColorTable = parseTable('m,g,v\n1,A,10\n1,B,20\n2,A,15\n2,B,25')
    const oneColorReview = reviewChart(oneColorTable, oneColorSpec)
    const keepFix = oneColorReview.findings
      .find(f => f.id === 'colour-overflow')
      ?.fixes.find(f => f.kind === 'keep-series')
    expect(keepFix && keepFix.kind === 'keep-series' ? keepFix.count : 0).toBe(1)

    // Horizontal bar detects truncated axis not starting at zero
    const hbarSpec = defaultSpec('Truncated HBar')
    hbarSpec.chart.type = 'horizontal-bar'
    hbarSpec.chart.encodings = { x: 'k', y: ['v'], series: null }
    hbarSpec.chart.axes.y.min = 5
    const hbarReview = reviewChart(parseTable('k,v\nA,10\nB,20'), hbarSpec)
    expect(hbarReview.findings.some(f => f.id === 'bars-truncated')).toBe(true)

    // Bubble uses scope 'all'
    const bubbleTable = parseTable('x,y,s,g\n1,2,4,A\n2,3,9,B\n3,4,16,C\n4,5,25,D')
    const bubbleSpec = defaultSpec('Bubbles')
    bubbleSpec.chart.type = 'bubble'
    bubbleSpec.chart.encodings = { x: 'x', y: ['y'], series: 'g', size: 's' }
    const bubbleReview = reviewChart(bubbleTable, bubbleSpec)
    expect(bubbleReview.colour.scope).toBe('all')

    // Pie rejects negative row even if category total is positive
    const negRowPie = parseTable('k,v\nA,10\nA,-3\nB,5')
    const pieNegSpec = defaultSpec('Neg row pie')
    pieNegSpec.chart.type = 'pie'
    pieNegSpec.chart.encodings = { x: 'k', y: ['v'], series: null }
    pieNegSpec.chart.transform = { aggregate: 'none', missing: 'omit', filters: [], sort: null }
    // Even with default sum transform, raw negative row is caught before/during aggregation
    const negPieGeo = computeChartGeometry(negRowPie, { ...pieNegSpec, chart: { ...pieNegSpec.chart, transform: { aggregate: 'none', missing: 'omit', filters: [], sort: null } } }, { width: 600, height: 400 })
    expect(negPieGeo.empty).toBe(true)

    // suggestForms rejects negative bubble sizes and all-zero pie
    const negBubble = parseTable('a,b,s\n1,2,-5\n3,4,10')
    expect(suggestForms(negBubble).find(f => f.type === 'bubble')?.supported).toBe(false)
    const zeroPie = parseTable('cat,v\nA,0\nB,0')
    expect(suggestForms(zeroPie).find(f => f.type === 'pie')?.supported).toBe(false)
  })

  it('guards bubble sizeKey.max === 0 against NaN radii in ChartCanvas', () => {
    const table = parseTable('x,y,s\n1,10,0\n2,20,0')
    const spec = defaultSpec('Zero bubbles')
    spec.chart.type = 'bubble'
    spec.chart.encodings = { x: 'x', y: ['y'], series: null, size: 's' }
    const geo = computeChartGeometry(table, spec, { width: 600, height: 400 })
    const svg = renderToStaticMarkup(
      createElement(ChartCanvas, {
        geometry: geo,
        spec,
        interactionMode: 'read',
        resetToken: 0,
        onAddAnnotation: () => {},
      }),
    )
    expect(svg).not.toContain('NaN')
  })

  it('rejects whitespace-padded duplicate headers, updates encodings.size, and auto-expands wider pastes', () => {
    expect(() => parseDelimited('a, a \n1,2')).toThrow('unique')

    const text = 'x,y,pop\n1,10,5\n2,20,10'
    const table = parseData(text, 'csv')
    const spec = defaultSpec('Bubble')
    spec.data = { mode: 'inline', inline: { format: 'csv', text } }
    spec.chart.type = 'bubble'
    spec.chart.encodings = { x: 'x', y: ['y'], series: null, size: 'pop' }
    const sheet = sheetFromSpec(spec)

    const renamed = editSheetData(sheet, table, { kind: 'rename', column: 2, name: 'population' })
    expect(renamed.sheet.charts[0]!.spec.chart.encodings.size).toBe('population')

    const impacts = chartDataImpact(renamed.sheet.charts, parseData('x,y\n1,10', 'csv'))
    expect(impacts[0]!.missing).toContain('population')

    const expanded = editGrid(
      { columns: ['a', 'b'], rows: [['1', '2']] },
      { kind: 'paste', row: 0, column: 1, text: 'x\ty\tz', expandColumns: true },
    )
    expect(expanded.columns).toEqual(['a', 'b', 'Column 3', 'Column 4'])
    expect(expanded.rows).toEqual([['1', 'x', 'y', 'z']])
  })
})

describe('D. Export escaping, UI fixes & must-have features', () => {
  it('escapes spreadsheet formula injection prefixes in CSV export and serializes JSON cleanly', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(escapeCsvCell('+1+1')).toBe("'+1+1")
    expect(escapeCsvCell('-cmd|calc')).toBe("'-cmd|calc")
    expect(escapeCsvCell('@SUM(1)')).toBe("'@SUM(1)")
    expect(escapeCsvCell('\t=1')).toBe("'\t=1")
    expect(escapeCsvCell('\r=1')).toBe("\"'\\r=1\"".replace('\\r', '\r'))
    expect(escapeCsvCell(' =SUM(A1:A2)')).toBe("' =SUM(A1:A2)")
    expect(escapeCsvCell('\n=1+1')).toBe("\"'\n=1+1\"")
    expect(escapeCsvCell('\uFEFF=1+1')).toBe("'\uFEFF=1+1")
    expect(escapeCsvCell('  +cmd')).toBe("'  +cmd")
    expect(escapeCsvCell(-42)).toBe('-42')

    const table = parseTable('label,amount,day\n=HYPERLINK("x"),-12,2026-01-15')
    const csv = serializeTableCsv(table)
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"")
    expect(csv).toContain(',-12,2026-01-15T00:00:00.000Z')

    const json = JSON.parse(serializeTableJson(table))
    expect(json[0].day).toBe('2026-01-15T00:00:00.000Z')
  })

  it('renders horizontal bar vertical gridlines, reference lines, formatted bar labels, and avoids right-legend/direct-label collision', () => {
    const table = parseTable('cat,val\nNorth,0.45\nSouth,0.55')
    const hSpec = defaultSpec('HBar')
    hSpec.chart.type = 'horizontal-bar'
    hSpec.chart.encodings = { x: 'cat', y: ['val'], series: null }
    hSpec.chart.style.grid = true
    hSpec.chart.axes.y.format = 'percent'
    hSpec.chart.presentation = {
      ...defaultPresentation(),
      references: [{ id: 'ref1', axis: 'y', value: 0.5, label: 'Half' }],
    }
    const hGeo = computeChartGeometry(table, hSpec, { width: 700, height: 400 })
    const hSvg = renderToStaticMarkup(
      createElement(ChartCanvas, {
        geometry: hGeo,
        spec: hSpec,
        interactionMode: 'read',
        resetToken: 0,
        onAddAnnotation: () => {},
      }),
    )
    expect(hSvg).toContain('aria-label="Reference: Half"')
    expect(hSvg).toContain('>45%<')
    expect(hSvg).toContain('>55%<')

    const lineSpec = defaultSpec('Right legend')
    lineSpec.chart.type = 'line'
    lineSpec.chart.encodings = { x: 'cat', y: ['val'], series: null }
    lineSpec.chart.style.directLabels = true
    lineSpec.chart.presentation = { ...defaultPresentation(), legend: 'right' }
    const lineGeo = computeChartGeometry(table, lineSpec, { width: 700, height: 400 })
    expect(lineGeo.series[0]!.label).toBeNull()
  })

  it('supports domain-level zoom and renders a Reset zoom control when zoomed', async () => {
    const table = parseTable('x,y\n1,10\n2,20\n3,30\n4,40')
    const spec = defaultSpec('Zoomable')
    spec.chart.encodings = { x: 'x', y: ['y'], series: null }
    const zoomed = computeChartGeometry(table, spec, { width: 700, height: 400 }, {
      xDomain: [1.5, 3.5],
      yDomain: [15, 35],
      exactDomain: true,
    })
    expect(zoomed.yValueAtPixel(zoomed.plot.bottom)).toBeCloseTo(15, 3)
    expect(zoomed.yValueAtPixel(zoomed.plot.top)).toBeCloseTo(35, 3)
    expect(zoomed.xValueAtPixel!(zoomed.plot.left)).toBeCloseTo(1.5, 3)
    expect(zoomed.xValueAtPixel!(zoomed.plot.right)).toBeCloseTo(3.5, 3)

    const svg = renderToStaticMarkup(
      createElement(ChartCanvas, {
        geometry: zoomed,
        spec,
        interactionMode: 'explore',
        resetToken: 0,
        zoomDomain: { x: [1.5, 3.5], y: [15, 35] },
        onAddAnnotation: () => {},
      }),
    )
    expect(svg).toContain('Reset zoom')

    // Bubble wheel zoom respects inset and ignores deltaY === 0
    const bubbleTable = parseTable('a,b,s\n0,0,10\n10,100,40')
    const bubbleSpec = defaultSpec('Bubble zoom')
    bubbleSpec.chart.type = 'bubble'
    bubbleSpec.chart.encodings = { x: 'a', y: ['b'], series: null, size: 's' }
    const bubbleGeo = computeChartGeometry(bubbleTable, bubbleSpec, { width: 700, height: 400 })
    const onZoom = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () => {
        root.render(
          createElement(ChartCanvas, {
            geometry: bubbleGeo,
            spec: bubbleSpec,
            interactionMode: 'explore',
            resetToken: 0,
            onZoomDomainChange: onZoom,
            onAddAnnotation: () => {},
          }),
        )
      })
      const overlay = host.querySelector<SVGRectElement>('rect[aria-label="Inspect chart points"]')!
      overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 700, height: 400, right: 700, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
      const wheelAt = (deltaY: number) => {
        const ev = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
        Object.defineProperties(ev, { clientX: { value: 350 }, clientY: { value: 200 } })
        return ev
      }
      await act(async () => {
        overlay.dispatchEvent(wheelAt(0))
      })
      expect(onZoom).not.toHaveBeenCalled()
      await act(async () => {
        overlay.dispatchEvent(wheelAt(-100))
      })
      expect(onZoom).toHaveBeenCalledTimes(1)
      const zoomedDomain = onZoom.mock.calls[0]![0] as { x: [number, number]; y: [number, number] }
      expect(zoomedDomain.y[1] - zoomedDomain.y[0]).toBeLessThan(100)
      expect(zoomedDomain.x[1] - zoomedDomain.x[0]).toBeLessThan(10)
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('formats Date preview cells as ISO strings, allows non-numeric tables, and provides built-in sample datasets in DataPanel', async () => {
    for (const sample of SAMPLE_DATASETS) {
      const parsed = parseData(sample.csv, 'csv')
      expect(parsed.rows.length).toBeGreaterThan(3)
      expect(parsed.columns.some(c => c.type === 'number')).toBe(true)
    }

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onPasteText = vi.fn()
    try {
      await act(async () => {
        root.render(
          createElement(DataPanel, {
            sourceText: '',
            table: parseTable(''),
            onPasteText,
          }),
        )
      })
      // Clicking a sample dataset loads it in one click
      const sampleBtn = [...host.querySelectorAll('button')].find(
        b => b.textContent === SAMPLE_DATASETS[0]!.label,
      )!
      await act(async () => { sampleBtn.click() })
      expect(onPasteText).toHaveBeenCalledWith(SAMPLE_DATASETS[0]!.csv, { resetChart: true })

      // Non-numeric table with Date column previews ISO date and applies without blocking
      const textarea = host.querySelector('textarea')!
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
      await act(async () => {
        setter.call(textarea, 'day,note\n2026-03-15,hello')
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(host.textContent).toContain('2026-03-15T00:00:00.000Z')
      const applyBtn = [...host.querySelectorAll('button')].find(b => b.textContent === 'Apply data')!
      await act(async () => { applyBtn.click() })
      expect(onPasteText).toHaveBeenCalledWith('day,note\n2026-03-15,hello')
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('allows clearing width/height in ExportPanel and exposes Copy PNG, Export CSV, and Export JSON', async () => {
    const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,20' })
    const fakeSession = {
      spec,
      table,
      figures: [],
      staleFigures: [],
      orphanedFigures: [],
      exportSvg: vi.fn(),
      exportPng: vi.fn(),
      rerenderFigures: vi.fn(),
      forgetFigure: vi.fn(),
    } as unknown as ChartSession

    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () => {
        root.render(createElement(ExportPanel, { session: fakeSession }))
      })
      const widthInput = host.querySelector<HTMLInputElement>('input[aria-label="Export width"]')!
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      await act(async () => {
        setter.call(widthInput, '')
        widthInput.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(widthInput.value).toBe('')
      expect(host.textContent).toContain('Copy PNG')
      expect(host.textContent).toContain('Export CSV')
      expect(host.textContent).toContain('Export JSON')
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('exposes chart reordering left/right in SheetView and keyboard navigation + Escape stopPropagation in SelectField', async () => {
    const table = parseTable('x,y\n1,10\n2,20')
    const spec = defaultSpec('Chart A')
    spec.chart.encodings = { x: 'x', y: ['y'], series: null }
    const sheet = {
      ...sheetFromSpec(spec),
      charts: [
        { id: 'c1', spec },
        { id: 'c2', spec: { ...spec, title: 'Chart B' } },
      ],
    }
    const onMove = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () => {
        root.render(
          createElement(SheetView, {
            sheet,
            table,
            onFocus: () => {},
            onAdd: () => {},
            onDuplicate: () => {},
            onRemove: () => {},
            onMove,
          }),
        )
      })
      const moveRight = host.querySelector<HTMLButtonElement>('button[aria-label="Move Chart A right"]')!
      const moveLeft = host.querySelector<HTMLButtonElement>('button[aria-label="Move Chart B left"]')!
      await act(async () => { moveRight.click() })
      expect(onMove).toHaveBeenCalledWith('c1', 1)
      await act(async () => { moveLeft.click() })
      expect(onMove).toHaveBeenCalledWith('c2', 0)

      // SelectField Escape stops propagation & keyboard ArrowDown works
      const windowEscape = vi.fn()
      window.addEventListener('keydown', windowEscape)
      const onChange = vi.fn()
      await act(async () => {
        root.render(
          createElement(SelectField, {
            label: 'Pick one',
            value: 'a',
            options: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }],
            onChange,
          }),
        )
      })
      const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Pick one"]')!
      await act(async () => { trigger.click() })
      const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      await act(async () => { document.dispatchEvent(esc) })
      expect(esc.defaultPrevented).toBe(true)
      window.removeEventListener('keydown', windowEscape)
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
