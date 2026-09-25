import { computeChartGeometry, type ChartGeometry } from './chartLayout'
import type { ChartSpec } from './chartSpec'
import type { DataTable } from './dataParse'

/**
 * What a chart says, worked out rather than written.
 *
 * Every finding here is arithmetic over the drawn series: the steepest rise,
 * the only fall, where two lines cross, the point that sits away from the
 * rest. That means none of them can describe a trend the data does not have,
 * and all of them change the moment the numbers do. Saying it more gracefully
 * is a job for the assistant; being true is this file's job.
 */

export interface ChartFinding {
  id: string
  /** The claim, in a sentence. */
  text: string
  /** The arithmetic behind it, for anyone who wants to check. */
  working: string
  /** The series it is about, or null when it is about the chart as a whole. */
  series: string | null
}

interface SeriesPoints {
  key: string
  points: Array<{ label: string; value: number }>
}

/**
 * Say a date the way the table said it.
 *
 * Monthly data parses to the first of each month, so a caption ends up
 * quoting "2026-04-01" for a column whose every value read "2026-04". The day
 * is only dropped when every label on the chart has the same one, so nothing
 * that varies is ever hidden.
 */
function tidyLabels(points: Array<{ label: string; value: number }>): Array<{
  label: string
  value: number
}> {
  const iso = /^(\d{4}-\d{2})-(\d{2})(T.*)?$/
  const days = new Set<string>()
  for (const point of points) {
    const match = iso.exec(point.label)
    if (!match) return points
    days.add(match[2]!)
  }
  if (days.size !== 1 || !days.has('01')) return points
  return points.map(point => ({
    ...point,
    label: iso.exec(point.label)![1]!,
  }))
}

function seriesFrom(geometry: ChartGeometry): SeriesPoints[] {
  return geometry.series
    .map(series => ({
      key: series.key,
      points: (series.points.length > 0
        ? series.points
        : series.bars.map((bar, index) => ({
            xLabel: String(index),
            value: bar.value,
          }))
      ).map(point => ({ label: point.xLabel, value: point.value })),
    }))
    .map(series => ({ ...series, points: tidyLabels(series.points) }))
    .filter(series => series.points.length > 0)
}

function round(value: number): number {
  return Math.abs(value) >= 100
    ? Math.round(value)
    : Math.round(value * 10) / 10
}

/** "trebled", "doubled", "rose by half" — only where it is exactly true. */
function multipleWord(from: number, to: number): string | null {
  if (from <= 0 || to <= from) return null
  const factor = to / from
  if (factor >= 2.75 && factor <= 3.25) return 'trebled'
  if (factor >= 1.85 && factor <= 2.15) return 'doubled'
  if (factor >= 3.75 && factor <= 4.25) return 'quadrupled'
  return null
}

function changeSentence(series: SeriesPoints): {
  text: string
  working: string
  magnitude: number
} | null {
  const first = series.points[0]!
  const last = series.points[series.points.length - 1]!
  if (series.points.length < 2) return null
  const delta = last.value - first.value
  if (delta === 0) {
    return {
      text: `${series.key} ends where it started, at ${round(first.value)}.`,
      working: `${first.label} ${round(first.value)} · ${last.label} ${round(last.value)}`,
      magnitude: 0,
    }
  }
  const word = multipleWord(first.value, last.value)
  const direction = delta > 0 ? 'rose' : 'fell'
  const text = word
    ? `${series.key} ${word} between ${first.label} and ${last.label}, from ${round(first.value)} to ${round(last.value)}.`
    : `${series.key} ${direction} from ${round(first.value)} in ${first.label} to ${round(last.value)} in ${last.label}.`
  return {
    text,
    working: `${round(delta > 0 ? delta : -delta)} ${delta > 0 ? 'higher' : 'lower'}${first.value > 0 ? `, ×${(last.value / first.value).toFixed(1)}` : ''}`,
    magnitude: first.value > 0 ? last.value / first.value : Math.abs(delta),
  }
}

/** Every step down, across every series — usually the interesting exception. */
function falls(series: SeriesPoints[]): Array<{
  key: string
  from: { label: string; value: number }
  to: { label: string; value: number }
}> {
  const found: Array<{
    key: string
    from: { label: string; value: number }
    to: { label: string; value: number }
  }> = []
  for (const entry of series) {
    for (let index = 1; index < entry.points.length; index += 1) {
      const from = entry.points[index - 1]!
      const to = entry.points[index]!
      if (to.value < from.value) found.push({ key: entry.key, from, to })
    }
  }
  return found
}

function largestJump(entry: SeriesPoints): {
  from: { label: string; value: number }
  to: { label: string; value: number }
  delta: number
  runnerUp: number
} | null {
  let best: { from: { label: string; value: number }; to: { label: string; value: number }; delta: number } | null =
    null
  let runnerUp = 0
  for (let index = 1; index < entry.points.length; index += 1) {
    const from = entry.points[index - 1]!
    const to = entry.points[index]!
    const delta = to.value - from.value
    if (!best || delta > best.delta) {
      if (best) runnerUp = Math.max(runnerUp, best.delta)
      best = { from, to, delta }
    } else {
      runnerUp = Math.max(runnerUp, delta)
    }
  }
  return best && best.delta > 0 ? { ...best, runnerUp } : null
}

/** Whether the series ever change places. */
function crossings(series: SeriesPoints[]): number {
  if (series.length < 2) return 0
  const length = Math.min(...series.map(entry => entry.points.length))
  let changes = 0
  let previous: string[] | null = null
  for (let index = 0; index < length; index += 1) {
    const order = [...series]
      .sort((a, b) => b.points[index]!.value - a.points[index]!.value)
      .map(entry => entry.key)
    if (previous && order.join('|') !== previous.join('|')) changes += 1
    previous = order
  }
  return changes
}

export function chartFindings(
  table: DataTable,
  spec: ChartSpec,
  geometry?: ChartGeometry,
): ChartFinding[] {
  const drawn =
    geometry ?? computeChartGeometry(table, spec, { width: 900, height: 540 })
  if (drawn.empty) return []

  const series = seriesFrom(drawn)
  if (series.length === 0) return []

  const findings: ChartFinding[] = []

  // The biggest mover, named as a multiple where that is exactly true.
  const changes = series
    .map(entry => ({ entry, change: changeSentence(entry) }))
    .filter(
      (item): item is { entry: SeriesPoints; change: NonNullable<ReturnType<typeof changeSentence>> } =>
        item.change !== null,
    )
    .sort((a, b) => b.change.magnitude - a.change.magnitude)

  const biggest = changes[0]
  if (biggest) {
    findings.push({
      id: 'biggest-move',
      text:
        series.length > 1
          ? `${biggest.change.text.replace(/\.$/, '')} — the steepest rise of the ${series.length}.`
          : biggest.change.text,
      working: biggest.change.working,
      series: biggest.entry.key,
    })
  }

  // Falls, counted rather than averaged away. Never cherry-picked: the count
  // is over every step on the chart, and the one named is simply the largest.
  const down = falls(series)
  const steps = series.reduce(
    (total, entry) => total + Math.max(0, entry.points.length - 1),
    0,
  )
  if (steps >= 4) {
    if (down.length === 0) {
      findings.push({
        id: 'never-falls',
        text: 'Nothing on this chart ever goes down.',
        working: `${steps} steps, every one level or up`,
        series: null,
      })
    } else {
      const largest = [...down].sort(
        (a, b) => a.to.value - a.from.value - (b.to.value - b.from.value),
      )[0]!
      findings.push({
        id: 'falls',
        text:
          down.length === 1
            ? `${largest.key} is the only thing that ever falls, at ${largest.to.label}.`
            : `${down.length} of the ${steps} steps go down; the largest is ${largest.key}'s at ${largest.to.label}.`,
        working: `${round(largest.from.value)} → ${round(largest.to.value)}, down ${round(largest.from.value - largest.to.value)}`,
        series: largest.key,
      })
    }
  }

  // The sharpest single step, where it stands clear of the next one.
  const jumps = series
    .map(entry => ({ entry, jump: largestJump(entry) }))
    .filter(
      (item): item is { entry: SeriesPoints; jump: NonNullable<ReturnType<typeof largestJump>> } =>
        item.jump !== null,
    )
    .sort((a, b) => b.jump.delta - a.jump.delta)
  const sharpest = jumps[0]
  if (sharpest && sharpest.jump.delta > sharpest.jump.runnerUp) {
    findings.push({
      id: 'largest-jump',
      text: `${sharpest.entry.key}'s largest jump was ${sharpest.jump.to.label}, up ${round(sharpest.jump.delta)}.`,
      working: `${round(sharpest.jump.from.value)} → ${round(sharpest.jump.to.value)} · next largest ${round(sharpest.jump.runnerUp)}`,
      series: sharpest.entry.key,
    })
  }

  // Whether the ranking ever changes is often the whole story.
  if (series.length > 1) {
    const changed = crossings(series)
    const length = Math.min(...series.map(entry => entry.points.length))
    findings.push(
      changed === 0
        ? {
            id: 'no-crossing',
            text: `The ${series.length} series never change places.`,
            working: `same order at all ${length} positions`,
            series: null,
          }
        : {
            id: 'crossing',
            text: `The order changes ${changed === 1 ? 'once' : `${changed} times`} across the chart.`,
            working: `${length} positions compared`,
            series: null,
          },
    )
  }

  // Where everything ends up, against where it began.
  if (series.length > 1) {
    const deltas = series.map(entry => ({
      key: entry.key,
      delta:
        entry.points[entry.points.length - 1]!.value - entry.points[0]!.value,
    }))
    const up = deltas.filter(entry => entry.delta > 0)
    if (up.length === deltas.length) {
      const totalFirst = series.reduce((sum, e) => sum + e.points[0]!.value, 0)
      const totalLast = series.reduce(
        (sum, e) => sum + e.points[e.points.length - 1]!.value,
        0,
      )
      findings.push({
        id: 'all-up',
        text: `All ${deltas.length} end higher than they started.`,
        working: `${deltas.map(entry => `+${round(entry.delta)}`).join(', ')} · total ${round(totalFirst)} → ${round(totalLast)}`,
        series: null,
      })
    }
  }

  return findings
}

/**
 * The chart, said aloud.
 *
 * Written from the same arithmetic as the findings, so it can never describe
 * a chart other than the one drawn. This is what a screen reader is handed,
 * and what travels with the figure when it is placed in a document.
 */
export function chartDescription(
  table: DataTable,
  spec: ChartSpec,
  geometry?: ChartGeometry,
): string {
  const drawn =
    geometry ?? computeChartGeometry(table, spec, { width: 900, height: 540 })
  if (drawn.empty) return drawn.message ?? 'An empty chart.'

  const series = seriesFrom(drawn)
  const form = spec.chart.type.replace(/-/g, ' ')
  const title = spec.title.trim()
  const parts: string[] = [`${form.charAt(0).toUpperCase()}${form.slice(1)} chart.`]
  if (title) parts.push(`${title}.`)

  const first = series[0]?.points[0]?.label
  const last = series[0]?.points[series[0]!.points.length - 1]?.label
  if (first && last && first !== last) parts.push(`${first} to ${last}.`)

  if (series.length === 1) {
    const only = series[0]!
    const values = only.points.map(point => point.value)
    parts.push(
      `${only.key}, from ${round(values[0]!)} to ${round(values[values.length - 1]!)}, low ${round(Math.min(...values))}, high ${round(Math.max(...values))}.`,
    )
  } else {
    parts.push(`${series.length} series.`)
    for (const entry of series) {
      const values = entry.points.map(point => point.value)
      const start = values[0]!
      const end = values[values.length - 1]!
      const direction = end > start ? 'rising to' : end < start ? 'falling to' : 'level at'
      parts.push(`${entry.key}, ${round(start)} ${direction} ${round(end)}.`)
    }
  }

  if (spec.chart.annotations.length > 0) {
    parts.push(
      `${spec.chart.annotations.length} note${spec.chart.annotations.length === 1 ? '' : 's'} on the chart: ${spec.chart.annotations.map(note => note.text).join('; ')}.`,
    )
  }

  parts.push('Table follows.')
  return parts.join(' ')
}
