import { describe, expect, it } from 'vitest'
import {
  annotationFromBrush,
  annotationFromPoint,
  brushSelection,
  nearestPoint,
  normalizeBrush,
  summarizeBrush,
} from './chartInteraction'
import type { InteractivePoint } from './chartInteraction'

const points: InteractivePoint[] = [
  {
    id: 'a',
    cx: 10,
    cy: 20,
    value: 3,
    xLabel: '2020',
    seriesKey: 'sales',
    color: '#333',
  },
  {
    id: 'b',
    cx: 40,
    cy: 30,
    value: 9,
    xLabel: '2021',
    seriesKey: 'sales',
    color: '#333',
  },
  {
    id: 'c',
    cx: 90,
    cy: 80,
    value: 6,
    xLabel: '2022',
    seriesKey: 'sales',
    color: '#333',
  },
]

describe('chart interactions', () => {
  it('finds the nearest point within the threshold', () => {
    expect(nearestPoint(points, 42, 29, 10)?.id).toBe('b')
    expect(nearestPoint(points, 200, 200, 10)).toBeNull()
  })

  it('normalizes brush coordinates into plot bounds', () => {
    expect(
      normalizeBrush(
        { x: 100, y: 90 },
        { x: -10, y: 10 },
        { left: 0, right: 80, top: 20, bottom: 70 },
      ),
    ).toEqual({ x0: 0, x1: 80, y0: 20, y1: 70 })
  })

  it('summarizes selected points', () => {
    const summary = summarizeBrush(points, { x0: 0, x1: 50, y0: 0, y1: 50 })
    expect(summary).toEqual({
      count: 2,
      min: 3,
      max: 9,
      average: 6,
      change: 6,
    })
  })

  it('serializes deliberate annotations rather than transient interaction state', () => {
    const pointAnnotation = annotationFromPoint(points[0])
    expect(pointAnnotation.target).toMatchObject({
      kind: 'point',
      seriesKey: 'sales',
      xLabel: '2020',
      value: 3,
    })

    const selected = brushSelection(points, { x0: 0, x1: 50, y0: 0, y1: 50 })
    const rangeAnnotation = annotationFromBrush(
      selected,
      { count: 2, min: 3, max: 9, average: 6, change: 6 },
      { from: 12, to: 2 },
    )
    // Data coordinates only: the x labels at each end and the y extent in
    // axis units, never the brush rectangle.
    expect(rangeAnnotation?.target).toEqual({
      kind: 'range',
      x: { from: selected[0]!.xLabel, to: selected[selected.length - 1]!.xLabel },
      y: { from: 2, to: 12 },
      summary: { count: 2, min: 3, max: 9, average: 6, change: 6 },
    })
    expect(JSON.stringify(rangeAnnotation)).not.toMatch(/"x0"|"cx"/)
    expect(
      annotationFromBrush([], { count: 0, min: 0, max: 0, average: 0, change: 0 }, { from: 0, to: 1 }),
    ).toBeNull()
  })
})
