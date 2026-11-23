/**
 * High-level composite PureChart App Functions (`fn_*`).
 *
 * Each function collapses 3–11 atomic tool round-trips into one auditable call
 * using PureChart's own deterministic libraries (`agentChartTools`, `chartForms`,
 * `chartReview`, `chartFindings`, `chartLayout`, `chartFacet`, `chartOptions`,
 * `chartAnnotationValidation`, `chartRender`, `chartExport`, `chartTransform`,
 * `chartTheme`, `chartSheet`).
 */
import {
  defineAppFunction,
  type AppFunctionDefinition,
} from '@purescience/platform-ui/bridge/appFunctions'
import {
  AgentChartToolError,
  addChartAgentAnnotationSpec,
  chartAgentSpecView,
  clearChartAgentAnnotationsSpec,
  getChartAgentChangeSummary,
  getChartAgentContext,
  getChartAgentData,
  setChartPaletteAgentSpec,
  updateChartAgentSpec,
} from '../lib/agentChartTools'
import {
  annotationXPixel,
  validateChartAnnotations,
} from '../lib/chartAnnotationValidation'
import { validateChartExportSize } from '../lib/chartExport'
import { facetLayout, facetValues } from '../lib/chartFacet'
import { chartDescription, chartFindings } from '../lib/chartFindings'
import { applyForm, suggestForms } from '../lib/chartForms'
import {
  computeChartGeometry,
  extentOf,
  type ChartGeometry,
} from '../lib/chartLayout'
import { ChartOptionError, withTrendline } from '../lib/chartOptions'
import { DEFAULT_RENDER_SIZE, renderChartSvg } from '../lib/chartRender'
import {
  applyChartFix,
  facetCandidates,
  reviewChart,
  type ChartFix,
} from '../lib/chartReview'
import { specForChart } from '../lib/chartSheet'
import {
  CHART_TYPES,
  type ChartAnnotation,
  type ChartAxis,
  type ChartSpec,
} from '../lib/chartSpec'
import { chartPalette, paletteCapacity } from '../lib/chartTheme'
import { transformChartData } from '../lib/chartTransform'
import type { TrendSpec } from '../lib/chartTrend'
import type { DataTable } from '../lib/dataParse'
import type { ChartAgentToolContext } from './context'

const AXIS_FORMATS: readonly ChartAxis['format'][] = [
  'plain',
  'grouped',
  'percent',
  'compact',
]

const DAY_LABEL_RE = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/

let batchAnnotationSequence = 0

function isObj(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asStr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asFiniteNum(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function roundStat(value: number): number {
  return Math.round(value * 1000) / 1000
}

function dayOf(label: string): string | null {
  return DAY_LABEL_RE.exec(label)?.[1] ?? null
}

function profileTableColumns(table: DataTable) {
  return table.columns.map(column => {
    let nonNull = 0
    let missing = 0
    const distinct = new Set<string>()
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let sum = 0
    let numericCount = 0

    for (const row of table.rows) {
      const cell = row[column.name]
      if (cell === null || cell === undefined || cell === '') {
        missing += 1
        continue
      }
      nonNull += 1
      if (cell instanceof Date) {
        distinct.add(cell.toISOString())
      } else if (typeof cell === 'number' && Number.isFinite(cell)) {
        distinct.add(String(cell))
        numericCount += 1
        if (cell < min) min = cell
        if (cell > max) max = cell
        sum += cell
      } else {
        distinct.add(String(cell))
      }
    }

    const base = {
      name: column.name,
      type: column.type,
      nonNull,
      missing,
      distinctCount: distinct.size,
    }
    if (column.type === 'number' && numericCount > 0) {
      return {
        ...base,
        min: roundStat(min),
        max: roundStat(max),
        mean: roundStat(sum / numericCount),
      }
    }
    return {
      ...base,
      sampleValues: [...distinct].slice(0, 8),
    }
  })
}

function resolveSpecForInspection(
  ctx: ChartAgentToolContext,
  chartId?: string,
): { id: string | null; spec: ChartSpec } {
  if (!chartId) {
    return { id: ctx.sheet.focusedId, spec: ctx.spec }
  }
  const spec = specForChart(ctx.sheet, chartId)
  if (!spec) {
    throw new AgentChartToolError(
      `There is no chart "${chartId}" on this sheet. Available charts: ${
        ctx.sheet.charts.map(c => `${c.id} (${c.spec.title})`).join(', ') || 'none'
      }.`,
    )
  }
  return { id: chartId, spec }
}

function summarizeGeometrySeries(
  geometry: ChartGeometry,
  includePoints: boolean,
) {
  return geometry.series.map(series => {
    const pts =
      series.points.length > 0
        ? series.points.map(p => ({ xLabel: p.xLabel, value: p.value }))
        : series.bars.map((bar, idx) => ({
            xLabel: String(idx),
            value: bar.value,
          }))

    let minPt: { xLabel: string; value: number } | null = null
    let maxPt: { xLabel: string; value: number } | null = null
    for (const pt of pts) {
      if (!minPt || pt.value < minPt.value) minPt = pt
      if (!maxPt || pt.value > maxPt.value) maxPt = pt
    }

    return {
      key: series.key,
      color: series.color,
      pointCount: pts.length,
      first: pts[0] ?? null,
      last: pts[pts.length - 1] ?? null,
      min: minPt,
      max: maxPt,
      ...(series.trend
        ? {
            trend: series.trend.error
              ? { error: series.trend.error }
              : {
                  equation: series.trend.equation,
                  r2: series.trend.r2,
                },
          }
        : {}),
      ...(includePoints ? { points: pts.slice(0, 50) } : {}),
    }
  })
}

function editorialHygiene(spec: ChartSpec) {
  const title = spec.title.trim()
  const hasDefaultTitle =
    !title || /^untitled\b/i.test(title) || /^chart of\b/i.test(title)
  const paletteInfo = chartPalette(
    spec.chart.style.palette,
    spec.chart.style.customPalettes,
  )
  return {
    title,
    hasDefaultTitle,
    xAxisNamed: Boolean(spec.chart.axes.x.name?.trim()),
    yAxisNamed: Boolean(spec.chart.axes.y.name?.trim()),
    yAxisHasUnit: Boolean(spec.chart.axes.y.unit?.trim()),
    hasCaption: Boolean(spec.chart.caption.trim()),
    annotationCount: spec.chart.annotations.length,
    isMonochrome: Boolean(paletteInfo.monochrome),
    directLabels: spec.chart.style.directLabels,
  }
}

function applyAxisPatch(
  spec: ChartSpec,
  axisKey: 'x' | 'y',
  raw: Record<string, unknown>,
): ChartSpec {
  const format = asStr(raw.format)
  if (format && !AXIS_FORMATS.includes(format as ChartAxis['format'])) {
    throw new AgentChartToolError(
      `axes.${axisKey}.format must be one of: ${AXIS_FORMATS.join(', ')}.`,
    )
  }
  const current = spec.chart.axes[axisKey]
  const hasName =
    Object.hasOwn(raw, 'name') &&
    (typeof raw.name === 'string' || raw.name === null)
  const hasUnit =
    Object.hasOwn(raw, 'unit') &&
    (typeof raw.unit === 'string' || raw.unit === null)
  const nextAxis: ChartAxis = {
    ...current,
    name: hasName
      ? typeof raw.name === 'string' && raw.name.trim() !== ''
        ? raw.name.trim()
        : null
      : current.name,
    unit: hasUnit
      ? typeof raw.unit === 'string' && raw.unit.trim() !== ''
        ? raw.unit.trim()
        : null
      : current.unit,
    format: (format as ChartAxis['format'] | undefined) ?? current.format,
  }
  return {
    ...spec,
    chart: {
      ...spec.chart,
      axes: { ...spec.chart.axes, [axisKey]: nextAxis },
    },
  }
}

function isActionableDrawingFix(fix: ChartFix): boolean {
  return fix.kind !== 'table' && fix.kind !== 'name-axis'
}

function buildGroundedCaption(table: DataTable, spec: ChartSpec): string {
  const findings = chartFindings(table, spec)
  if (findings.length === 0) return ''
  return findings
    .slice(0, 2)
    .map(f => f.text)
    .join(' ')
}

function serializeReview(review: ReturnType<typeof reviewChart>) {
  return {
    blocking: review.findings.filter(f => f.severity === 'blocking').length,
    checks: review.findings.filter(f => f.severity === 'check').length,
    notes: review.findings.filter(f => f.severity === 'note').length,
    findings: review.findings.map((finding, index) => ({
      index,
      id: finding.id,
      severity: finding.severity,
      title: finding.title,
      detail: finding.detail,
      about: finding.about,
      fixes: finding.fixes.map((fix, fixIndex) => ({
        index: fixIndex,
        kind: fix.kind,
        label: fix.label,
      })),
    })),
    cleared: review.cleared,
    colour: review.colour,
  }
}

function resolveBatchAnnotation(
  raw: Record<string, unknown>,
  geometries: ChartGeometry[],
): ChartAnnotation {
  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text) {
    throw new AgentChartToolError('Every annotation requires non-empty "text".')
  }
  const rawTarget = isObj(raw.target) ? raw.target : null
  if (!rawTarget) {
    throw new AgentChartToolError(
      `Annotation "${text}" is missing a "target" object.`,
    )
  }
  const kind = rawTarget.kind
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `agent-${Date.now().toString(36)}-${(++batchAnnotationSequence).toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.trim()
      ? raw.createdAt
      : new Date().toISOString()

  if (kind === 'point') {
    const seriesKey = asStr(rawTarget.seriesKey)
    const xLabel =
      typeof rawTarget.xLabel === 'string' ? rawTarget.xLabel.trim() : ''
    if (!seriesKey || !xLabel) {
      throw new AgentChartToolError(
        `Point annotation "${text}" requires "seriesKey" and "xLabel".`,
      )
    }
    let value = asFiniteNum(rawTarget.value)
    if (value === undefined) {
      const matched: number[] = []
      const day = dayOf(xLabel)
      for (const geo of geometries) {
        for (const series of geo.series) {
          if (series.key !== seriesKey) continue
          const exact = series.points.filter(p => p.xLabel === xLabel)
          const candidates =
            exact.length > 0
              ? exact
              : day
                ? series.points.filter(p => p.xLabel === day)
                : []
          for (const pt of candidates) matched.push(pt.value)
        }
      }
      if (matched.length === 0) {
        throw new AgentChartToolError(
          `Point annotation "${text}" could not find a plotted point for series "${seriesKey}" at xLabel "${xLabel}".`,
        )
      }
      value = matched[0]!
    }
    return {
      id,
      text,
      createdAt,
      target: {
        kind: 'point',
        seriesKey,
        xLabel,
        value,
      },
    }
  }

  if (kind === 'range') {
    const rawX = isObj(rawTarget.x) ? rawTarget.x : null
    const xFrom = rawX ? asStr(rawX.from) : undefined
    const xTo = rawX ? asStr(rawX.to) : undefined
    if (!xFrom || !xTo) {
      throw new AgentChartToolError(
        `Range annotation "${text}" requires target.x.from and target.x.to.`,
      )
    }
    const rawY = isObj(rawTarget.y) ? rawTarget.y : null
    let yFrom = rawY ? asFiniteNum(rawY.from) : undefined
    let yTo = rawY ? asFiniteNum(rawY.to) : undefined

    const spanPoints = geometries
      .flatMap(g => {
        const fromPx = annotationXPixel(g, xFrom)
        const toPx = annotationXPixel(g, xTo)
        if (fromPx === null || toPx === null) return []
        const lo = Math.min(fromPx, toPx)
        const hi = Math.max(fromPx, toPx)
        return g.series
          .flatMap(s => s.points)
          .filter(
            p =>
              p.cx >= lo &&
              p.cx <= hi &&
              (yFrom === undefined || p.value >= yFrom) &&
              (yTo === undefined || p.value <= yTo),
          )
      })
      .sort((a, b) => a.cx - b.cx)

    if (spanPoints.length === 0) {
      throw new AgentChartToolError(
        `Range annotation "${text}" (${xFrom}..${xTo}) contains no plotted points.`,
      )
    }

    const values = spanPoints.map(p => p.value)
    const [min, max] = extentOf(values)
    if (yFrom === undefined) yFrom = min
    if (yTo === undefined) yTo = max

    const rawSummary = isObj(rawTarget.summary) ? rawTarget.summary : null
    const summary = rawSummary
      ? {
          count: asFiniteNum(rawSummary.count) ?? values.length,
          min: asFiniteNum(rawSummary.min) ?? min,
          max: asFiniteNum(rawSummary.max) ?? max,
          average:
            asFiniteNum(rawSummary.average) ??
            values.reduce((s, v) => s + v, 0) / values.length,
          change:
            asFiniteNum(rawSummary.change) ??
            values[values.length - 1]! - values[0]!,
        }
      : {
          count: values.length,
          min,
          max,
          average: values.reduce((s, v) => s + v, 0) / values.length,
          change: values[values.length - 1]! - values[0]!,
        }

    return {
      id,
      text,
      createdAt,
      target: {
        kind: 'range',
        x: { from: xFrom, to: xTo },
        y: { from: yFrom, to: yTo },
        summary,
      },
    }
  }

  throw new AgentChartToolError(
    `Annotation "${text}" target.kind must be "point" or "range".`,
  )
}

export const PURECHART_FUNCTIONS: readonly AppFunctionDefinition<ChartAgentToolContext>[] = [
  // 1. Complete Workspace, Sheet, Data Profile & Form Recommendations Briefing (Read)
  defineAppFunction<ChartAgentToolContext>({
    name: 'fn_chartWorkspaceBriefing',
    category: 'workspace',
    risk: 'read',
    requiresApproval: false,
    replaces: [
      'getChartContext',
      'getChartSpec',
      'listCharts',
      'getChartData',
      'suggestChartForms',
    ],
    description:
      'Read a complete single-call PureChart workspace briefing: open document path, every chart on the sheet with Second Look finding counts, focused chart spec and active transform summary, per-column statistical profiles, sample data rows, and ranked chart form recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        sampleRows: {
          type: 'number',
          description:
            'Number of sample data rows to include (default 10, max 100, 0 to omit rows).',
        },
        includeFormSuggestions: {
          type: 'boolean',
          description:
            'Include ranked chart form recommendations from the current table (default true).',
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const requestedRows = asFiniteNum(args.sampleRows)
      const sampleRowLimit =
        requestedRows === undefined
          ? 10
          : Math.max(0, Math.min(100, Math.floor(requestedRows)))
      const includeForms = args.includeFormSuggestions !== false

      const sheet = ctx.sheet
      const contextSnapshot = getChartAgentContext({
        spec: ctx.spec,
        table: ctx.table,
        documentPath: ctx.documentPath,
        status: ctx.status,
      })
      const specView = chartAgentSpecView(ctx.spec, ctx.table)
      const dataSample = getChartAgentData(ctx.spec, ctx.table, sampleRowLimit)
      const columnProfiles = profileTableColumns(ctx.table)
      const transform = transformChartData(ctx.table, ctx.spec)
      const palette = chartPalette(sheet.palette.id, sheet.palette.custom)
      const capacity = paletteCapacity(sheet.palette.id, sheet.palette.custom)

      const charts = sheet.charts.map((chart, index) => {
        const chartSpec = specForChart(sheet, chart.id)
        if (!chartSpec) {
          throw new AgentChartToolError(
            `There is no chart "${chart.id}" on this sheet.`,
          )
        }
        const review = reviewChart(ctx.table, chartSpec)
        return {
          index,
          id: chart.id,
          name: chartSpec.title,
          type: chartSpec.chart.type,
          encodings: chartSpec.chart.encodings,
          facet: chartSpec.chart.facet.column,
          caption: chartSpec.chart.caption,
          blocking: review.findings.filter(f => f.severity === 'blocking')
            .length,
          checks: review.findings.filter(f => f.severity === 'check').length,
        }
      })

      const forms = includeForms
        ? suggestForms(ctx.table, { paletteCapacity: capacity }).map(
            (form, index) => ({
              index,
              type: form.type,
              job: form.job,
              because: form.because,
              supported: form.supported,
              encodings: form.encodings,
              facet: form.facet,
            }),
          )
        : undefined

      return {
        mutated: false,
        summary: `Workspace "${sheet.title || 'Untitled'}" (${charts.length} chart${charts.length === 1 ? '' : 's'}, ${ctx.table.rows.length} rows × ${ctx.table.columns.length} cols, focused: ${ctx.spec.chart.type}).`,
        data: {
          documentPath: contextSnapshot.documentPath,
          status: contextSnapshot.status,
          sheet: {
            title: sheet.title,
            focusedId: sheet.focusedId,
            onSheet: sheet.focusedId === null,
            palette: {
              id: palette.id,
              label: palette.label,
              capacity,
              monochrome: Boolean(palette.monochrome),
              customCount: sheet.palette.custom.length,
            },
            chartCount: charts.length,
            charts,
          },
          focusedChart: {
            spec: specView,
            transformSummary: transform.summary,
            editorial: editorialHygiene(ctx.spec),
          },
          data: {
            mode: dataSample.mode,
            sourcePath: dataSample.sourcePath,
            format: dataSample.format,
            rowCount: dataSample.rowCount,
            columnCount: dataSample.columnCount,
            columns: columnProfiles,
            sampleRows: dataSample.rows,
            truncated: dataSample.truncated,
          },
          ...(forms ? { suggestedForms: forms } : {}),
        },
      }
    },
  }),

  // 2. Full Second Look Visual/Accessibility Audit + Arithmetic Dossier (Read)
  defineAppFunction<ChartAgentToolContext>({
    name: 'fn_auditAndDescribeChart',
    category: 'audit',
    risk: 'read',
    requiresApproval: false,
    replaces: ['reviewChart', 'describeChart', 'getChartSpec'],
    description:
      'Audit a chart with Second Look perceptual colour/accessibility measurements (OKLab distances, simulated protanopia/deuteranopia, surface contrast, zero-baseline bars, label collisions) and return its exact arithmetic findings, screen-reader description, plotted series coordinates, trend fits, and editorial hygiene in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        chartId: {
          type: 'string',
          description:
            'Optional chart id from the sheet to inspect without changing focus. Defaults to the focused chart.',
        },
        includePlottedPoints: {
          type: 'boolean',
          description:
            'Include up to 50 plotted (xLabel, value) points per series for exact annotation targeting (default false).',
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const { id, spec } = resolveSpecForInspection(ctx, asStr(args.chartId))
      const includePoints = args.includePlottedPoints === true
      const dims = { width: 900, height: 540 }
      const geometry = computeChartGeometry(ctx.table, spec, dims)
      const facets = facetLayout(ctx.table, spec, dims)
      const review = reviewChart(ctx.table, spec, geometry)
      const findings = chartFindings(ctx.table, spec, geometry)
      const spoken = chartDescription(ctx.table, spec, geometry)
      const reviewSummary = serializeReview(review)

      return {
        mutated: false,
        summary: `Audit "${spec.title}" (${spec.chart.type}): ${reviewSummary.blocking} blocking, ${reviewSummary.checks} check(s), ${findings.length} arithmetic finding(s).`,
        data: {
          chartId: id,
          title: spec.title,
          type: spec.chart.type,
          encodings: spec.chart.encodings,
          facet: spec.chart.facet,
          axes: spec.chart.axes,
          caption: spec.chart.caption,
          empty: geometry.empty,
          ...(geometry.empty && geometry.message
            ? { emptyReason: geometry.message }
            : {}),
          review: reviewSummary,
          spoken,
          arithmeticFindings: findings,
          plottedSeries: summarizeGeometrySeries(geometry, includePoints),
          ...(facets
            ? {
                facetPanels: {
                  count: facets.panels.length,
                  column: spec.chart.facet.column,
                  values: facets.panels.slice(0, 24).map(p => p.value),
                },
              }
            : {}),
          editorial: editorialHygiene(spec),
        },
      }
    },
  }),

  // 3. Coordinated Chart Authoring, Styling, Axes, Facet, Trendline & Review (Write)
  defineAppFunction<ChartAgentToolContext>({
    name: 'fn_buildAndReviewChart',
    category: 'design',
    risk: 'write',
    requiresApproval: false,
    replaces: [
      'suggestChartForms',
      'chooseChartForm',
      'setChartTitle',
      'setChartType',
      'setChartEncodings',
      'setChartPalette',
      'setChartStyle',
      'setChartAxis',
      'facetChart',
      'setChartTrendline',
      'setChartCaption',
      'updateChart',
      'reviewChart',
      'describeChart',
    ],
    description:
      'Configure or add a publication-ready chart in one coordinated call: optionally pick a supported chart form, set title, type, encodings, palette, style, x/y axis labels and units, faceting, trendline, and caption (or auto-generate a data-grounded caption), optionally auto-fix blocking Second Look issues, and immediately return the measured review and arithmetic findings.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['update', 'add'],
          description:
            'Update the focused chart (default "update") or add a new chart to the sheet ("add") while keeping existing charts intact.',
        },
        formIndex: {
          type: 'number',
          description:
            'Optional index from fn_chartWorkspaceBriefing / suggestChartForms to seed type, encodings, and facet from a validated candidate.',
        },
        autoSelectForm: {
          type: 'boolean',
          description:
            'When true and formIndex is omitted, start from the highest-ranked supported chart form for the current table.',
        },
        title: { type: 'string' },
        type: {
          type: 'string',
          enum: [...CHART_TYPES],
        },
        x: { type: ['string', 'null'] },
        y: { type: 'array', items: { type: 'string' } },
        series: { type: ['string', 'null'] },
        size: { type: ['string', 'null'] },
        limitSeries: { type: 'number' },
        palette: {
          type: 'string',
          description:
            'Built-in palette id (science, quiet, meadow, ember, mono) or existing custom palette id.',
        },
        customPalette: {
          type: 'object',
          description: 'Create and select a custom palette: { label?, palette?, colors: string[] (#RRGGBB) }.',
        },
        style: {
          type: 'object',
          description: 'Partial style overrides: { rangeFrame?, grid?, directLabels?, rug?, strokeWidth?, pointRadius? }.',
        },
        axes: {
          type: 'object',
          description: 'Optional { x?: { name?, unit?, format? }, y?: { name?, unit?, format? } } (format: plain|grouped|percent|compact).',
        },
        facet: {
          type: 'object',
          description: 'Optional { column: string | null, columns?: number } to split into small multiples or clear faceting.',
        },
        trendline: {
          type: 'object',
          description: 'Optional { kind: "none"|"linear"|"exponential"|"polynomial", degree?: 2|3 }.',
        },
        caption: {
          type: 'string',
          description:
            'Explicit caption sentence under the chart (empty string clears it).',
        },
        autoCaptionFromFindings: {
          type: 'boolean',
          description:
            'When true (and caption is not provided), compose a data-grounded caption directly from the chart’s computed arithmetic findings.',
        },
        autoFixBlocking: {
          type: 'boolean',
          description:
            'When true, automatically apply deterministic Second Look fixes for any blocking findings before saving.',
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const mode = args.mode === 'add' ? 'add' : 'update'
      let spec = ctx.spec
      const appliedSteps: string[] = []

      // 1. Optional palette first so form suggestions use the target palette capacity
      if (isObj(args.customPalette)) {
        const cp = args.customPalette
        spec = setChartPaletteAgentSpec(spec, {
          palette: asStr(cp.palette),
          label: asStr(cp.label),
          colors: Array.isArray(cp.colors) ? (cp.colors as string[]) : [],
        })
        appliedSteps.push(`customPalette:${spec.chart.style.palette}`)
      } else if (asStr(args.palette)) {
        spec = setChartPaletteAgentSpec(spec, { palette: asStr(args.palette) })
        appliedSteps.push(`palette:${spec.chart.style.palette}`)
      }

      // 2. Optional form selection from suggestForms
      const formIndex = asFiniteNum(args.formIndex)
      if (formIndex !== undefined || args.autoSelectForm === true) {
        const forms = suggestForms(ctx.table, {
          paletteCapacity: paletteCapacity(
            spec.chart.style.palette,
            spec.chart.style.customPalettes,
          ),
        })
        if (forms.length === 0) {
          throw new AgentChartToolError(
            'There is no data to suggest a chart form for. Load or create chart data first.',
          )
        }
        const chosen =
          formIndex !== undefined
            ? forms[Math.trunc(formIndex)]
            : forms.find(f => f.supported)
        if (!chosen) {
          throw new AgentChartToolError(
            formIndex !== undefined
              ? `formIndex ${formIndex} is out of range (0–${forms.length - 1}).`
              : 'This table has no supported chart forms.',
          )
        }
        if (!chosen.supported) {
          throw new AgentChartToolError(
            `This table cannot support form ${formIndex} (${chosen.type}): ${chosen.because}`,
          )
        }
        spec = { ...applyForm(spec, chosen), title: chosen.job }
        appliedSteps.push(`form:${chosen.type}`)
      }

      // 3. Partial spec update (title, type, encodings, style, size, limitSeries)
      const hasCoreUpdate =
        args.title !== undefined ||
        args.type !== undefined ||
        args.x !== undefined ||
        args.y !== undefined ||
        args.series !== undefined ||
        args.size !== undefined ||
        args.limitSeries !== undefined ||
        isObj(args.style)

      if (hasCoreUpdate) {
        const limitSeries =
          args.limitSeries !== undefined
            ? args.limitSeries === null
              ? 0
              : typeof args.limitSeries === 'number'
                ? args.limitSeries
                : Number.NaN
            : undefined

        const readNullableCol = (field: 'x' | 'series' | 'size') => {
          const val = args[field]
          if (val === undefined) return undefined
          if (val === null) return null
          if (typeof val === 'string') return val
          throw new AgentChartToolError(`"${field}" must be a column name string or null.`)
        }

        spec = updateChartAgentSpec(spec, ctx.table, {
          title: typeof args.title === 'string' ? args.title : undefined,
          type: asStr(args.type) as ChartSpec['chart']['type'] | undefined,
          x: readNullableCol('x'),
          y: Array.isArray(args.y)
            ? args.y.filter((v): v is string => typeof v === 'string')
            : undefined,
          series: readNullableCol('series'),
          size: readNullableCol('size'),
          limitSeries,
          style: isObj(args.style)
            ? (args.style as Partial<ChartSpec['chart']['style']>)
            : undefined,
        })
        appliedSteps.push('spec')
      }

      // 4. Axes
      if (isObj(args.axes)) {
        if (isObj(args.axes.x)) {
          spec = applyAxisPatch(spec, 'x', args.axes.x)
          appliedSteps.push('axis:x')
        }
        if (isObj(args.axes.y)) {
          spec = applyAxisPatch(spec, 'y', args.axes.y)
          appliedSteps.push('axis:y')
        }
      }

      // 5. Facet
      if (isObj(args.facet)) {
        const col =
          args.facet.column === null ||
          (typeof args.facet.column === 'string' && args.facet.column.trim() === '')
            ? null
            : asStr(args.facet.column)
        if (col === null) {
          spec = {
            ...spec,
            chart: {
              ...spec.chart,
              facet: { ...spec.chart.facet, column: null },
            },
          }
          appliedSteps.push('facet:clear')
        } else if (col !== undefined) {
          if (!ctx.table.columns.some(c => c.name === col)) {
            const candidates = facetCandidates(ctx.table, spec)
            throw new AgentChartToolError(
              `Unknown facet column "${col}". Facetable columns: ${
                candidates.join(', ') || 'none'
              }.`,
            )
          }
          const vals = facetValues(ctx.table, col)
          if (vals.length < 2) {
            throw new AgentChartToolError(
              `Facet column "${col}" needs at least 2 distinct values (found ${vals.length}).`,
            )
          }
          const cols = asFiniteNum(args.facet.columns)
          spec = {
            ...spec,
            chart: {
              ...spec.chart,
              facet: {
                column: col,
                columns:
                  cols === undefined
                    ? spec.chart.facet.columns
                    : Math.max(0, Math.round(cols)),
              },
            },
          }
          appliedSteps.push(`facet:${col}`)
        }
      }

      // 6. Trendline
      if (isObj(args.trendline)) {
        const kind = asStr(args.trendline.kind)
        if (!kind) {
          throw new AgentChartToolError(
            'trendline.kind is required (none, linear, exponential, polynomial).',
          )
        }
        const degree = Number(args.trendline.degree) === 3 ? 3 : 2
        const trend: TrendSpec | null =
          kind === 'none'
            ? null
            : kind === 'polynomial'
              ? { kind, degree }
              : { kind: kind as TrendSpec['kind'] }
        try {
          spec = withTrendline(spec, trend)
        } catch (error) {
          if (error instanceof ChartOptionError) {
            throw new AgentChartToolError(error.message)
          }
          throw error
        }
        appliedSteps.push(`trendline:${kind}`)
      }

      // 7. Optional auto-fix pass for blocking Second Look findings
      const autoAppliedFixes: string[] = []
      if (args.autoFixBlocking === true) {
        const attempted = new Set<string>()
        for (let round = 0; round < 3; round += 1) {
          const rev = reviewChart(ctx.table, spec)
          const blocking = rev.findings.find(
            f =>
              f.severity === 'blocking' &&
              f.fixes.some(isActionableDrawingFix) &&
              !attempted.has(f.id),
          )
          if (!blocking) break
          const fix = blocking.fixes.find(isActionableDrawingFix)!
          attempted.add(blocking.id)
          spec = applyChartFix(spec, fix)
          autoAppliedFixes.push(`${blocking.id}: ${fix.label}`)
        }
      }

      // 8. Caption (explicit or auto-grounded from arithmetic findings)
      if (typeof args.caption === 'string') {
        spec = {
          ...spec,
          chart: { ...spec.chart, caption: args.caption.trim() },
        }
        appliedSteps.push('caption')
      } else if (args.autoCaptionFromFindings === true) {
        const generated = buildGroundedCaption(ctx.table, spec)
        if (generated) {
          spec = {
            ...spec,
            chart: { ...spec.chart, caption: generated },
          }
          appliedSteps.push('caption:auto')
        }
      }

      if (appliedSteps.length === 0 && autoAppliedFixes.length === 0 && mode !== 'add') {
        throw new AgentChartToolError(
          'Provide at least one chart change (formIndex, autoSelectForm, title, type, x, y, series, palette, style, axes, facet, trendline, caption, or autoFixBlocking).',
        )
      }

      const status =
        mode === 'add'
          ? `Added chart: ${spec.title}`
          : `Updated chart: ${spec.title}`
      if (mode === 'add') {
        ctx.addChart(spec, spec.title)
        // Palette belongs to the sheet; if this call changed the palette (directly
        // or via autoFixBlocking), persist the sheet palette onto the newly focused chart.
        if (
          ctx.spec.chart.style.palette !== spec.chart.style.palette ||
          ctx.spec.chart.style.customPalettes !== spec.chart.style.customPalettes
        ) {
          ctx.applyChartSpec(spec, { table: ctx.table, status })
        }
      } else {
        ctx.applyChartSpec(spec, { table: ctx.table, status })
      }

      const geometry = computeChartGeometry(ctx.table, spec, {
        width: 900,
        height: 540,
      })
      const review = serializeReview(reviewChart(ctx.table, spec, geometry))
      const findings = chartFindings(ctx.table, spec, geometry)
      const trendFits = spec.chart.presentation?.trendline
        ? geometry.series.map(s => ({
            series: s.key,
            ...(s.trend?.error
              ? { error: s.trend.error }
              : {
                  equation: s.trend?.equation ?? null,
                  r2: s.trend?.r2 ?? null,
                }),
          }))
        : []

      return {
        mutated: true,
        summary: `${mode === 'add' ? 'Added' : 'Configured'} "${spec.title}" (${spec.chart.type}, ${review.blocking} blocking, ${review.checks} check(s)).`,
        data: {
          mode,
          appliedSteps,
          autoAppliedFixes,
          chart: getChartAgentChangeSummary({
            spec,
            table: ctx.table,
            documentPath: ctx.documentPath,
            status,
          }),
          axes: spec.chart.axes,
          facet: spec.chart.facet,
          caption: spec.chart.caption,
          review,
          arithmeticFindings: findings,
          ...(trendFits.length > 0 ? { trendFits } : {}),
        },
      }
    },
  }),

  // 4. Close the Second Look Quality Loop + Polish Axes/Caption (Write)
  defineAppFunction<ChartAgentToolContext>({
    name: 'fn_autoFixAndPolishChart',
    category: 'audit',
    risk: 'write',
    requiresApproval: false,
    replaces: [
      'reviewChart',
      'applyChartFix',
      'describeChart',
      'setChartCaption',
      'setChartAxis',
      'setChartStyle',
    ],
    description:
      'Resolve Second Look visual and accessibility findings on the focused chart in one deterministic pass, optionally polishing axis names/units, title, and a data-grounded caption from computed arithmetic findings. Returns before/after blocking counts, every fix applied, and any remaining findings.',
    inputSchema: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['blocking', 'all'],
          description:
            'Fix only "blocking" findings (default) or "all" fixable blocking and check findings.',
        },
        findingIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional exact finding IDs to target instead of fixing all findings at the chosen severity.',
        },
        title: {
          type: 'string',
          description: 'Optional refined chart title.',
        },
        axes: {
          type: 'object',
          description:
            'Optional { x?: { name?, unit?, format? }, y?: { name?, unit?, format? } } (format: plain|grouped|percent|compact).',
        },
        caption: {
          type: 'string',
          description: 'Optional explicit caption sentence.',
        },
        autoCaptionFromFindings: {
          type: 'boolean',
          description:
            'When true and caption is omitted, generate a grounded caption from computed arithmetic findings.',
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const severity = args.severity === 'all' ? 'all' : 'blocking'
      const targetIds = Array.isArray(args.findingIds)
        ? new Set(
            args.findingIds.filter(
              (v): v is string => typeof v === 'string' && v.trim().length > 0,
            ),
          )
        : null

      let spec = ctx.spec
      const beforeReview = reviewChart(ctx.table, spec)
      const beforeBlocking = beforeReview.findings.filter(
        f => f.severity === 'blocking',
      ).length

      const appliedFixes: Array<{ findingId: string; label: string; kind: string }> = []
      const skippedFindings: Array<{ findingId: string; reason: string }> = []
      const attempted = new Set<string>()

      for (let round = 0; round < 5; round += 1) {
        const currentReview = reviewChart(ctx.table, spec)
        const candidates = currentReview.findings.filter(f => {
          if (attempted.has(f.id)) return false
          if (targetIds) return targetIds.has(f.id)
          return severity === 'all'
            ? f.severity === 'blocking' || f.severity === 'check'
            : f.severity === 'blocking'
        })
        if (candidates.length === 0) break

        let progressed = false
        for (const finding of candidates) {
          attempted.add(finding.id)
          const fix = finding.fixes.find(isActionableDrawingFix)
          if (!fix) {
            skippedFindings.push({
              findingId: finding.id,
              reason:
                finding.fixes.length === 0
                  ? 'No automated fix offered; requires a data or chart-form decision.'
                  : 'Only advisory fixes offered (e.g. shipping the table or naming an axis).',
            })
            continue
          }
          spec = applyChartFix(spec, fix)
          appliedFixes.push({
            findingId: finding.id,
            label: fix.label,
            kind: fix.kind,
          })
          progressed = true
          break
        }
        if (!progressed) break
      }

      const polishApplied: string[] = []
      if (asStr(args.title)) {
        spec = { ...spec, title: asStr(args.title)! }
        polishApplied.push('title')
      }
      if (isObj(args.axes)) {
        if (isObj(args.axes.x)) {
          spec = applyAxisPatch(spec, 'x', args.axes.x)
          polishApplied.push('axis:x')
        }
        if (isObj(args.axes.y)) {
          spec = applyAxisPatch(spec, 'y', args.axes.y)
          polishApplied.push('axis:y')
        }
      }
      if (typeof args.caption === 'string') {
        spec = {
          ...spec,
          chart: { ...spec.chart, caption: args.caption.trim() },
        }
        polishApplied.push('caption')
      } else if (args.autoCaptionFromFindings === true) {
        const generated = buildGroundedCaption(ctx.table, spec)
        if (generated) {
          spec = { ...spec, chart: { ...spec.chart, caption: generated } }
          polishApplied.push('caption:auto')
        }
      }

      const mutated = spec !== ctx.spec
      if (mutated) {
        ctx.applyChartSpec(spec, {
          table: ctx.table,
          status:
            appliedFixes.length > 0
              ? `Applied ${appliedFixes.length} review fix${appliedFixes.length === 1 ? '' : 'es'}`
              : 'Chart polished',
        })
      }

      const afterReview = serializeReview(reviewChart(ctx.table, spec))
      const findings = chartFindings(ctx.table, spec)

      return {
        mutated,
        summary: mutated
          ? `Applied ${appliedFixes.length} fix(es) and ${polishApplied.length} polish edit(s); blocking findings ${beforeBlocking} → ${afterReview.blocking}.`
          : `No fixable findings changed; blocking findings remain ${afterReview.blocking}.`,
        data: {
          beforeBlocking,
          afterBlocking: afterReview.blocking,
          appliedFixes,
          polishApplied,
          skippedFindings,
          review: afterReview,
          caption: spec.chart.caption,
          arithmeticFindings: findings,
        },
      }
    },
  }),

  // 5. Batch Point & Range Annotations with Auto-Resolution & All-or-Nothing Validation (Write)
  defineAppFunction<ChartAgentToolContext>({
    name: 'fn_batchAnnotateChart',
    category: 'annotations',
    risk: 'write',
    requiresApproval: false,
    riskWhen: { clearExisting: 'destructive' },
    replaces: ['clearChartAnnotations', 'addChartAnnotation', 'getChartData'],
    description:
      'Add or replace multiple data-grounded point and range annotations in one validated commit. Automatically resolves omitted point values and computes exact range statistics (count, min, max, average, change) from the plotted series, then validates every target all-or-nothing before mutating the chart.',
    inputSchema: {
      type: 'object',
      properties: {
        clearExisting: {
          type: 'boolean',
          description:
            'When true, clear existing annotations before adding the new list (escalates risk to destructive). Default false (append).',
        },
        annotations: {
          type: 'array',
          description:
            'Items of { text, target }. Point target: { kind: "point", seriesKey, xLabel, value? } (value auto-resolved if omitted). Range target: { kind: "range", x: { from, to }, y?: { from, to }, summary?: { count, min, max, average, change } } (y and summary auto-computed if omitted).',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              target: { type: 'object' },
            },
            required: ['text', 'target'],
          },
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const clearExisting = args.clearExisting === true
      const rawItems = Array.isArray(args.annotations) ? args.annotations : []
      if (!clearExisting && rawItems.length === 0) {
        throw new AgentChartToolError(
          'Provide at least one annotation in "annotations", or set clearExisting: true.',
        )
      }

      const dims = { width: 900, height: 540 }
      const facets = facetLayout(ctx.table, ctx.spec, dims)
      const geometries =
        facets && facets.panels.length > 0
          ? facets.panels.map(p => p.geometry)
          : [computeChartGeometry(ctx.table, ctx.spec, dims)]

      const resolved: ChartAnnotation[] = rawItems.map((entry, idx) => {
        if (!isObj(entry)) {
          throw new AgentChartToolError(
            `annotations[${idx}] must be an object with "text" and "target".`,
          )
        }
        return resolveBatchAnnotation(entry, geometries)
      })

      let nextSpec = clearExisting
        ? clearChartAgentAnnotationsSpec(ctx.spec)
        : ctx.spec
      for (const annotation of resolved) {
        nextSpec = addChartAgentAnnotationSpec(nextSpec, annotation)
      }

      if (resolved.length > 0) {
        try {
          validateChartAnnotations(
            {
              ...nextSpec,
              chart: { ...nextSpec.chart, annotations: resolved },
            },
            geometries,
          )
        } catch (error) {
          throw error instanceof AgentChartToolError
            ? error
            : new AgentChartToolError(
                error instanceof Error ? error.message : String(error),
              )
        }
      }

      const status =
        clearExisting && resolved.length === 0
          ? 'Annotations cleared'
          : `Saved ${resolved.length} annotation${resolved.length === 1 ? '' : 's'}`
      ctx.applyChartSpec(nextSpec, { table: ctx.table, status })

      return {
        mutated: true,
        summary: `${clearExisting ? 'Replaced annotations with' : 'Added'} ${resolved.length} validated annotation(s) (total ${nextSpec.chart.annotations.length}).`,
        data: {
          clearedPrevious: clearExisting,
          addedCount: resolved.length,
          totalAnnotations: nextSpec.chart.annotations.length,
          annotations: resolved,
          chart: getChartAgentChangeSummary({
            spec: nextSpec,
            table: ctx.table,
            documentPath: ctx.documentPath,
            status,
          }),
        },
      }
    },
  }),

  // 6. Publication & Figure Export Readiness Check (Read)
  defineAppFunction<ChartAgentToolContext>({
    name: 'fn_exportReadinessCheck',
    category: 'export',
    risk: 'read',
    requiresApproval: false,
    replaces: ['reviewChart', 'describeChart', 'getChartSpec', 'listCharts'],
    description:
      'Verify whether the focused chart or every chart on the sheet is ready to export as SVG or PNG at the target size and print scale. Checks renderability, caption fit, export dimensions, Second Look blocking findings, optional monochrome print legality, and editorial completeness (title, axes, caption).',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['focused', 'sheet'],
          description:
            'Check only the focused chart (default "focused") or every chart on the sheet ("sheet").',
        },
        format: {
          type: 'string',
          enum: ['svg', 'png'],
          description: 'Target export format (default "svg").',
        },
        width: {
          type: 'number',
          description: 'Target width in px (defaults to 900).',
        },
        height: {
          type: 'number',
          description: 'Target height in px (defaults to 540).',
        },
        scale: {
          type: 'number',
          description: 'PNG pixel scale (e.g. 3 for print; defaults to 1).',
        },
        palette: {
          type: 'string',
          enum: ['source', 'monochrome'],
          description:
            'Check export in source colours (default) or monochrome print palette.',
        },
        checkMonochrome: {
          type: 'boolean',
          description:
            'Also verify monochrome print legality even when palette is "source" (default false).',
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const scope = args.scope === 'sheet' ? 'sheet' : 'focused'
      const format = args.format === 'png' ? 'png' : 'svg'
      const width = asFiniteNum(args.width) ?? DEFAULT_RENDER_SIZE.width
      const height = asFiniteNum(args.height) ?? DEFAULT_RENDER_SIZE.height
      const scale = format === 'png' ? (asFiniteNum(args.scale) ?? 1) : 1
      const paletteMode =
        args.palette === 'monochrome' ? 'monochrome' : 'source'
      const checkMono =
        paletteMode === 'monochrome' || args.checkMonochrome === true

      const targets: Array<{ id: string | null; spec: ChartSpec }> =
        scope === 'sheet'
          ? ctx.sheet.charts.map(c => ({
              id: c.id,
              spec: specForChart(ctx.sheet, c.id) ?? c.spec,
            }))
          : [{ id: ctx.sheet.focusedId, spec: ctx.spec }]

      const sizeError = validateChartExportSize(width, height, scale)
      const globalBlockers: string[] = sizeError ? [sizeError] : []
      const globalWarnings: string[] = []
      const recommendedActions = new Set<string>()

      const chartReports = targets.map(({ id, spec }) => {
        const effectiveSpec: ChartSpec =
          paletteMode === 'monochrome'
            ? {
                ...spec,
                chart: {
                  ...spec.chart,
                  style: { ...spec.chart.style, palette: 'mono' },
                },
              }
            : spec
        const blockers: string[] = []
        const warnings: string[] = []

        const drawn = renderChartSvg(ctx.table, effectiveSpec, {
          width,
          height,
        })
        if (drawn.message && drawn.message !== sizeError) {
          blockers.push(`Render blocked: ${drawn.message}`)
        }
        for (const w of drawn.warnings) {
          warnings.push(w)
        }

        const review = reviewChart(ctx.table, effectiveSpec)
        for (const f of review.findings) {
          if (f.severity === 'blocking') {
            blockers.push(`${f.id}: ${f.title}`)
            recommendedActions.add('Run fn_autoFixAndPolishChart to resolve blocking Second Look findings.')
          } else if (f.severity === 'check') {
            warnings.push(`${f.id}: ${f.title}`)
          }
        }

        let monochromeReady: boolean | undefined
        if (checkMono) {
          const monoSpec: ChartSpec = {
            ...spec,
            chart: {
              ...spec.chart,
              style: { ...spec.chart.style, palette: 'mono' },
            },
          }
          const monoReview = reviewChart(ctx.table, monoSpec)
          const monoBlockers = monoReview.findings.filter(
            f => f.severity === 'blocking',
          )
          monochromeReady = monoBlockers.length === 0
          if (!monochromeReady && paletteMode !== 'monochrome') {
            warnings.push(
              `Monochrome print check has ${monoBlockers.length} blocking issue(s): ${monoBlockers.map(f => f.id).join(', ')}`,
            )
            recommendedActions.add(
              'Enable directLabels (or reduce series count) before monochrome print export.',
            )
          }
        }

        const hygiene = editorialHygiene(spec)
        if (hygiene.hasDefaultTitle) {
          warnings.push('Title is generic or untitled.')
          recommendedActions.add('Set a descriptive chart title describing what the data shows.')
        }
        if (!hygiene.yAxisNamed && !hygiene.yAxisHasUnit) {
          warnings.push('Y axis has no explicit label or unit (falls back to bare column name).')
          recommendedActions.add('Name axes and specify units via fn_buildAndReviewChart or fn_autoFixAndPolishChart.')
        }
        if (!hygiene.hasCaption) {
          warnings.push('No data-grounded caption is set.')
          recommendedActions.add('Add a data-grounded caption via fn_autoFixAndPolishChart (autoCaptionFromFindings: true).')
        }

        return {
          id,
          title: spec.title,
          type: spec.chart.type,
          ready: blockers.length === 0 && globalBlockers.length === 0,
          blockers,
          warnings,
          editorial: hygiene,
          ...(monochromeReady !== undefined ? { monochromeReady } : {}),
        }
      })

      if (!ctx.documentPath) {
        globalWarnings.push(
          'Chart has not been saved yet; exportChart will create a .chart draft package first.',
        )
      }

      const readyToExport =
        globalBlockers.length === 0 && chartReports.every(r => r.ready)
      const totalBlockers =
        globalBlockers.length +
        chartReports.reduce((sum, r) => sum + r.blockers.length, 0)
      const totalWarnings =
        globalWarnings.length +
        chartReports.reduce((sum, r) => sum + r.warnings.length, 0)

      return {
        mutated: false,
        summary: readyToExport
          ? `Export ready (${format.toUpperCase()} ${width}×${height}${format === 'png' ? ` @${scale}x` : ''}, ${totalWarnings} advisory warning(s)).`
          : `Export blocked: ${totalBlockers} blocker(s) and ${totalWarnings} warning(s) across ${chartReports.length} chart(s).`,
        data: {
          readyToExport,
          scope,
          target: { format, width, height, scale, palette: paletteMode },
          documentPath: ctx.documentPath,
          blockers: globalBlockers,
          warnings: globalWarnings,
          charts: chartReports,
          recommendedActions: [...recommendedActions],
        },
      }
    },
  }),
] as const
