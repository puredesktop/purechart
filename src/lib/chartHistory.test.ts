import { expect, it } from 'vitest'
import { ChartHistory } from './chartHistory'

it('bounds history and groups only matching edits inside the time window', () => {
  const h = new ChartHistory<number>(2)
  h.record(0, 'title', 0)
  h.record(1, 'title', 100)
  h.record(2, 'title', 900)
  h.record(3, 'caption', 950)
  expect(h.undo(4)).toBe(3)
  expect(h.undo(3)).toBe(2)
  expect(h.undo(2)).toBeUndefined()
  expect(h.redo(2)).toBe(3)
  h.record(3)
  expect(h.canRedo).toBe(false)
  h.reset()
  expect(h.canUndo).toBe(false)
})
