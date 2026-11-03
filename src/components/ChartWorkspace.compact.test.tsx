import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useChartSession, type ChartSession } from '../hooks/useChartSession'
import { createChartAgentSpec } from '../lib/agentChartTools'
import { serializeSheet, sheetFromSpec } from '../lib/chartSheet'
import { ChartWorkspace } from './ChartWorkspace'

const saved = vi.hoisted(() => ({ settings: [] as unknown[], file: null as string | null }))
vi.mock('../bridge/platformBridge', () => ({
  isStandaloneDevMode: () => false,
  readTextFile: async () => { if (saved.file === null) throw new Error('nothing on disk'); return saved.file },
  writeTextFile: vi.fn(), updateChartSettings: async (patch: unknown) => { saved.settings.push(patch); return {} },
  deleteFile: vi.fn(), updateAssetMetadata: vi.fn(), writeBinaryFile: vi.fn(), openAssistantDrawer: vi.fn(),
}))
vi.mock('@purescience/platform-ui/components/assets/CrossAppDragHandle', () => ({ CrossAppDragHandle: () => <span data-testid="drag" /> }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root, container: HTMLDivElement, session: ChartSession
function Host({ compact }: { compact: boolean }) {
  session = useChartSession({ beforeOpen: async () => {}, ready: false, appSettings: {}, resource: null, onResourceHandled: () => {} })
  return <ChartWorkspace session={session} svgRef={{ current: null }} onCommitTitle={() => {}} compact={compact} saveStatus="Saved" />
}
const controls = () => container.querySelector<HTMLElement>('#purechart-controls')!
const isHiddenByCompact = (element: Element | null) => element?.closest('[data-compact="hide"]') !== null

beforeEach(async () => {
  localStorage.setItem('purechart.controlsOpen', 'open')
  saved.file = null
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Host compact />))
  const made = createChartAgentSpec({ title: 'Sales', dataText: 'region,value\nA,40\nB,50', type: 'bar' })
  await act(async () => { await session.createDocument(made.spec, made.table) })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); localStorage.clear() })

it('held in a page, the chart has the box: the one chart is open and the controls are closed', () => {
  expect(session.sheet.focusedId).toBe(session.sheet.charts[0]!.id)
  expect(controls().hidden).toBe(true)
  expect(container.querySelector('[data-compact="workspace"]')?.getAttribute('data-controls-hidden')).toBe('true')
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Chart name"]')?.value).toBeTruthy()
  expect(isHiddenByCompact(container.querySelector('footer'))).toBe(true)
})

it('the controls open beside the chart and only what edits it stays; the full app\'s own choice is untouched', async () => {
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Show controls"]')!.click() })
  expect(controls().hidden).toBe(false)
  const visible = [...controls().querySelectorAll('nav button')].filter(tab => !isHiddenByCompact(tab)).map(tab => tab.textContent)
  expect(visible).toEqual(['Data', 'Chart', 'Style'])
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Hide controls"]')!.click() })
  expect(controls().hidden).toBe(true)
  expect(localStorage.getItem('purechart.controlsOpen')).toBe('open')
})

it('Full app gives the whole app back with the same chart on screen and no remount', async () => {
  const name = container.querySelector('input[aria-label="Chart name"]')
  const focused = session.sheet.focusedId
  await act(async () => root.render(<Host compact={false} />))
  expect(session.sheet.focusedId).toBe(focused)
  expect(container.querySelector('[data-compact]')).toBeNull()
  expect(controls().hidden).toBe(false)
  expect(container.querySelector('input[aria-label="Chart name"]')).toBe(name)
})

it('opening the only chart to look at it is not an edit, so a look saves nothing', async () => {
  saved.file = serializeSheet(sheetFromSpec(createChartAgentSpec({ title: 'On disk', dataText: 'region,value\nA,1\nB,2', type: 'bar' }).spec))
  await act(async () => { await session.openChartPath('/Documents/on-disk.chart') })
  expect(session.sheet.focusedId).toBe(session.sheet.charts[0]!.id)
  expect(session.isLoadedSheet(session.sheet)).toBe(true)
})
