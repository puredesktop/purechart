import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { ChartSession } from './hooks/useChartSession'
import type { ChartDocumentActions } from './hooks/usePureChartAgentTools'
const state = vi.hoisted(() => ({
  files: new Map<string, string>(),
  writes: [] as string[],
  listeners: new Set<(change: { kind: string; path: string }) => void>(),
  session: null as unknown as ChartSession,
  actions: null as unknown as ChartDocumentActions,
}))
vi.mock('./bridge/platformBridge', () => ({
  isStandaloneDevMode: () => false,
  readTextFile: async (path: string) => { if (!state.files.has(path)) throw new Error(`Missing ${path}`); return state.files.get(path)! },
  writeTextFile: async (path: string, text: string) => { state.files.set(path, text) },
  updateChartSettings: async () => ({}), deleteFile: vi.fn(), updateAssetMetadata: vi.fn(), writeBinaryFile: vi.fn(),
}))
vi.mock('@purescience/platform-ui/bridge/documents', () => ({
  registerPlatformAppObject: vi.fn(),
  createPlatformDraft: async ({ title, files }: { title: string; files: { name: string; content: string }[] }) => {
    const path = `/Drafts/${title}.chart`
    files.forEach(file => state.files.set(`${path}/${file.name}`, file.content))
    return { path }
  },
  autosavePlatformDocument: async ({ path, files }: { path: string; files: { name: string | null; content: string }[] }) => {
    state.writes.push(path)
    files.forEach(file => state.files.set(file.name ? `${path}/${file.name}` : path, file.content))
    return { savedAt: new Date().toISOString() }
  },
  onPlatformDocumentsChanged: (listener: (change: { kind: string; path: string }) => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener) }, touchPlatformRecentDocument: async () => {},
  duplicatePlatformDocument: vi.fn(), promotePlatformDocument: vi.fn(), renamePlatformDocument: vi.fn(),
}))
vi.mock('@purescience/platform-ui/bridge/client', () => ({ bridge: { onEvent: () => () => {}, call: async () => ({}) } }))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformBridge', () => ({ usePlatformBridge: () => ({ ready: true, meta: {}, error: null }) }))
vi.mock('@purescience/platform-ui/bridge/react/usePlatformViewportResource', () => ({ usePlatformViewportResource: () => ({ resource: null, clearResource: () => {} }) }))
vi.mock('@purescience/platform-ui/bridge/react/useDocumentHotkeys', () => ({ useDocumentHotkeys: () => {} }))
vi.mock('./hooks/usePureChartBoot', () => ({ usePureChartBoot: () => ({ boot: { appSettings: {} }, bootError: null }) }))
vi.mock('./hooks/useWorkspaceDocumentBinding', () => ({ useWorkspaceDocumentBinding: () => ({ error: null }) }))
vi.mock('./hooks/useChartRecovery', () => ({ useChartRecovery: () => ({ entries: [], error: null, capture: () => true, saved: () => {} }) }))
vi.mock('./hooks/usePureChartAgentTools', () => ({ usePureChartAgentTools: (_ready: boolean, session: ChartSession, actions: ChartDocumentActions) => { state.session = session; state.actions = actions } }))
vi.mock('@purescience/platform-bridge/components/AppFrame', () => ({ AppFrame: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@purescience/platform-ui/components/common/documents', () => ({ DocumentHeaderActions: () => null, DocumentSwitcher: () => null }))
vi.mock('./components/ChartWorkspace', () => ({ ChartWorkspace: () => null }))
import { App } from './App'
import { createChartAgentSpec } from './lib/agentChartTools'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('keeps same-turn create/save and open/save bound to the right complete document before React rerenders', async () => {
  state.files.clear()
  const root = createRoot(document.createElement('div'))
  try {
    await act(async () => { root.render(<App />) })
    const first = createChartAgentSpec({ title: 'First', dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
    await act(async () => { await state.session.createDocument(first.spec, first.table); await state.actions.saveDocument() })
    const firstContent = state.files.get('/Drafts/First.chart/chart.json')!
    expect(JSON.parse(firstContent).title).toBe('First')
    const second = createChartAgentSpec({ title: 'Second', dataText: 'region,value\nA,40\nB,50', type: 'bar' })
    // Retain the pre-update actions; act defers React's next committed render.
    const session = state.session, actions = state.actions
    await act(async () => {
      await session.createDocument(second.spec, second.table)
      expect(await actions.saveDocument()).toBe('/Drafts/Second.chart')
      expect(state.files.get('/Drafts/First.chart/chart.json')).toBe(firstContent)
      expect(JSON.parse(state.files.get('/Drafts/Second.chart/chart.json')!).data.inline.text).toBe(second.spec.data.inline!.text)
      expect(await session.openChartPath('/Drafts/First.chart')).toBeNull()
      expect(await actions.saveDocument()).toBe('/Drafts/First.chart')
    })
    expect(state.files.get('/Drafts/First.chart/chart.json')).toBe(firstContent)
    expect(JSON.parse(state.files.get('/Drafts/Second.chart/chart.json')!).title).toBe('Second')
  } finally { await act(async () => root.unmount()) }
})


it('reloads another window’s saved chart without writing the stale chart back or scheduling an echo save', async () => {
  vi.useFakeTimers()
  state.files.clear(); state.writes.length = 0; state.listeners.clear()
  const root = createRoot(document.createElement('div'))
  try {
    const first = createChartAgentSpec({ title: 'First', dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
    state.files.set('/existing.chart/chart.json', JSON.stringify(first.spec))
    await act(async () => { root.render(<App />) })
    await act(async () => { await state.session.openChartPath('/existing.chart') })
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    state.writes.length = 0
    const changed = createChartAgentSpec({ title: 'From another window', dataText: 'x,y\n3,40\n4,50', type: 'scatter' })
    const content = JSON.stringify(changed.spec)
    state.files.set('/existing.chart/chart.json', content)
    await act(async () => { state.listeners.forEach(listener => listener({ kind: 'content', path: '/existing.chart' })) })
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(state.session.sheet.title).toBe('From another window')
    expect(state.session.table.rows[0].y).toBe(40)
    expect(state.files.get('/existing.chart/chart.json')).toBe(content)
    expect(state.writes).toEqual([])
  } finally { await act(async () => root.unmount()); vi.useRealTimers() }
})


it('shows each selected document across repeated switches without persisting another document’s thumbnail data', async () => {
  vi.useFakeTimers()
  state.files.clear(); state.writes.length = 0; state.listeners.clear()
  const root = createRoot(document.createElement('div'))
  try {
    const a = createChartAgentSpec({ title: 'A scatter', dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
    const b = createChartAgentSpec({ title: 'B bars', dataText: 'region,value\nNorth,70\nSouth,90\nWest,60', type: 'bar' })
    state.files.set('/A.chart/chart.json', JSON.stringify(a.spec))
    state.files.set('/B.chart/chart.json', JSON.stringify(b.spec))
    await act(async () => { root.render(<App />) })
    for (const name of ['A', 'B', 'A', 'B', 'A', 'B']) {
      await act(async () => { await state.session.openChartPath(`/${name}.chart`) })
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(state.session.sheet.title).toBe(name === 'A' ? 'A scatter' : 'B bars')
      expect(state.session.table.rows.length).toBe(name === 'A' ? 2 : 3)
      expect(state.session.sheet.charts[0].spec.chart.type).toBe(name === 'A' ? 'scatter' : 'bar')
      for (const [key, title] of [['A', 'A scatter'], ['B', 'B bars']]) {
        expect(JSON.parse(state.files.get(`/${key}.chart/chart.json`)!).title).toBe(title)
      }
    }
  } finally { await act(async () => root.unmount()); vi.useRealTimers() }
})
