import { useCallback, useState } from 'react'

/** Below this window width a side panel starts closed so the chart has room. */
export const NARROW_PANEL_WIDTH = 760

function initialOpen(storageKey: string): boolean {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'open') return true
    if (stored === 'closed') return false
  } catch {
    /* No storage: fall back to the width. */
  }
  return typeof window === 'undefined' || window.innerWidth >= NARROW_PANEL_WIDTH
}

/**
 * Whether a side panel is open, remembered per panel across reloads.
 * Only the person's choice is stored; until they make one, narrow windows
 * start with the panel closed.
 */
export function usePanelOpen(
  storageKey: string,
): [boolean, (next: boolean | ((open: boolean) => boolean)) => void] {
  const [open, setOpenState] = useState(() => initialOpen(storageKey))
  const setOpen = useCallback(
    (next: boolean | ((open: boolean) => boolean)) => {
      setOpenState(current => {
        const value = typeof next === 'function' ? next(current) : next
        try {
          localStorage.setItem(storageKey, value ? 'open' : 'closed')
        } catch {
          /* The toggle still works without storage. */
        }
        return value
      })
    },
    [storageKey],
  )
  return [open, setOpen]
}
