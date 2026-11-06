/**
 * Trendlines: a fitted curve through one series, with the equation and how
 * much of the variation it explains.
 *
 * A trendline is a claim about the data, so it travels with its R². A
 * straight line through a cloud that it explains 4% of is drawn just as
 * confidently as one that explains 96%; the number is what tells them apart,
 * and the line is never shown without it.
 */

export type TrendKind = 'linear' | 'exponential' | 'polynomial'

export interface TrendSpec {
  kind: TrendKind
  /** Polynomial degree, 2 or 3. Ignored for the other kinds. */
  degree?: 2 | 3
}

export interface TrendFit {
  kind: TrendKind
  degree: number
  /** y for an x in data units (dates as milliseconds, categories by position). */
  predict: (x: number) => number
  /** Coefficients, lowest power first; for exponential, [a, b] in y = a·e^(bx). */
  coefficients: number[]
  /** Share of the variation in y the fit explains, 0–1, measured in y. */
  r2: number
  /** "y = 2.1x + 40", in the units the fit was made in. */
  equation: string
  points: number
}

export const TREND_KINDS: TrendKind[] = ['linear', 'exponential', 'polynomial']

export function sanitizeTrend(value: unknown): TrendSpec | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<TrendSpec>
  if (!TREND_KINDS.includes(raw.kind as TrendKind)) return null
  return raw.kind === 'polynomial'
    ? { kind: 'polynomial', degree: raw.degree === 3 ? 3 : 2 }
    : { kind: raw.kind as TrendKind }
}

export function trendName(trend: TrendSpec): string {
  if (trend.kind === 'linear') return 'Straight line'
  if (trend.kind === 'exponential') return 'Exponential'
  return trend.degree === 3 ? 'Curve, third degree' : 'Curve, second degree'
}

/**
 * Solve a small linear system by Gaussian elimination with partial pivoting.
 * Returns null when the system is singular (every x the same, say).
 */
function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length
  const a = matrix.map((row, i) => [...row, vector[i]!])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot]!, a[col]!]
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row]![col]! / a[col]![col]!
      for (let k = col; k <= n; k += 1) a[row]![k]! -= factor * a[col]![k]!
    }
  }
  const out = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = a[row]![n]!
    for (let k = row + 1; k < n; k += 1) sum -= a[row]![k]! * out[k]!
    out[row] = sum / a[row]![row]!
  }
  return out
}

/** Least-squares polynomial of the given degree, coefficients lowest first. */
function polyfit(xs: number[], ys: number[], degree: number): number[] | null {
  const size = degree + 1
  const matrix = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  const vector = new Array<number>(size).fill(0)
  for (let i = 0; i < xs.length; i += 1) {
    const powers = [1]
    for (let p = 1; p <= degree * 2; p += 1) powers.push(powers[p - 1]! * xs[i]!)
    for (let row = 0; row < size; row += 1) {
      vector[row]! += powers[row]! * ys[i]!
      for (let col = 0; col < size; col += 1) matrix[row]![col]! += powers[row + col]!
    }
  }
  return solve(matrix, vector)
}

function evaluate(coefficients: number[], x: number): number {
  let total = 0
  for (let i = coefficients.length - 1; i >= 0; i -= 1) total = total * x + coefficients[i]!
  return total
}

function rSquared(xs: number[], ys: number[], predict: (x: number) => number): number {
  const mean = ys.reduce((sum, y) => sum + y, 0) / ys.length
  let total = 0
  let residual = 0
  for (let i = 0; i < xs.length; i += 1) {
    total += (ys[i]! - mean) ** 2
    residual += (ys[i]! - predict(xs[i]!)) ** 2
  }
  if (total === 0) return residual === 0 ? 1 : 0
  return Math.max(0, 1 - residual / total)
}

function round(value: number): string {
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e6 || magnitude < 1e-3) return value.toExponential(2)
  return String(Number(value.toPrecision(3)))
}

function signed(value: number, term: string): string {
  return `${value < 0 ? '−' : '+'} ${round(Math.abs(value))}${term}`
}

function polynomialEquation(coefficients: number[]): string {
  const terms: string[] = []
  for (let power = coefficients.length - 1; power >= 0; power -= 1) {
    const c = coefficients[power]!
    const term = power === 0 ? '' : power === 1 ? 'x' : `x${power === 2 ? '²' : '³'}`
    if (terms.length === 0) terms.push(`${c < 0 ? '−' : ''}${round(Math.abs(c))}${term}`)
    else terms.push(signed(c, term))
  }
  return `y = ${terms.join(' ')}`
}

/**
 * Fit a trend through (x, y) pairs.
 *
 * Polynomials are fitted on x rescaled to [0, 1]: raw dates are ~1.7e12 ms,
 * and their cubes overflow the precision of the normal equations long before
 * the curve itself is in doubt. The equation is reported in that rescaled x
 * when it is not the data's own, and says so.
 */
export function fitTrend(
  pairs: Array<{ x: number; y: number }>,
  trend: TrendSpec,
): TrendFit | { error: string } {
  const clean = pairs.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  const degree = trend.kind === 'polynomial' ? (trend.degree ?? 2) : 1
  if (clean.length < degree + 2) {
    return { error: `A ${trendName(trend).toLowerCase()} needs at least ${degree + 2} points.` }
  }
  const xs = clean.map(p => p.x)
  const ys = clean.map(p => p.y)
  let lo = Infinity
  let hi = -Infinity
  for (const x of xs) {
    if (x < lo) lo = x
    if (x > hi) hi = x
  }
  if (lo === hi) return { error: 'Every point has the same x, so there is no trend to fit.' }

  if (trend.kind === 'exponential') {
    if (ys.some(y => y <= 0)) return { error: 'An exponential trend needs every value above zero.' }
    const span = hi - lo
    const unit = (x: number) => (x - lo) / span
    const fit = polyfit(xs.map(unit), ys.map(y => Math.log(y)), 1)
    if (!fit) return { error: 'These points do not support an exponential trend.' }
    const [logA, b] = fit as [number, number]
    const predict = (x: number) => Math.exp(logA + b * unit(x))
    const rescaled = lo !== 0 || span !== 1
    return {
      kind: 'exponential',
      degree: 1,
      predict,
      coefficients: [Math.exp(logA), b],
      r2: rSquared(xs, ys, predict),
      equation: `y = ${round(Math.exp(logA))}·e^(${round(b)}${rescaled ? 't' : 'x'})${rescaled ? ', t from 0 at the first point to 1 at the last' : ''}`,
      points: clean.length,
    }
  }

  // A straight line is well conditioned in the data's own units, so its
  // equation can be read off the axis directly; only curves are rescaled.
  if (degree === 1) {
    const fit = polyfit(xs.map(x => x - lo), ys, 1)
    if (!fit) return { error: 'These points do not support a straight line.' }
    const slope = fit[1]!
    const intercept = fit[0]! - slope * lo
    const predict = (x: number) => intercept + slope * x
    return {
      kind: 'linear',
      degree: 1,
      predict,
      coefficients: [intercept, slope],
      r2: rSquared(xs, ys, predict),
      equation: `y = ${round(slope)}x ${signed(intercept, '')}`,
      points: clean.length,
    }
  }

  const span = hi - lo
  const unit = (x: number) => (x - lo) / span
  const fit = polyfit(xs.map(unit), ys, degree)
  if (!fit) return { error: 'These points do not support a curve of that degree.' }
  const predict = (x: number) => evaluate(fit, unit(x))
  return {
    kind: 'polynomial',
    degree,
    predict,
    coefficients: fit,
    r2: rSquared(xs, ys, predict),
    equation: `${polynomialEquation(fit).replace(/x/g, 't')}, t from 0 at the first point to 1 at the last`,
    points: clean.length,
  }
}

/** "R² 0.93": the label a trendline always carries. */
export function r2Label(r2: number): string {
  return `R² ${r2.toFixed(2)}`
}
