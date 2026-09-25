import { validateChartAnnotations } from './chartAnnotationValidation'
import { updateChartAgentSpec, type ChartAgentUpdateInput } from './agentChartTools'
import { CHART_TYPES, migrateSpec, type ChartSpec } from './chartSpec'
import { renderChartSvg } from './chartRender'
import { computeChartGeometry } from './chartLayout'
import { facetLayout } from './chartFacet'
import { chartFindings } from './chartFindings'
import { reviewChart } from './chartReview'
import { transformChartData } from './chartTransform'
import type { DataTable } from './dataParse'

export interface ChartProposalPatch extends ChartAgentUpdateInput {
  axes?: ChartSpec['chart']['axes']
  facet?: ChartSpec['chart']['facet']
  transform?: ChartSpec['chart']['transform']
  presentation?: ChartSpec['chart']['presentation']
  annotations?: ChartSpec['chart']['annotations']
  caption?: string
}
export interface ChartProposalInput {
  patch: ChartProposalPatch
  explanation: string
  /** Use exact computed findings as the caption, avoiding unverified paraphrases. */
  captionFindingIds?: string[]
}
export interface ChartProposal {
  id: string
  chartId: string
  base: string
  spec: ChartSpec
  explanation: string
  changes: string[]
  warnings: string[]
  findings: ReturnType<typeof chartFindings>
  calculation: string
  preview: string
}
export const proposalBase = (chartId: string | null, spec: ChartSpec, table: DataTable): string => JSON.stringify([chartId, spec, table])

export function createChartProposal(chartId: string | null, current: ChartSpec, table: DataTable, input: ChartProposalInput): ChartProposal {
  if (!chartId) throw new Error('Choose a chart before proposing changes.')
  if (typeof input.explanation !== 'string' || !input.explanation.trim()) throw new Error('Explain why these changes help the chart.')
  if (!input.patch || typeof input.patch !== 'object' || Array.isArray(input.patch)) throw new Error('Provide a chart patch.')
  const supported = new Set(['title', 'type', 'x', 'y', 'series', 'style', 'axes', 'facet', 'transform', 'presentation', 'annotations', 'caption'])
  for (const key of Object.keys(input.patch)) if (!supported.has(key)) throw new Error(`Unsupported proposal field: ${key}. Source data is edited in Data.`)
  const patch = input.patch
  if (patch.title !== undefined && typeof patch.title !== 'string') throw new Error('Title must be text.')
  if (patch.caption !== undefined && typeof patch.caption !== 'string') throw new Error('Caption must be text.')
  if (patch.type !== undefined && !CHART_TYPES.includes(patch.type)) throw new Error('Choose a supported chart type.')
  for (const key of ['x', 'series'] as const) if (patch[key] !== undefined && patch[key] !== null && typeof patch[key] !== 'string') throw new Error(`${key} must name a column or be null.`)
  if (patch.y !== undefined && (!Array.isArray(patch.y) || patch.y.some(value => typeof value !== 'string'))) throw new Error('Y must be a list of column names.')
  if (patch.annotations !== undefined && !Array.isArray(patch.annotations)) throw new Error('Annotations must be a list.')
  if (input.captionFindingIds !== undefined && (!Array.isArray(input.captionFindingIds) || input.captionFindingIds.some(id => typeof id !== 'string'))) throw new Error('Caption finding IDs must be a list of strings.')
  for (const key of ['style', 'axes', 'facet', 'transform', 'presentation'] as const) {
    if (patch[key] !== undefined && (!patch[key] || typeof patch[key] !== 'object' || Array.isArray(patch[key]))) throw new Error(`${key} must be an object.`)
  }
  const checkNumbers = (value: unknown): void => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Proposal numbers must be finite.')
    if (value && typeof value === 'object') Object.values(value).forEach(checkNumbers)
  }
  checkNumbers(patch)
  let next = updateChartAgentSpec(current, table, patch)
  next = migrateSpec({ ...next, chart: { ...next.chart,
    ...(patch.axes ? { axes: { x: { ...next.chart.axes.x, ...patch.axes.x }, y: { ...next.chart.axes.y, ...patch.axes.y } } } : {}),
    ...Object.fromEntries(['facet', 'transform', 'presentation', 'annotations', 'caption'].filter(key => key in patch).map(key => [key, patch[key as keyof ChartProposalPatch]])),
  } })
  // Normalizers support legacy documents; a new proposal must not silently lose
  // an invalid field or clamp a requested setting without showing that change.
  const checkFields = (requested: unknown, actual: unknown, path: string): void => {
    if (requested && typeof requested === 'object') {
      if (!actual || typeof actual !== 'object' || Array.isArray(requested) !== Array.isArray(actual)) throw new Error(`Invalid ${path}.`)
      if (Array.isArray(requested) && requested.length !== (actual as unknown[]).length) throw new Error(`Invalid ${path}.`)
      for (const key of Object.keys(requested)) checkFields((requested as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], `${path}.${key}`)
    } else if (requested !== actual) throw new Error(`Invalid ${path}: the requested value is unsupported.`)
  }
  for (const key of ['style', 'axes', 'facet', 'transform', 'presentation', 'annotations', 'caption'] as const) {
    if (patch[key] !== undefined) checkFields(patch[key], next.chart[key], key)
  }
  if (patch.annotations && next.chart.annotations.length !== patch.annotations.length) throw new Error('One or more annotations have invalid targets or metadata.')
  const facetColumn = next.chart.facet.column
  if (facetColumn && !table.columns.some(c => c.name === facetColumn)) throw new Error(`Unknown facet column: ${facetColumn}`)
  const geometry = computeChartGeometry(table, next, { width: 900, height: 540 })
  const panels = facetLayout(table, next, { width: 900, height: 540 })
  const geometries = panels ? panels.panels.map(p => p.geometry) : [geometry]
  const warnings: string[] = []
  validateChartAnnotations(next, geometries)
  const findings = panels ? [] : chartFindings(table, next, geometry)
  if (input.captionFindingIds) {
    if ('caption' in patch) throw new Error('Provide a caption or computed finding IDs, not both.')
    const selected = input.captionFindingIds.map(id => {
      const finding = findings.find(f => f.id === id)
      if (!finding) throw new Error(`Finding ${id} is unavailable for the proposed chart. Review its computed findings first.`)
      return finding.text
    })
    next = { ...next, chart: { ...next.chart, caption: selected.join(' ') } }
  } else if (next.chart.caption.trim()) warnings.push('Free-form caption: compare its claims with the computed findings. Causes and external claims are not verified.')
  if (next.chart.annotations.length) warnings.push('Annotation targets were checked against plotted data. Review the wording of their claims.')
  const drawn = renderChartSvg(table, next)
  if (drawn.message) throw new Error(drawn.message)
  const review = reviewChart(table, next)
  warnings.push(...review.findings.map(f => `${f.title}: ${f.detail}`))
  const normalizedCurrent = migrateSpec(current)
  const changes: string[] = []
  if (next.title !== current.title) changes.push(`Title: ${next.title}`)
  for (const key of Object.keys(next.chart) as (keyof ChartSpec['chart'])[]) {
    if (JSON.stringify(normalizedCurrent.chart[key]) !== JSON.stringify(next.chart[key])) changes.push(`${key.charAt(0).toUpperCase() + key.slice(1)} changed`)
  }
  if (!changes.length) throw new Error('The proposal does not change this chart.')
  return { id: crypto.randomUUID(), chartId, base: proposalBase(chartId, current, table), spec: next, explanation: input.explanation.trim(), changes, warnings, findings, calculation: transformChartData(table, next).summary, preview: drawn.svg }
}
