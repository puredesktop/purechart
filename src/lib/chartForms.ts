import { facetValues } from './chartFacet'
import type { ChartEncodings, ChartSpec, ChartType } from './chartSpec'
import { axisColumns, type DataTable } from './dataParse'

/**
 * What this table can show.
 *
 * A chart type is a consequence, not a first decision. Picking one from a
 * dropdown asks the person to translate a question they have into a geometry
 * they may not know the name of — and it lets them pick a form the data
 * cannot honestly support. So the table is read first, and each form is
 * offered with the job it does, the encodings that make it work, and, where
 * it does not work, the reason.
 */

export interface FormCandidate {
  type: ChartType
  /** What it shows, in the reader's words — not the name of the geometry. */
  job: string
  /** Why it suits this table, or why it does not. */
  because: string
  encodings: ChartEncodings
  facet: string | null
  /** False when the table cannot support it; still listed, with the reason. */
  supported: boolean
  /** Higher comes first. Unsupported forms sort below everything supported. */
  rank: number
}

interface Shape {
  /** Date columns, plus numeric columns that are really a time axis. */
  dates: string[]
  categoricals: string[]
  numerics: string[]
  rowCount: number
  /** A categorical column with few enough values to become series. */
  splitters: Array<{ name: string; values: number }>
}

function readShape(table: DataTable): Shape {
  const dates = axisColumns(table)
  const categoricals = table.columns
    .filter(column => column.type === 'string')
    .map(column => column.name)
  const numerics = table.columns
    .filter(column => column.type === 'number')
    .map(column => column.name)
    .filter(name => !dates.includes(name))
  const splitters = categoricals
    .map(name => ({ name, values: facetValues(table, name).length }))
    .filter(entry => entry.values >= 2 && entry.values <= 12)
    .sort((a, b) => a.values - b.values)
  return { dates, categoricals, numerics, rowCount: table.rows.length, splitters }
}

/**
 * The candidates, best first.
 *
 * "Best" means the form whose job the data most clearly supports, not the
 * most impressive drawing: a date column and one measure is a question about
 * change over time, and nothing else on the list answers that as well.
 */
export function suggestForms(table: DataTable): FormCandidate[] {
  const shape = readShape(table)
  if (table.columns.length === 0) return []

  const time = shape.dates[0] ?? null
  const measure = shape.numerics[0] ?? null
  const split = shape.splitters[0] ?? null
  const category = shape.categoricals[0] ?? null
  const secondMeasure = shape.numerics[1] ?? null

  const candidates: FormCandidate[] = []
  const add = (candidate: FormCandidate): void => {
    candidates.push(candidate)
  }
  const encodings = (
    x: string | null,
    y: string[],
    series: string | null,
  ): ChartEncodings => ({ x, y, series })

  if (time && measure) {
    add({
      type: 'line',
      job: split ? `How each ${singular(split.name)} moved` : 'How it moved',
      because: split
        ? `${time} runs in order, one measure follows it, and ${split.name} has ${split.values} values to follow separately.`
        : `${time} runs in order and there is a measure to follow along it: change is what this table is about.`,
      encodings: encodings(time, [measure], split?.name ?? null),
      facet: null,
      supported: true,
      rank: 100,
    })
  }

  if (measure && (category || time)) {
    const by = category ?? time!
    // "Which year is biggest" is not a question anyone has; totalling along a
    // time axis is, so the job is named for what it actually shows.
    const alongTime = by === time
    add({
      type: 'bar',
      job: alongTime
        ? `How much ${measure} in each ${singular(by)}`
        : `Which ${singular(by)} is biggest`,
      because: `One measure against ${by}, summed — a length from zero, which is the only honest way to compare sizes.`,
      encodings: encodings(by, [measure], null),
      facet: null,
      supported: true,
      rank: time && split ? 80 : 90,
    })
  }

  if (time && measure && split) {
    add({
      type: 'stacked-bar',
      job: 'What makes up each total',
      because: `Only honest if the ${split.values} parts really do sum to the whole — check that before using it.`,
      encodings: encodings(time, [measure], split.name),
      facet: null,
      supported: true,
      rank: 70,
    })
  }

  if (measure && secondMeasure) {
    add({
      type: 'scatter',
      job: `Whether ${measure} and ${secondMeasure} move together`,
      because:
        'Two numeric columns, so a relationship is on the table. Past three colours this form has to be faceted.',
      encodings: encodings(measure, [secondMeasure], split?.name ?? null),
      facet: null,
      supported: true,
      rank: 60,
    })
  } else {
    add({
      type: 'scatter',
      job: 'Whether two measures move together',
      because:
        measure === null
          ? 'No numeric column to plot.'
          : 'Only one numeric column, so there is no second measure to plot it against.',
      encodings: encodings(measure, [], null),
      facet: null,
      supported: false,
      rank: 0,
    })
  }

  if (split && measure && time) {
    add({
      type: 'line',
      job: `One panel per ${singular(split.name)}`,
      because: `${split.values} panels on one scale — this is the form that gets clearer as the categories multiply, rather than worse.`,
      encodings: encodings(time, [measure], null),
      facet: split.name,
      supported: true,
      rank: split.values > 3 ? 85 : 50,
    })
  }

  if (measure) {
    add({
      type: 'histogram',
      job: `How ${measure} is spread`,
      because:
        shape.rowCount >= 12
          ? `${shape.rowCount} rows is enough for the shape of the distribution to mean something.`
          : `Only ${shape.rowCount} rows — a histogram of this would be reading noise.`,
      encodings: encodings(null, [measure], null),
      facet: null,
      supported: shape.rowCount >= 12,
      rank: shape.rowCount >= 12 ? 40 : 0,
    })
  }

  return candidates.sort((a, b) => {
    if (a.supported !== b.supported) return a.supported ? -1 : 1
    return b.rank - a.rank
  })
}

/** Apply a candidate to a spec without disturbing anything else on it. */
export function applyForm(spec: ChartSpec, candidate: FormCandidate): ChartSpec {
  return {
    ...spec,
    chart: {
      ...spec.chart,
      type: candidate.type,
      encodings: { ...candidate.encodings },
      facet: { ...spec.chart.facet, column: candidate.facet },
    },
  }
}

/** "regions" → "region", so a job reads as a sentence. */
function singular(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('ies')) return `${lower.slice(0, -3)}y`
  if (lower.endsWith('ses') || lower.endsWith('xes')) return lower.slice(0, -2)
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1)
  return lower
}
