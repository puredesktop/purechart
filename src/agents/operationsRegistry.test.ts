// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { createChartAgentSpec } from '../lib/agentChartTools'
import { createChartProposal } from '../lib/chartProposal'
import {
  addChart as addChartToSheet,
  duplicateChart as duplicateChartInSheet,
  removeChart as removeChartFromSheet,
  sheetFromSpec,
  specForChart,
  withChart,
  type ChartSheet,
} from '../lib/chartSheet'
import type { ChartSpec } from '../lib/chartSpec'
import type { DataTable } from '../lib/dataParse'
import { PURECHART_ATOMIC_TOOL_SCHEMAS } from './atomicToolSchemas'
import {
  AgentChartToolError,
  EXPOSED_TOOL_NAMES,
  PURECHART_AGENT_TOOL_NAMES,
  PURECHART_ALL_ATOMIC_TOOL_NAMES,
  PURECHART_CORE_TOOL_NAMES,
  PURECHART_EXTENDED_TOOL_NAMES,
  PURECHART_FUNCTION_NAMES,
  type ChartAgentToolContext,
} from './catalog'
import {
  buildPureChartHandlers,
  PURECHART_OPERATIONS_REGISTRY,
} from './operationsRegistry'

const invoke = (shortName: string, args: Record<string, unknown> = {}) => ({
  toolCallId: `tc_${shortName}`,
  shortName,
  arguments: args,
})

const SAMPLE_CSV = [
  'month,region,revenue,units',
  '2026-01,North,100,10',
  '2026-02,North,140,14',
  '2026-03,North,210,19',
  '2026-04,North,300,25',
  '2026-01,South,120,12',
  '2026-02,South,115,11',
  '2026-03,South,160,15',
  '2026-04,South,190,18',
].join('\n')

function makeFixture(options?: {
  dataText?: string
  title?: string
  type?: ChartSpec['chart']['type']
  documentPath?: string | null
  mutateSpec?: (spec: ChartSpec) => ChartSpec
}) {
  const created = createChartAgentSpec({
    title: options?.title ?? 'Regional Revenue',
    dataText: options?.dataText ?? SAMPLE_CSV,
    format: 'csv',
    type: options?.type ?? 'line',
  })
  let table: DataTable = created.table
  let initialSpec: ChartSpec = created.spec
  if (
    !options?.dataText &&
    initialSpec.chart.encodings.x === 'month' &&
    initialSpec.chart.encodings.y.includes('revenue')
  ) {
    initialSpec = {
      ...initialSpec,
      chart: {
        ...initialSpec.chart,
        encodings: { x: 'month', y: ['revenue'], series: 'region' },
      },
    }
  }
  if (options?.mutateSpec) {
    initialSpec = options.mutateSpec(initialSpec)
  }

  let sheet: ChartSheet = sheetFromSpec(initialSpec)
  sheet = { ...sheet, focusedId: sheet.charts[0]!.id }
  let documentPath: string | null =
    options?.documentPath === undefined
      ? '/Work/RegionalRevenue.chart'
      : options.documentPath
  let status = 'Ready'

  const saveDocument = vi.fn(async () => documentPath ?? '/Work/Draft.chart')
  const deleteChartDocument = vi.fn(async (path: string) => {
    if (documentPath === path) documentPath = null
  })
  const openChartPath = vi.fn(async () => null as string | null)
  const exportSvg = vi.fn(async () => ({
    kind: 'file' as const,
    path: '/Work/RegionalRevenue.chart/assets/figures/regional-revenue.svg',
    linked: true,
  }))
  const exportPng = vi.fn(async () => ({
    kind: 'file' as const,
    path: '/Work/RegionalRevenue.chart/assets/figures/regional-revenue.png',
    linked: true,
  }))

  const ctx: ChartAgentToolContext = {
    get spec() {
      return specForChart(sheet, sheet.focusedId) ?? sheet.charts[0]!.spec
    },
    get table() {
      return table
    },
    get sheet() {
      return sheet
    },
    get documentPath() {
      return documentPath
    },
    get status() {
      return status
    },
    createDocument: vi.fn(async (nextSpec: ChartSpec, nextTable: DataTable) => {
      table = nextTable
      sheet = sheetFromSpec(nextSpec)
      sheet = { ...sheet, focusedId: sheet.charts[0]!.id }
      documentPath = null
      status = 'Chart created'
    }),
    proposeChart: vi.fn(input =>
      createChartProposal(
        sheet.focusedId,
        specForChart(sheet, sheet.focusedId) ?? sheet.charts[0]!.spec,
        table,
        input,
      ),
    ),
    addChart: vi.fn((nextSpec: ChartSpec, label?: string) => {
      const labeled = label ? { ...nextSpec, title: label } : nextSpec
      sheet = addChartToSheet(sheet, labeled)
    }),
    focusChart: vi.fn((id: string | null) => {
      sheet = { ...sheet, focusedId: id }
    }),
    removeChart: vi.fn((id: string) => {
      sheet = removeChartFromSheet(sheet, id)
    }),
    duplicateChart: vi.fn((id: string) => {
      sheet = duplicateChartInSheet(sheet, id)
    }),
    applyChartSpec: vi.fn((nextSpec: ChartSpec, opts) => {
      if (opts?.table) table = opts.table
      if (opts?.documentPath !== undefined) documentPath = opts.documentPath
      if (opts?.status) status = opts.status
      sheet = withChart(sheet, sheet.focusedId, nextSpec)
    }),
    openChartPath,
    saveDocument,
    deleteChartDocument,
    getChartSvg: () => null,
    exportSvg,
    exportPng,
  }

  const handlers = buildPureChartHandlers(() => ctx)
  return {
    ctx,
    handlers,
    getSheet: () => sheet,
    getSpec: () => ctx.spec,
    saveDocument,
    deleteChartDocument,
  }
}

describe('PureChart Operations Registry (Functions + Core + Extended Escape Hatch)', () => {
  it('syncs plugin.json 1:1 with PURECHART_OPERATIONS_REGISTRY.manifestTools and meets check-manifests invariants', async () => {
    const manifest = (
      await import('../../plugin.json', { with: { type: 'json' } })
    ).default as {
      app: {
        agents: {
          tools: Array<{
            name: string
            risk?: string
            requiresApproval?: boolean
            description?: string
            inputSchema?: { properties?: Record<string, unknown> }
          }>
        }
      }
    }

    expect(manifest.app.agents.tools).toEqual([
      ...PURECHART_OPERATIONS_REGISTRY.manifestTools,
    ])
    expect([...EXPOSED_TOOL_NAMES]).toEqual([
      ...PURECHART_OPERATIONS_REGISTRY.exposedToolNames,
    ])
    expect([...PURECHART_AGENT_TOOL_NAMES]).toEqual([...EXPOSED_TOOL_NAMES])
    expect([...PURECHART_EXTENDED_TOOL_NAMES].sort()).toEqual(
      [...PURECHART_OPERATIONS_REGISTRY.extendedToolNames].sort(),
    )
    expect([...PURECHART_ALL_ATOMIC_TOOL_NAMES].sort()).toEqual(
      [...PURECHART_OPERATIONS_REGISTRY.allAtomicToolNames].sort(),
    )

    const summary = PURECHART_OPERATIONS_REGISTRY.auditSummary()
    expect(summary.functions).toBe(PURECHART_FUNCTION_NAMES.length)
    expect(summary.functions).toBe(6)
    expect(summary.coreTools).toBe(PURECHART_CORE_TOOL_NAMES.length)
    expect(summary.coreTools).toBe(7)
    expect(summary.extendedTools).toBe(PURECHART_EXTENDED_TOOL_NAMES.length)
    expect(summary.extendedTools).toBe(24)
    expect(summary.metaTools).toBe(3)
    expect(summary.totalExposed).toBe(16)
    expect(summary.totalAtomicTools).toBe(31)
    expect(summary.schemaReductionPercent).toBeGreaterThanOrEqual(45)
    expect(PURECHART_ATOMIC_TOOL_SCHEMAS.length).toBe(31)

    const releaseVerbs = new Set([
      'send',
      'merge',
      'publish',
      'deposit',
      'deploy',
      'post',
    ])
    for (const tool of manifest.app.agents.tools) {
      expect(['read', 'write', 'destructive', 'external', 'release']).toContain(
        tool.risk,
      )
      expect(typeof tool.requiresApproval).toBe('boolean')
      expect((tool.description ?? '').trim().length).toBeGreaterThanOrEqual(80)
      const firstNameWord = tool.name
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .split(/[^A-Za-z]+/)
        .find(Boolean)
        ?.toLowerCase()
      const firstDescWord = (tool.description ?? '')
        .trim()
        .split(/[^A-Za-z]+/)
        .find(Boolean)
        ?.toLowerCase()
      if (tool.risk !== 'release') {
        expect(releaseVerbs.has(firstNameWord ?? '')).toBe(false)
        expect(releaseVerbs.has(firstDescWord ?? '')).toBe(false)
      }
      if (tool.inputSchema?.properties && 'path' in tool.inputSchema.properties) {
        expect(tool.description ?? '').toMatch(/call getChartContext first/i)
      }
    }
  })

  it('executes read composite functions: fn_chartWorkspaceBriefing, fn_auditAndDescribeChart, and fn_exportReadinessCheck', async () => {
    const { handlers, getSheet } = makeFixture()

    // 1. fn_chartWorkspaceBriefing
    const briefing = JSON.parse(
      (
        await handlers.fn_chartWorkspaceBriefing(
          invoke('fn_chartWorkspaceBriefing', { sampleRows: 4 }),
        )
      ).content,
    )
    expect(briefing.ok).toBe(true)
    expect(briefing.opClass).toBe('function')
    expect(briefing.data.documentPath).toBe('/Work/RegionalRevenue.chart')
    expect(briefing.data.sheet.chartCount).toBe(1)
    expect(briefing.data.data.rowCount).toBe(8)
    expect(briefing.data.data.sampleRows).toHaveLength(4)
    expect(briefing.data.data.truncated).toBe(true)
    const revProfile = briefing.data.data.columns.find(
      (c: { name: string }) => c.name === 'revenue',
    )
    expect(revProfile).toMatchObject({ min: 100, max: 300 })
    expect(briefing.data.suggestedForms.length).toBeGreaterThan(0)
    expect(briefing.data.suggestedForms[0].supported).toBe(true)

    // 2. fn_auditAndDescribeChart
    const audit = JSON.parse(
      (
        await handlers.fn_auditAndDescribeChart(
          invoke('fn_auditAndDescribeChart', { includePlottedPoints: true }),
        )
      ).content,
    )
    expect(audit.ok).toBe(true)
    expect(audit.data.review.blocking).toBe(0)
    expect(audit.data.spoken).toMatch(/Line chart/i)
    expect(audit.data.arithmeticFindings.length).toBeGreaterThan(0)
    expect(audit.data.plottedSeries).toHaveLength(2)
    expect(audit.data.plottedSeries[0].points.length).toBe(4)

    // Unknown chartId is rejected cleanly
    await expect(
      handlers.fn_auditAndDescribeChart(
        invoke('fn_auditAndDescribeChart', { chartId: 'does-not-exist' }),
      ),
    ).rejects.toThrow(AgentChartToolError)

    // Explicit valid chartId succeeds
    const firstChartId = getSheet().charts[0]!.id
    const byId = JSON.parse(
      (
        await handlers.fn_auditAndDescribeChart(
          invoke('fn_auditAndDescribeChart', { chartId: firstChartId }),
        )
      ).content,
    )
    expect(byId.data.chartId).toBe(firstChartId)

    // 3. fn_exportReadinessCheck (default directLabels: true is monochromeReady)
    const readiness = JSON.parse(
      (
        await handlers.fn_exportReadinessCheck(
          invoke('fn_exportReadinessCheck', {
            format: 'png',
            width: 900,
            height: 540,
            scale: 2,
            checkMonochrome: true,
          }),
        )
      ).content,
    )
    expect(readiness.ok).toBe(true)
    expect(readiness.data.readyToExport).toBe(true)
    expect(readiness.data.charts[0].monochromeReady).toBe(true)

    // With directLabels: false, checkMonochrome catches unlabelled mono print
    const unlabelled = makeFixture({
      mutateSpec: spec => ({
        ...spec,
        chart: {
          ...spec.chart,
          style: { ...spec.chart.style, directLabels: false },
        },
      }),
    })
    const monoWarn = JSON.parse(
      (
        await unlabelled.handlers.fn_exportReadinessCheck(
          invoke('fn_exportReadinessCheck', {
            format: 'svg',
            checkMonochrome: true,
          }),
        )
      ).content,
    )
    expect(monoWarn.data.readyToExport).toBe(true)
    expect(monoWarn.data.charts[0].monochromeReady).toBe(false)
    expect(monoWarn.data.charts[0].warnings.join(' ')).toMatch(/monochrome/i)

    // Invalid export dimensions block readiness
    const badSize = JSON.parse(
      (
        await handlers.fn_exportReadinessCheck(
          invoke('fn_exportReadinessCheck', {
            format: 'png',
            width: 10000,
            height: 10000,
            scale: 4,
          }),
        )
      ).content,
    )
    expect(badSize.data.readyToExport).toBe(false)
    expect(badSize.data.blockers.length).toBeGreaterThan(0)
  })

  it('executes fn_buildAndReviewChart in update and add modes with axes, trendline, autoCaption, and autoFixBlocking', async () => {
    const { handlers, getSpec, getSheet } = makeFixture()

    const built = JSON.parse(
      (
        await handlers.fn_buildAndReviewChart(
          invoke('fn_buildAndReviewChart', {
            title: 'Monthly Revenue by Region',
            type: 'line',
            x: 'month',
            y: ['revenue'],
            series: 'region',
            palette: 'mono',
            style: { grid: true, directLabels: false },
            axes: {
              x: { name: 'Month' },
              y: { name: 'Revenue', unit: 'NZ$', format: 'grouped' },
            },
            trendline: { kind: 'linear' },
            autoFixBlocking: true,
            autoCaptionFromFindings: true,
          }),
        )
      ).content,
    )
    expect(built.ok).toBe(true)
    expect(built.data.review.blocking).toBe(0)
    expect(built.data.autoAppliedFixes.join(' ')).toMatch(/mono-unlabelled/i)
    expect(getSpec().chart.style.directLabels).toBe(true)
    expect(getSpec().chart.axes.y).toMatchObject({
      name: 'Revenue',
      unit: 'NZ$',
      format: 'grouped',
    })
    expect(getSpec().chart.caption.length).toBeGreaterThan(10)
    expect(built.data.trendFits).toHaveLength(2)
    expect(built.data.trendFits[0].r2).toBeGreaterThan(0.9)

    // Add a second chart via autoSelectForm without disturbing the first
    const added = JSON.parse(
      (
        await handlers.fn_buildAndReviewChart(
          invoke('fn_buildAndReviewChart', {
            mode: 'add',
            autoSelectForm: true,
            title: 'Second Reading',
          }),
        )
      ).content,
    )
    expect(added.ok).toBe(true)
    expect(getSheet().charts).toHaveLength(2)

    // Sheet-wide readiness check covers both charts
    const sheetReadiness = JSON.parse(
      (
        await handlers.fn_exportReadinessCheck(
          invoke('fn_exportReadinessCheck', { scope: 'sheet' }),
        )
      ).content,
    )
    expect(sheetReadiness.data.charts).toHaveLength(2)

    // Refuses empty no-op update and invalid trendline on pie
    await expect(
      handlers.fn_buildAndReviewChart(invoke('fn_buildAndReviewChart', {})),
    ).rejects.toThrow(AgentChartToolError)

    await expect(
      handlers.fn_buildAndReviewChart(
        invoke('fn_buildAndReviewChart', {
          type: 'pie',
          x: 'region',
          y: ['revenue'],
          series: null,
          trendline: { kind: 'linear' },
        }),
      ),
    ).rejects.toThrow(AgentChartToolError)
  })

  it('executes fn_autoFixAndPolishChart to close Second Look loops and polish metadata', async () => {
    const { handlers, getSpec } = makeFixture({
      mutateSpec: spec => ({
        ...spec,
        chart: {
          ...spec.chart,
          style: { ...spec.chart.style, palette: 'mono', directLabels: false },
        },
      }),
    })

    const fixed = JSON.parse(
      (
        await handlers.fn_autoFixAndPolishChart(
          invoke('fn_autoFixAndPolishChart', {
            severity: 'blocking',
            title: 'Clean Print Revenue',
            axes: { y: { name: 'Revenue', unit: 'USD', format: 'compact' } },
            autoCaptionFromFindings: true,
          }),
        )
      ).content,
    )
    expect(fixed.ok).toBe(true)
    expect(fixed.data.beforeBlocking).toBe(1)
    expect(fixed.data.afterBlocking).toBe(0)
    expect(fixed.data.appliedFixes[0].findingId).toBe('mono-unlabelled')
    expect(getSpec().title).toBe('Clean Print Revenue')
    expect(getSpec().chart.style.directLabels).toBe(true)
    expect(getSpec().chart.axes.y.unit).toBe('USD')
    expect(getSpec().chart.caption.length).toBeGreaterThan(10)

    // Unfixable blocking finding (bars-truncated) is reported in skippedFindings
    const truncatedFixture = makeFixture({
      dataText: 'cat,val\nA,10\nB,20',
      type: 'bar',
      mutateSpec: spec => ({
        ...spec,
        chart: {
          ...spec.chart,
          encodings: { x: 'cat', y: ['val'], series: null },
          axes: {
            ...spec.chart.axes,
            y: { ...spec.chart.axes.y, min: 5 },
          },
        },
      }),
    })
    const skipped = JSON.parse(
      (
        await truncatedFixture.handlers.fn_autoFixAndPolishChart(
          invoke('fn_autoFixAndPolishChart', { severity: 'blocking' }),
        )
      ).content,
    )
    expect(skipped.data.skippedFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ findingId: 'bars-truncated' }),
      ]),
    )
  })

  it('executes fn_batchAnnotateChart with auto-resolved point/range values and all-or-nothing validation', async () => {
    const { handlers, getSpec } = makeFixture()

    const batch = JSON.parse(
      (
        await handlers.fn_batchAnnotateChart(
          invoke('fn_batchAnnotateChart', {
            annotations: [
              {
                text: 'North peak',
                target: {
                  kind: 'point',
                  seriesKey: 'North',
                  xLabel: '2026-04-01',
                },
              },
              {
                text: 'Q1 ramp',
                target: {
                  kind: 'range',
                  x: { from: '2026-01-01', to: '2026-03-01' },
                },
              },
            ],
          }),
        )
      ).content,
    )
    expect(batch.ok).toBe(true)
    expect(batch.data.addedCount).toBe(2)
    expect(batch.data.totalAnnotations).toBe(2)
    expect(getSpec().chart.annotations).toHaveLength(2)
    expect(getSpec().chart.annotations[0]!.target).toMatchObject({
      kind: 'point',
      seriesKey: 'North',
      value: 300,
    })
    expect(getSpec().chart.annotations[1]!.target).toMatchObject({
      kind: 'range',
      summary: expect.objectContaining({ count: 6, min: 100, max: 210 }),
    })

    // All-or-nothing: one bad target prevents any mutation
    await expect(
      handlers.fn_batchAnnotateChart(
        invoke('fn_batchAnnotateChart', {
          clearExisting: true,
          annotations: [
            {
              text: 'Valid',
              target: { kind: 'point', seriesKey: 'South', xLabel: '2026-02-01' },
            },
            {
              text: 'Invalid',
              target: { kind: 'point', seriesKey: 'South', xLabel: '2099-01-01' },
            },
          ],
        }),
      ),
    ).rejects.toThrow(AgentChartToolError)
    // Still has the previous 2 annotations untouched!
    expect(getSpec().chart.annotations).toHaveLength(2)

    // clearExisting: true with empty list clears all annotations cleanly
    const cleared = JSON.parse(
      (
        await handlers.fn_batchAnnotateChart(
          invoke('fn_batchAnnotateChart', {
            clearExisting: true,
            annotations: [],
          }),
        )
      ).content,
    )
    expect(cleared.data.totalAnnotations).toBe(0)
    expect(getSpec().chart.annotations).toHaveLength(0)
  })

  it('discovers and routes extended tools safely via discoverAppTools, callExtendedReadTool, and callExtendedTool', async () => {
    const { handlers, getSpec, deleteChartDocument } = makeFixture()

    // Discovery by query
    const discovered = JSON.parse(
      (
        await handlers.discoverAppTools(
          invoke('discoverAppTools', { query: 'trendline' }),
        )
      ).content,
    )
    expect(discovered.appSlug).toBe('chart')
    expect(
      discovered.operations.some(
        (op: { name: string }) => op.name === 'setChartTrendline',
      ),
    ).toBe(true)

    // Exact schema inspection via names
    const described = JSON.parse(
      (
        await handlers.discoverAppTools(
          invoke('discoverAppTools', {
            names: ['setChartEncodings', 'deleteChartDocument', 'listCharts'],
          }),
        )
      ).content,
    )
    expect(described.mode).toBe('describe')
    const encInfo = described.operations.find(
      (op: { name: string }) => op.name === 'setChartEncodings',
    )
    expect(encInfo.invokeVia).toBe('callExtendedTool')
    expect(encInfo.inputSchema.properties).toHaveProperty('limitSeries')

    const delInfo = described.operations.find(
      (op: { name: string }) => op.name === 'deleteChartDocument',
    )
    expect(delInfo.invokeVia).toBe('callExtendedTool')
    expect(delInfo.requiresConfirmDestructive).toBe(true)

    const listInfo = described.operations.find(
      (op: { name: string }) => op.name === 'listCharts',
    )
    expect(listInfo.invokeVia).toBe('callExtendedReadTool')

    // Read-only extended tool succeeds via callExtendedReadTool
    const chartsRes = JSON.parse(
      (
        await handlers.callExtendedReadTool(
          invoke('callExtendedReadTool', { tool: 'listCharts', arguments: {} }),
        )
      ).content,
    )
    expect(chartsRes.charts).toHaveLength(1)

    // Refusals on callExtendedReadTool: direct core tool & mutating extended tool
    await expect(
      handlers.callExtendedReadTool(
        invoke('callExtendedReadTool', { tool: 'getChartContext' }),
      ),
    ).rejects.toThrow(/already directly exposed/i)

    await expect(
      handlers.callExtendedReadTool(
        invoke('callExtendedReadTool', { tool: 'setChartTitle' }),
      ),
    ).rejects.toThrow(/cannot run through callExtendedReadTool/i)

    // Mutating extended tool succeeds via callExtendedTool
    const renamed = JSON.parse(
      (
        await handlers.callExtendedTool(
          invoke('callExtendedTool', {
            tool: 'setChartTitle',
            arguments: { title: 'Renamed via Extended' },
          }),
        )
      ).content,
    )
    expect(renamed.title).toBe('Renamed via Extended')
    expect(getSpec().title).toBe('Renamed via Extended')

    // Refusals on callExtendedTool: read-only tool, direct core tool, destructive without confirmDestructive
    await expect(
      handlers.callExtendedTool(
        invoke('callExtendedTool', { tool: 'listCharts' }),
      ),
    ).rejects.toThrow(/read-only/i)

    await expect(
      handlers.callExtendedTool(
        invoke('callExtendedTool', { tool: 'saveChart' }),
      ),
    ).rejects.toThrow(/already directly exposed/i)

    await expect(
      handlers.callExtendedTool(
        invoke('callExtendedTool', {
          tool: 'deleteChartDocument',
          arguments: { path: '/Work/RegionalRevenue.chart' },
        }),
      ),
    ).rejects.toThrow(/confirmDestructive: true/i)

    // Destructive extended tool succeeds when confirmDestructive: true is supplied
    const deleted = JSON.parse(
      (
        await handlers.callExtendedTool(
          invoke('callExtendedTool', {
            tool: 'deleteChartDocument',
            arguments: { path: '/Work/RegionalRevenue.chart' },
            confirmDestructive: true,
          }),
        )
      ).content,
    )
    expect(deleted.deleted).toBe('/Work/RegionalRevenue.chart')
    expect(deleteChartDocument).toHaveBeenCalledWith(
      '/Work/RegionalRevenue.chart',
    )
  })
})
