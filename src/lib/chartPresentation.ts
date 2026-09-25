export interface ReferenceLine { id: string; axis: 'x' | 'y'; value: number; label: string }
export interface ChartPresentation {
  legend: 'auto' | 'top' | 'right' | 'bottom' | 'none'
  references: ReferenceLine[]
  errorBars: { lower: string; upper: string } | null
}
export function defaultPresentation(): ChartPresentation { return { legend: 'auto', references: [], errorBars: null } }
export function sanitizePresentation(value: unknown): ChartPresentation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<ChartPresentation>
  return {
    legend: ['auto', 'top', 'right', 'bottom', 'none'].includes(raw.legend ?? '') ? raw.legend! : 'auto',
    references: Array.isArray(raw.references) ? raw.references.filter(r => r && typeof r.id === 'string' && ['x', 'y'].includes(r.axis) && Number.isFinite(r.value) && typeof r.label === 'string') : [],
    errorBars: raw.errorBars && typeof raw.errorBars.lower === 'string' && typeof raw.errorBars.upper === 'string' ? raw.errorBars : null,
  }
}

export function formatChartNumber(value: number, format: 'plain' | 'grouped' | 'percent' | 'compact' = 'plain'): string {
  if (format === 'plain') return String(Number(value.toPrecision(6)))
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 2,
    ...(format === 'percent' ? { style: 'percent' as const } : {}),
    ...(format === 'compact' ? { notation: 'compact' as const } : {}),
    useGrouping: true,
  }).format(value)
}
