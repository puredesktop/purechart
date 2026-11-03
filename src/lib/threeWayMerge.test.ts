import { describe, expect, it } from 'vitest'
import { threeWayMerge } from './threeWayMerge'

const item = (id: string, name = id) => ({ id, name })

describe('threeWayMerge', () => {
  it('keeps a change from either side', () => {
    const base = { title: 'a', note: 'x' }
    expect(threeWayMerge(base, { title: 'b', note: 'x' }, { title: 'a', note: 'y' })).toEqual({ title: 'b', note: 'y' })
  })

  it('keeps its own where both changed the same value', () => {
    expect(threeWayMerge({ title: 'a' }, { title: 'mine' }, { title: 'theirs' })).toEqual({ title: 'mine' })
  })

  it('leaves own fields alone whichever side moved', () => {
    const merged = threeWayMerge({ focus: 'a', view: { zoom: 1 }, n: 1 }, { focus: 'a', view: { zoom: 1 }, n: 1 }, { focus: 'b', view: { zoom: 2 }, n: 2 }, { ownFields: ['focus', 'view.zoom'] })
    expect(merged).toEqual({ focus: 'a', view: { zoom: 1 }, n: 2 })
  })

  it('merges lists by id: both added, in place', () => {
    const base = { items: [item('a'), item('b')] }
    const merged = threeWayMerge(base, { items: [item('a'), item('b'), item('mine')] }, { items: [item('a'), item('theirs'), item('b')] })
    expect(merged.items.map(entry => entry.id)).toEqual(['a', 'theirs', 'b', 'mine'])
  })

  it('merges inside an item both changed', () => {
    const base = { items: [{ id: 'a', x: 1, y: 1 }] }
    expect(threeWayMerge(base, { items: [{ id: 'a', x: 2, y: 1 }] }, { items: [{ id: 'a', x: 1, y: 2 }] }).items).toEqual([{ id: 'a', x: 2, y: 2 }])
  })

  it('a removal stands against no change, on either side', () => {
    const base = { items: [item('a'), item('b'), item('c')] }
    const merged = threeWayMerge(base, { items: [item('a'), item('b')] }, { items: [item('b'), item('c')] })
    expect(merged.items.map(entry => entry.id)).toEqual(['b'])
  })

  it('an edit beats a removal', () => {
    const base = { items: [item('a')] }
    expect(threeWayMerge(base, { items: [] }, { items: [item('a', 'edited')] }).items).toEqual([item('a', 'edited')])
    expect(threeWayMerge(base, { items: [item('a', 'edited')] }, { items: [] }).items).toEqual([item('a', 'edited')])
  })

  it('reads ids where a list keeps them elsewhere', () => {
    const idOf = (entry: unknown) => (entry as { data?: { id?: string } }).data?.id ?? null
    const base = { elements: [{ data: { id: 'n1' } }] }
    const merged = threeWayMerge(base, { elements: [{ data: { id: 'n1' } }, { data: { id: 'mine' } }] }, { elements: [{ data: { id: 'n1' } }, { data: { id: 'theirs' } }] }, { idOf })
    expect(merged.elements.map(entry => entry.data.id).sort()).toEqual(['mine', 'n1', 'theirs'])
  })

  it('a list without ids is one value', () => {
    expect(threeWayMerge({ phases: ['a'] }, { phases: ['a', 'b'] }, { phases: ['a', 'c'] })).toEqual({ phases: ['a', 'b'] })
  })
})
