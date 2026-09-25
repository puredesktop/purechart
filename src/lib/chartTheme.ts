/**
 * Tufte-leaning chart aesthetics. These are data-ink colours and type for the
 * chart canvas itself — distinct from the suite's grey UI chrome. Colour here
 * encodes data (series), never decoration.
 */

export const CHART_PALETTE_IDS = [
  'science',
  'quiet',
  'meadow',
  'ember',
  'mono',
] as const

export type BuiltInChartPaletteId = (typeof CHART_PALETTE_IDS)[number]
export type ChartPaletteId = BuiltInChartPaletteId | (string & {})

export interface ChartPalette {
  id: string
  label: string
  colors: readonly string[]
  custom?: boolean
  /**
   * A palette that names series by lightness rather than hue. Legal — for
   * one-ink printing and forced-colours modes — but only when something
   * other than colour names each series, so the review insists on labels.
   */
  monochrome?: boolean
}

/**
 * Data palettes, each one measured rather than picked by eye.
 *
 * Every set below clears the same gates: OKLCH lightness inside the band for
 * a light surface, chroma above the floor where a hue starts reading as grey,
 * and — for each pair a reader meets side by side — a distance of at least 15
 * to ordinary colour vision and 8 under simulated protanopia and
 * deuteranopia. The ORDER is part of that: it is what puts the closest pairs
 * apart from one another, so re-ordering a palette means re-measuring it.
 *
 * Palettes are different lengths because that is how many colours each family
 * can honestly carry. Past the end there is no eighth hue to invent: the
 * extra series go grey and the review says to facet or fold them into Other.
 */
export const CHART_PALETTES: Record<BuiltInChartPaletteId, ChartPalette> = {
  science: {
    id: 'science',
    label: 'Science',
    colors: [
      '#2a78d6',
      '#eb6834',
      '#1baf7a',
      '#eda100',
      '#e87ba4',
      '#008300',
      '#4a3aa7',
      '#e34948',
    ],
  },
  quiet: {
    id: 'quiet',
    label: 'Quiet',
    colors: ['#387ec1', '#b4612d', '#059068', '#8667b9', '#71841f', '#b0508e'],
  },
  meadow: {
    id: 'meadow',
    label: 'Meadow',
    colors: [
      '#3b9555',
      '#ab61a5',
      '#868604',
      '#4682cc',
      '#ab7302',
      '#009298',
      '#c25d58',
    ],
  },
  ember: {
    id: 'ember',
    label: 'Ember',
    colors: [
      '#c55865',
      '#567cd3',
      '#768b09',
      '#ae5ea8',
      '#a77601',
      '#0d9298',
      '#c45e39',
    ],
  },
  mono: {
    id: 'mono',
    label: 'Mono',
    colors: ['#2f353d', '#4d5560', '#6b7480', '#9ba3ae'],
    monochrome: true,
  },
}

export function isChartPaletteId(
  value: unknown,
): value is BuiltInChartPaletteId {
  return CHART_PALETTE_IDS.includes(value as BuiltInChartPaletteId)
}

export function chartPalette(
  id: string,
  customPalettes: readonly ChartPalette[] = [],
): ChartPalette {
  const custom = customPalettes.find(palette => palette.id === id)
  if (custom) return custom
  return isChartPaletteId(id) ? CHART_PALETTES[id] : CHART_PALETTES.science
}

export function chartPaletteList(
  customPalettes: readonly ChartPalette[] = [],
): ChartPalette[] {
  return [...CHART_PALETTE_IDS.map(id => CHART_PALETTES[id]), ...customPalettes]
}

/**
 * The ink for a series, by its position in the chart.
 *
 * Colours are never cycled. A palette carries as many series as it can hold
 * apart, and past that there is no further hue that clears the floors — so
 * the overflow is drawn in one neutral grey, which reads as "not separately
 * identified" rather than as a second series wearing the first one's colour.
 * The review names them and offers to facet or fold them into Other.
 */
export function seriesColor(
  index: number,
  paletteId: string,
  customPalettes: readonly ChartPalette[] = [],
): string {
  const colors = chartPalette(paletteId, customPalettes).colors
  return colors[index] ?? CHART_OVERFLOW_INK
}

/** How many series a palette can name by colour alone. */
export function paletteCapacity(
  paletteId: string,
  customPalettes: readonly ChartPalette[] = [],
): number {
  return chartPalette(paletteId, customPalettes).colors.length
}

/** Chart labels inherit the suite's content font so charts feel native. */
export const CHART_FONT_FAMILY =
  '"Archivo", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/** Series past the end of the palette, drawn as one unnamed group. */
export const CHART_OVERFLOW_INK = '#8a8f98'

export const CHART_INK = '#1c1a17'
export const CHART_MUTED_INK = '#6b665e'
export const CHART_FAINT = '#e7e4dd'

export const CHART_AXIS_FONT_SIZE = 12
export const CHART_LABEL_FONT_SIZE = 13
