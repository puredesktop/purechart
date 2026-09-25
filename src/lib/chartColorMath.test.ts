import { describe, expect, it } from 'vitest'
import {
  colorDistance,
  colorPairs,
  contrastRatio,
  isHexColor,
  lightnessAndChroma,
  worstPair,
} from './chartColorMath'

describe('reading a colour', () => {
  it('accepts both hex shapes and rejects anything else', () => {
    expect(isHexColor('#2a78d6')).toBe(true)
    expect(isHexColor('2a78d6')).toBe(true)
    expect(isHexColor('#abc')).toBe(true)
    expect(isHexColor('rebeccapurple')).toBe(false)
    expect(isHexColor('#12345')).toBe(false)
  })

  it('reads the short form as the long one', () => {
    expect(colorDistance('#fff', '#ffffff')).toBeCloseTo(0, 6)
  })
})

describe('contrast against the paper', () => {
  it('measures a pale series colour as the relief rule would', () => {
    // Aqua on the chart surface: legal only with a visible label.
    expect(contrastRatio('#1baf7a', '#fcfcfb')).toBeCloseTo(2.74, 1)
  })

  it('does not care which way round the two are given', () => {
    expect(contrastRatio('#1baf7a', '#fcfcfb')).toBeCloseTo(
      contrastRatio('#fcfcfb', '#1baf7a'),
      6,
    )
  })
})

describe('distance between two series colours', () => {
  it('measures the blue/orange/aqua trio as safely apart', () => {
    // The worst adjacent pair of the three is aqua against orange.
    expect(colorDistance('#1baf7a', '#eb6834', 'deutan')).toBeCloseTo(9.2, 1)
    expect(colorDistance('#1baf7a', '#eb6834')).toBeCloseTo(27.6, 1)
  })

  it('catches a pair ordinary colour vision cannot separate', () => {
    // Pink against orange: below the floor of 15, with no deficiency at all.
    expect(colorDistance('#e87ba4', '#eb6834')).toBeCloseTo(12.9, 1)
  })

  it('reports nothing between a colour and itself', () => {
    expect(colorDistance('#2a78d6', '#2a78d6', 'protan')).toBeCloseTo(0, 6)
  })
})

describe('lightness and chroma', () => {
  it('reads a grey as having no chroma to speak of', () => {
    expect(lightnessAndChroma('#828b96').chroma).toBeLessThan(0.05)
  })

  it('reads a saturated hue as carrying chroma', () => {
    expect(lightnessAndChroma('#eb6834').chroma).toBeGreaterThan(0.1)
  })
})

describe('which pairs are on screen at once', () => {
  const colors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']
  const labels = ['Essays', 'Fiction', 'Poetry', 'Reportage', 'Zines']

  it('checks only neighbours for a line chart', () => {
    expect(colorPairs(colors, labels, 'adjacent')).toHaveLength(4)
  })

  it('checks every pair once for a scatter', () => {
    expect(colorPairs(colors, labels, 'all')).toHaveLength(10)
  })

  it('names the pair a reader would struggle with, by its series name', () => {
    const worst = worstPair(colorPairs(colors, labels, 'all'), 'normal')!
    expect([worst.firstLabel, worst.secondLabel].sort()).toEqual([
      'Fiction',
      'Zines',
    ])
    expect(worst.normal).toBeCloseTo(12.9, 1)
  })

  it('reports the worse of protanopia and deutanopia, and says which', () => {
    const worst = worstPair(colorPairs(colors, labels, 'all'), 'cvd')!
    expect(worst.cvd).toBeLessThan(worst.normal)
    expect(['protan', 'deutan']).toContain(worst.cvdVision)
  })

  it('has no pair to report for a single series', () => {
    expect(worstPair(colorPairs(['#2a78d6'], ['One'], 'all'), 'normal')).toBeNull()
  })
})
