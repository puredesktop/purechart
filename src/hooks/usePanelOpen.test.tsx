import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { NARROW_PANEL_WIDTH, usePanelOpen } from './usePanelOpen'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const KEY = 'purechart.test.panelOpen'

function mount(): { open: () => boolean; toggle: () => void; unmount: () => void } {
  let state: ReturnType<typeof usePanelOpen> | undefined
  function Probe(): null {
    state = usePanelOpen(KEY)
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  act(() => root.render(<Probe />))
  return {
    open: () => state![0],
    toggle: () => act(() => state![1](value => !value)),
    unmount: () => act(() => root.unmount()),
  }
}

describe('usePanelOpen', () => {
  const width = window.innerWidth
  afterEach(() => {
    localStorage.removeItem(KEY)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  })

  it('starts open on a wide window and remembers a close across reloads', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    const first = mount()
    expect(first.open()).toBe(true)
    first.toggle()
    expect(first.open()).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('closed')
    first.unmount()
    const second = mount()
    expect(second.open()).toBe(false)
    second.unmount()
  })

  it('starts closed on a narrow window until the person opens it', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: NARROW_PANEL_WIDTH - 1 })
    const first = mount()
    expect(first.open()).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
    first.toggle()
    first.unmount()
    const second = mount()
    expect(second.open()).toBe(true)
    second.unmount()
  })
})
