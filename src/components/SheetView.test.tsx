// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { SheetView } from './SheetView'
import { defaultSpec } from '../lib/chartSpec'
import { sheetFromSpec } from '../lib/chartSheet'
import { parseDelimited } from '../lib/dataParse'
const start = vi.hoisted(() => vi.fn())
vi.mock('@purescience/platform-ui/bridge/assetDrag', () => ({ startAssetPointerDrag: start }))
vi.mock('@purescience/platform-ui/components/assets/CrossAppDragHandle', () => ({CrossAppDragHandle: () => null}))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
it('drags the chart graphic while keeping an ordinary click for opening it', async () => {
 const table = parseDelimited('month,value\nJan,2\nFeb,5')
 const spec = defaultSpec('Sheet chart');spec.chart.encodings.x='month';spec.chart.encodings.y=['value']
 const sheet = sheetFromSpec(spec), onFocus=vi.fn()
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 await act(async()=>root.render(<SheetView sheet={sheet} table={table} onFocus={onFocus} onAdd={()=>{}} onDuplicate={()=>{}} onRemove={()=>{}}/>))
 const drawing=host.querySelector<HTMLElement>('[title="Drag chart to the app beside this one"]')!
 const pointer=(type:string,x:number)=>drawing.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:10,button:0,pointerId:1}))
 await act(async()=>{pointer('pointerdown',10);pointer('pointermove',30);drawing.click()})
 expect(start).toHaveBeenCalledOnce()
 const transfer=await start.mock.calls[0][1]()
 expect(transfer.name).toBe('Sheet chart.svg')
 expect(transfer.dataUrl).toMatch(/^data:image\/svg\+xml/)
 expect(onFocus).not.toHaveBeenCalled()
 await act(async()=>{pointer('pointerdown',10);drawing.click()})
 expect(onFocus).toHaveBeenCalledWith(sheet.charts[0].id)
 await act(async()=>root.unmount());host.remove()
})
