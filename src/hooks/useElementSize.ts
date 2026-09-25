import { useEffect, useRef, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** Observe an element's content box; falls back to a sensible default before measure. */
export function useElementSize<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>
  size: ElementSize
} {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<ElementSize>({ width: 640, height: 400 })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(240, Math.round(rect.height)),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, size }
}
