/**
 * The computable half of chart colour.
 *
 * Whether two series can be told apart is arithmetic, not taste, so the app
 * computes it rather than asking anyone to squint. Distances are Euclidean in
 * OKLab ×100; colour-vision deficiency is simulated with the Machado, Oliveira
 * & Fernandes (2009) transforms at full severity, and the thresholds below are
 * calibrated to that model — swapping the simulation would mean recalibrating
 * them.
 */

/** OKLab distance below which ordinary colour vision cannot separate a pair. */
export const NORMAL_VISION_FLOOR = 15
/** The distance a pair should reach under simulated CVD. */
export const CVD_TARGET = 8
/** Below this under CVD, colour alone cannot carry the distinction at all. */
export const CVD_FLOOR = 6
/** WCAG ratio a mark needs against the surface to stand on its own. */
export const CONTRAST_MIN = 3

export type ColorVision = 'protan' | 'deutan' | 'tritan'

const MACHADO: Record<ColorVision, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/
const SHORT_HEX_RE = /^#?[0-9a-fA-F]{3}$/

/** Accepts `#rgb` and `#rrggbb`, with or without the hash. */
export function isHexColor(value: string): boolean {
  const trimmed = value.trim()
  return HEX_RE.test(trimmed) || SHORT_HEX_RE.test(trimmed)
}

function normalizeHex(value: string): string {
  const raw = value.trim().replace(/^#/, '')
  if (raw.length === 3) {
    return raw
      .split('')
      .map(character => character + character)
      .join('')
      .toLowerCase()
  }
  return raw.toLowerCase()
}

function srgbChannels(hex: string): [number, number, number] {
  const raw = normalizeHex(hex)
  return [0, 2, 4].map(index =>
    Number.parseInt(raw.slice(index, index + 2), 16) / 255,
  ) as [number, number, number]
}

function toLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

function linearChannels(hex: string): [number, number, number] {
  const [r, g, b] = srgbChannels(hex)
  return [toLinear(r), toLinear(g), toLinear(b)]
}

function oklabFromLinear([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab lightness and chroma, the two numbers a palette is judged on. */
export function lightnessAndChroma(hex: string): {
  lightness: number
  chroma: number
} {
  const [lightness, a, b] = oklabFromLinear(linearChannels(hex))
  return { lightness, chroma: Math.hypot(a, b) }
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = linearChannels(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours, in either order. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  const high = Math.max(first, second)
  const low = Math.min(first, second)
  return (high + 0.05) / (low + 0.05)
}

function simulate(
  hex: string,
  vision: ColorVision,
): [number, number, number] {
  const [r, g, b] = linearChannels(hex)
  const matrix = MACHADO[vision]
  const clamp = (value: number): number => Math.max(0, Math.min(1, value))
  return [
    clamp(matrix[0]![0]! * r + matrix[0]![1]! * g + matrix[0]![2]! * b),
    clamp(matrix[1]![0]! * r + matrix[1]![1]! * g + matrix[1]![2]! * b),
    clamp(matrix[2]![0]! * r + matrix[2]![1]! * g + matrix[2]![2]! * b),
  ]
}

/**
 * Distance between two colours in OKLab ×100. With no vision named the
 * distance is for ordinary colour vision.
 */
export function colorDistance(
  first: string,
  second: string,
  vision?: ColorVision,
): number {
  const a = oklabFromLinear(
    vision ? simulate(first, vision) : linearChannels(first),
  )
  const b = oklabFromLinear(
    vision ? simulate(second, vision) : linearChannels(second),
  )
  return (
    100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  )
}

export interface ColorPairReading {
  first: string
  second: string
  firstLabel: string
  secondLabel: string
  /** Distance to ordinary colour vision. */
  normal: number
  /** The worse of protanopia and deutanopia — the pair's real CVD floor. */
  cvd: number
  /** Which of the two produced that reading. */
  cvdVision: ColorVision
  tritan: number
}

/**
 * Every pair that will be on screen at once.
 *
 * Lines and stacked bars are read against their neighbours, so adjacent pairs
 * are what matter. A scatter or a set of small multiples puts every colour
 * beside every other, so all pairs are in play — and far fewer of them can
 * pass.
 */
export function colorPairs(
  colors: readonly string[],
  labels: readonly string[],
  scope: 'adjacent' | 'all',
): ColorPairReading[] {
  const readings: ColorPairReading[] = []
  const name = (index: number): string => labels[index] ?? `Series ${index + 1}`

  const push = (a: number, b: number): void => {
    const first = colors[a]!
    const second = colors[b]!
    const protan = colorDistance(first, second, 'protan')
    const deutan = colorDistance(first, second, 'deutan')
    readings.push({
      first,
      second,
      firstLabel: name(a),
      secondLabel: name(b),
      normal: colorDistance(first, second),
      cvd: Math.min(protan, deutan),
      cvdVision: protan <= deutan ? 'protan' : 'deutan',
      tritan: colorDistance(first, second, 'tritan'),
    })
  }

  if (scope === 'adjacent') {
    for (let index = 1; index < colors.length; index += 1) push(index - 1, index)
    return readings
  }
  for (let a = 0; a < colors.length; a += 1) {
    for (let b = a + 1; b < colors.length; b += 1) push(a, b)
  }
  return readings
}

/** The pair a reader would struggle with first, or null for a single colour. */
export function worstPair(
  readings: readonly ColorPairReading[],
  by: 'normal' | 'cvd',
): ColorPairReading | null {
  let worst: ColorPairReading | null = null
  for (const reading of readings) {
    if (!worst || reading[by] < worst[by]) worst = reading
  }
  return worst
}
