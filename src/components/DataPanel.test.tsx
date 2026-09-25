import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { DataPanel } from './DataPanel'
import { parseTable } from '../lib/dataParse'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('handles large clipboard text in one controlled update, preserving the selected replacement and leaving source unapplied', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onPasteText = vi.fn()
  const source = 'x,y\n0,0\n9,9'
  try {
    await act(async () => root.render(<DataPanel sourceText={source} table={parseTable(source)} onPasteText={onPasteText} />))
    const field = container.querySelector('textarea')!
    field.setSelectionRange(4, 7)
    const block = Array.from({ length: 6000 }, (_, i) => `${i},100`).join('\n')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => block } })
    await act(async () => { field.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    expect(field.value).toBe(`x,y\n${block}\n9,9`)
    expect(onPasteText).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Import preview · 6001 rows')
    const apply = [...container.querySelectorAll('button')].find(button => button.textContent === 'Apply data')!
    await act(async () => { apply.click() })
    expect(onPasteText).toHaveBeenCalledWith(`x,y\n${block}\n9,9`)
  } finally { await act(async () => root.unmount()); container.remove() }
})
