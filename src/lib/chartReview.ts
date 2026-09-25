import {
  CONTRAST_MIN,
  CVD_FLOOR,
  CVD_TARGET,
  NORMAL_VISION_FLOOR,
  colorPairs,
  contrastRatio,
  worstPair,
} from './chartColorMath'
import { computeChartGeometry, type ChartGeometry } from './chartLayout'
import { CHART_OVERFLOW_INK, chartPalette } from './chartTheme'
import type { ChartSpec, ChartType } from './chartSpec'
import type { DataTable } from './dataParse'

/**
 * Second look: what is wrong with the drawing, located.
 *
 * Every finding here is measured, never guessed, and every one names the mark
 * it is about plus the change that would settle it. There is no score and no
 * grade — a chart is not better for having fewer findings, it is better for
 * having none that matter.
 */

export type FindingSeverity = 'blocking' | 'check' | 'note'

export type ChartFix =
  | { kind: 'style'; label: string; patch: { directLabels?: boolean; rug?: boolean; grid?: boolean } }
  | { kind: 'facet'; label: string; column: string }
  | { kind: 'keep-series'; label: string; count: number }
  | { kind: 'palette'; label: string; palette: string }
  | { kind: 'table'; label: string }
  | { kind: 'name-axis'; label: string; axis: 'x' | 'y' }

export interface ChartFinding {
  id: string
  severity: FindingSeverity
  title: string
  detail: string
  /** The series, axis or mark this is about, named as the chart names it. */
  about: string | null
  fixes: ChartFix[]
}

export interface ChartReview {
  findings: ChartFinding[]
  /** Checks that were run and came back clear, for the "nothing to see" list. */
  cleared: string[]
  /** How the colours were judged, so a reader can see the working. */
  colour: {
    scope: 'adjacent' | 'all'
    worstNormal: number | null
    worstCvd: number | null
    palest: { label: string; ratio: number } | null
  }
}

/** The forms that put every series beside every other, not just its neighbours. */
const ALL_PAIRS_FORMS: ChartType[] = ['scatter', 'connected-scatter']
const BAR_FORMS: ChartType[] = ['bar', 'grouped-bar', 'stacked-bar', 'histogram']

/** The surface a chart is drawn on, which contrast is measured against. */
export const CHART_SURFACE = '#fcfcfb'

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function seriesNames(geometry: ChartGeometry): string[] {
  return geometry.series.map(series => series.key)
}

function paletteSize(spec: ChartSpec): number {
  return chartPalette(spec.chart.style.palette, spec.chart.style.customPalettes)
    .colors.length
}

function isMonochrome(spec: ChartSpec): boolean {
  return (
    chartPalette(spec.chart.style.palette, spec.chart.style.customPalettes)
      .monochrome === true
  )
}

/**
 * Series past the end of the palette.
 *
 * There is no further hue that would clear the floors, so they are all drawn
 * in one neutral grey. Nothing is mislabelled by it — but nothing is named
 * either, and the chart is claiming to show more than it can distinguish.
 */
function unnamedSeries(geometry: ChartGeometry): string[] {
  return geometry.series
    .filter(series => series.color === CHART_OVERFLOW_INK)
    .map(series => series.key)
}

/** Direct labels that would sit on top of one another at this size. */
function collidingLabels(geometry: ChartGeometry): string[] {
  const labels = geometry.series
    .map(series => series.label)
    .filter((label): label is { x: number; y: number; text: string } => !!label)
    .sort((a, b) => a.y - b.y)
  const collisions: string[] = []
  for (let index = 1; index < labels.length; index += 1) {
    const above = labels[index - 1]!
    const below = labels[index]!
    if (Math.abs(below.y - above.y) < 14 && Math.abs(below.x - above.x) < 80) {
      collisions.push(`${above.text} and ${below.text}`)
    }
  }
  return collisions
}

/** Columns a chart could be split by: categorical, and not already the x axis. */
export function facetCandidates(table: DataTable, spec: ChartSpec): string[] {
  return table.columns
    .filter(column => column.type !== 'number')
    .filter(column => column.name !== spec.chart.encodings.x)
    .map(column => column.name)
}

export function reviewChart(
  table: DataTable,
  spec: ChartSpec,
  geometry?: ChartGeometry,
): ChartReview {
  const drawn =
    geometry ??
    computeChartGeometry(table, spec, { width: 900, height: 540 })

  const findings: ChartFinding[] = []
  const cleared: string[] = []

  if (drawn.empty) {
    return {
      findings: [],
      cleared: [],
      colour: { scope: 'adjacent', worstNormal: null, worstCvd: null, palest: null },
    }
  }

  const style = spec.chart.style
  const type = spec.chart.type
  const names = seriesNames(drawn)
  const colors = drawn.series.map(series => series.color)
  const scope: 'adjacent' | 'all' = ALL_PAIRS_FORMS.includes(type)
    ? 'all'
    : 'adjacent'
  const readings = colorPairs(colors, names, scope)
  const worstNormal = worstPair(readings, 'normal')
  const worstCvd = worstPair(readings, 'cvd')
  const facets = facetCandidates(table, spec)

  const facetFix = (label: string): ChartFix[] =>
    facets.length > 0
      ? [{ kind: 'facet', label, column: facets[0]! }]
      : []

  // --- more series than the palette can name ------------------------------
  const unnamed = unnamedSeries(drawn)
  if (unnamed.length > 0) {
    const capacity = paletteSize(spec)
    findings.push({
      id: 'colour-overflow',
      severity: 'blocking',
      title:
        unnamed.length === 1
          ? `${unnamed[0]} has no colour of its own`
          : `${unnamed.length} series have no colour of their own`,
      detail: `This palette can hold ${capacity} series apart; the chart has ${names.length}. The rest are drawn in one grey, because there is no further hue that ordinary and colour-deficient vision could both separate. ${unnamed.slice(0, 3).join(', ')}${unnamed.length > 3 ? ' and others' : ''} are on the chart without being identified.`,
      about: unnamed.join(', '),
      fixes: [
        ...facetFix('Give each one its own panel'),
        {
          // One slot is spent on "Other", so the fold has to leave room for it.
          kind: 'keep-series',
          label: `Keep the largest ${capacity - 1}, fold the rest into Other`,
          count: capacity - 1,
        },
      ],
    })
  } else if (names.length > 1) {
    cleared.push('Every series has a colour of its own')
  }

  const mono = isMonochrome(spec)

  // --- a monochrome palette names nothing by itself --------------------------
  if (mono && names.length > 1) {
    if (style.directLabels) {
      cleared.push('Mono is carried by the labels, as it has to be')
    } else {
      findings.push({
        id: 'mono-unlabelled',
        severity: 'blocking',
        title: 'Mono names the series by nothing at all',
        detail:
          'A monochrome palette separates series by lightness, which is enough to see they are different and not enough to know which is which. It is for one-ink printing, and it only works with the series labelled on the chart.',
        about: null,
        fixes: [
          { kind: 'style', label: 'Label each series on the chart', patch: { directLabels: true } },
          { kind: 'palette', label: 'Use a palette with hues', palette: 'science' },
        ],
      })
    }
  }

  // --- pairs ordinary colour vision cannot separate -------------------------
  if (!mono && worstNormal && worstNormal.normal < NORMAL_VISION_FLOOR) {
    findings.push({
      id: 'colour-indistinct',
      severity: 'blocking',
      title: `${worstNormal.firstLabel} and ${worstNormal.secondLabel} are the same mark`,
      detail: `These two measure ${round(worstNormal.normal)} apart to ordinary colour vision, below the floor of ${NORMAL_VISION_FLOOR}. Readers with no colour deficiency at all cannot tell them apart, so a legend will not rescue it.${scope === 'all' ? ' This form puts every series beside every other, so all pairs are in play, not just neighbours.' : ''}`,
      about: `${worstNormal.firstLabel} and ${worstNormal.secondLabel}`,
      fixes: [
        ...facetFix('Give each one its own panel'),
        { kind: 'keep-series', label: 'Keep the largest two, fold the rest into Other', count: 2 },
      ],
    })
  } else if (!mono && worstNormal) {
    cleared.push('Every pair of series can be told apart')
  }

  // --- pairs colour-deficient vision cannot separate ------------------------
  if (!mono && worstCvd && worstCvd.cvd < CVD_TARGET) {
    const belowFloor = worstCvd.cvd < CVD_FLOOR
    const relieved = style.directLabels
    findings.push({
      id: 'colour-cvd',
      severity: belowFloor && !relieved ? 'blocking' : relieved ? 'note' : 'check',
      title: `${worstCvd.firstLabel} and ${worstCvd.secondLabel} converge for a colour-blind reader`,
      detail: `Simulated ${worstCvd.cvdVision === 'protan' ? 'protanopia' : 'deuteranopia'} puts them ${round(worstCvd.cvd)} apart, ${belowFloor ? `below the floor of ${CVD_FLOOR}` : `short of the target of ${CVD_TARGET}`}. ${relieved ? 'The end labels are naming each series, which is what makes this legal.' : 'Something other than colour has to name each series.'}`,
      about: `${worstCvd.firstLabel} and ${worstCvd.secondLabel}`,
      fixes: relieved
        ? []
        : [
            { kind: 'style', label: 'Label each series on the chart', patch: { directLabels: true } },
            ...facetFix('Give each one its own panel'),
          ],
    })
  } else if (!mono && worstCvd) {
    cleared.push('Colours hold up under simulated colour blindness')
  }

  // --- colours too pale for the paper ---------------------------------------
  const pale = drawn.series
    .map(series => ({
      label: series.key,
      ratio: contrastRatio(series.color, CHART_SURFACE),
    }))
    .filter(entry => entry.ratio < CONTRAST_MIN)
    .sort((a, b) => a.ratio - b.ratio)

  if (pale.length > 0 && !style.directLabels) {
    findings.push({
      id: 'colour-pale',
      severity: 'check',
      title:
        pale.length === 1
          ? `${pale[0]!.label} is too pale for the paper`
          : `${pale.length} series are too pale for the paper`,
      detail: `${pale
        .slice(0, 3)
        .map(entry => `${entry.label} ${entry.ratio.toFixed(1)}:1`)
        .join(', ')} against the chart surface, under the ${CONTRAST_MIN}:1 a mark needs to stand on its own. Allowed, but only when something other than colour names each series.`,
      about: pale.map(entry => entry.label).join(', '),
      fixes: [
        { kind: 'style', label: 'Label each series on the chart', patch: { directLabels: true } },
        { kind: 'table', label: 'Ship the table with it' },
      ],
    })
  } else if (pale.length === 0 && drawn.series.length > 0) {
    cleared.push('Every colour stands clear of the paper')
  }

  // --- more series than the form can carry ----------------------------------
  if (scope === 'all' && names.length > 3) {
    findings.push({
      id: 'too-many-for-form',
      severity: 'check',
      title: `${names.length} series in one scatter`,
      detail:
        'A scatter puts every colour beside every other, and past three no ordering of hues clears the floor for all of them. Fold the tail into Other, or give each one a panel.',
      about: null,
      fixes: [
        ...facetFix('Give each one its own panel'),
        { kind: 'keep-series', label: 'Keep the largest two, fold the rest into Other', count: 2 },
      ],
    })
  }

  // --- bars that do not start at zero ---------------------------------------
  if (BAR_FORMS.includes(type)) {
    const top = drawn.yValueAtPixel(drawn.plot.top)
    const bottom = drawn.yValueAtPixel(drawn.plot.bottom)
    const low = Math.min(top, bottom)
    const high = Math.max(top, bottom)
    if (low > 0.0001 || high < -0.0001) {
      findings.push({
        id: 'bars-truncated',
        severity: 'blocking',
        title: 'The bars do not start at zero',
        detail: `The axis runs from ${round(low)} to ${round(high)}, so a bar twice as long does not mean twice as much. A length only reads honestly from a zero baseline; if the interesting range is narrow, a line or a dot plot is the form that can say so.`,
        about: 'y axis',
        fixes: [],
      })
    } else {
      cleared.push('Bars start at zero')
    }
  }

  // --- labels sitting on top of one another ---------------------------------
  const collisions = collidingLabels(drawn)
  if (collisions.length > 0) {
    findings.push({
      id: 'labels-collide',
      severity: 'check',
      title: `${collisions[0]} overlap where they are labelled`,
      detail:
        'Their end labels land within a line of each other, so at export size one will sit on the other.',
      about: collisions[0]!,
      fixes: [
        { kind: 'style', label: 'Use a legend instead of end labels', patch: { directLabels: false } },
        ...facetFix('Give each one its own panel'),
      ],
    })
  } else if (style.directLabels && drawn.series.length > 1) {
    cleared.push('No labels collide at this size')
  }

  if (drawn.yTicks.length > 0) cleared.push('Every tick names a value the data reaches')

  const order: Record<FindingSeverity, number> = { blocking: 0, check: 1, note: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])

  return {
    findings,
    cleared,
    colour: {
      scope,
      worstNormal: worstNormal ? round(worstNormal.normal) : null,
      worstCvd: worstCvd ? round(worstCvd.cvd) : null,
      palest: pale[0] ? { label: pale[0].label, ratio: round(pale[0].ratio) } : null,
    },
  }
}

/**
 * Carry out a fix the review offered.
 *
 * Pure, so the button in the panel and the tool in the drawer are the same
 * change: the UI applies this to the open spec, the handler applies it to the
 * live one, and neither can drift from what the finding promised.
 *
 * `table` is what a fix needs when it has to look at the data — folding a
 * tail into Other means knowing which series are largest.
 */
export function applyChartFix(spec: ChartSpec, fix: ChartFix): ChartSpec {
  switch (fix.kind) {
    case 'style':
      return {
        ...spec,
        chart: { ...spec.chart, style: { ...spec.chart.style, ...fix.patch } },
      }
    case 'facet':
      return {
        ...spec,
        chart: {
          ...spec.chart,
          facet: { ...spec.chart.facet, column: fix.column },
        },
      }
    case 'keep-series':
      return {
        ...spec,
        chart: {
          ...spec.chart,
          encodings: { ...spec.chart.encodings, limitSeries: fix.count },
        },
      }
    case 'palette':
      return {
        ...spec,
        chart: {
          ...spec.chart,
          style: { ...spec.chart.style, palette: fix.palette },
        },
      }
    case 'name-axis':
    case 'table':
      // Neither changes the drawing: naming an axis is a piece of writing the
      // inspector asks for, and shipping the table is what export already
      // does. Returning the spec unchanged keeps the caller honest about it.
      return spec
  }
}

/** The fix a finding offers, by its position in that finding's list. */
export function fixFor(
  review: ChartReview,
  findingId: string,
  index = 0,
): ChartFix | null {
  return review.findings.find(finding => finding.id === findingId)?.fixes[index] ?? null
}
