import { describe, expect, it } from 'vitest'
import { fitTrend, r2Label, sanitizeTrend } from './chartTrend'

const line = [1, 2, 3, 4, 5].map(x => ({ x, y: 3 * x + 2 }))

describe('trendlines', () => {
  it('recovers a straight line exactly, in the data\'s own units', () => {
    const fit = fitTrend(line, { kind: 'linear' })
    if ('error' in fit) throw new Error(fit.error)
    expect(fit.coefficients[1]).toBeCloseTo(3)
    expect(fit.coefficients[0]).toBeCloseTo(2)
    expect(fit.r2).toBeCloseTo(1)
    expect(fit.equation).toBe('y = 3x + 2')
  })

  it('keeps precision on millisecond dates', () => {
    const day = 86_400_000
    const start = Date.UTC(2026, 0, 1)
    const pairs = [0, 1, 2, 3, 4, 5].map(i => ({ x: start + i * day, y: 10 + i * i }))
    const fit = fitTrend(pairs, { kind: 'polynomial', degree: 2 })
    if ('error' in fit) throw new Error(fit.error)
    expect(fit.r2).toBeCloseTo(1, 6)
    expect(fit.predict(start + 6 * day)).toBeCloseTo(46, 4)
  })

  it('fits growth as an exponential and refuses values at or below zero', () => {
    const growth = [0, 1, 2, 3, 4].map(x => ({ x, y: 5 * Math.exp(0.4 * x) }))
    const fit = fitTrend(growth, { kind: 'exponential' })
    if ('error' in fit) throw new Error(fit.error)
    expect(fit.r2).toBeCloseTo(1)
    expect(fit.predict(4)).toBeCloseTo(5 * Math.exp(1.6))
    expect(fitTrend([...growth, { x: 5, y: 0 }], { kind: 'exponential' })).toEqual({ error: 'An exponential trend needs every value above zero.' })
  })

  it('reports how little a line explains of a cloud', () => {
    const cloud = [{ x: 1, y: 5 }, { x: 2, y: 1 }, { x: 3, y: 6 }, { x: 4, y: 2 }, { x: 5, y: 5 }]
    const fit = fitTrend(cloud, { kind: 'linear' })
    if ('error' in fit) throw new Error(fit.error)
    expect(fit.r2).toBeLessThan(0.1)
    expect(r2Label(fit.r2)).toMatch(/^R² 0\.0\d$/)
  })

  it('needs enough points and some spread in x', () => {
    expect(fitTrend([{ x: 1, y: 1 }, { x: 2, y: 2 }], { kind: 'polynomial', degree: 3 })).toHaveProperty('error')
    expect(fitTrend([1, 2, 3].map(y => ({ x: 4, y })), { kind: 'linear' })).toHaveProperty('error')
  })

  it('reads only kinds it can draw', () => {
    expect(sanitizeTrend({ kind: 'polynomial', degree: 7 })).toEqual({ kind: 'polynomial', degree: 2 })
    expect(sanitizeTrend({ kind: 'moving-average' })).toBeNull()
  })
})
