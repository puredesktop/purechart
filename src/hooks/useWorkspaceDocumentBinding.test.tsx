// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { updateCurrentWorkspaceTab } from '@purescience/platform-ui/bridge/workspace'
import { canonicalDocumentPath, useWorkspaceDocumentBinding } from './useWorkspaceDocumentBinding'
vi.mock('@purescience/platform-ui/bridge/workspace', () => ({ updateCurrentWorkspaceTab: vi.fn(async () => ({ updated: true })) }))
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let binding: ReturnType<typeof useWorkspaceDocumentBinding>
function Harness({ path }: { path: string | null }) { binding = useWorkspaceDocumentBinding(path); return <output>{binding.error}</output> }
async function render(path: string | null) { await act(async () => root.render(<Harness path={path} />)) }
beforeEach(() => { vi.mocked(updateCurrentWorkspaceTab).mockReset(); vi.mocked(updateCurrentWorkspaceTab).mockResolvedValue({ updated: true }); root = createRoot(document.createElement('div')) })
afterEach(async () => { await act(async () => root.unmount()) })
describe('workspace document binding', () => {
  it('canonicalizes package content aliases', () => {
    expect(canonicalDocumentPath('/A.chart/chart.json')).toBe('/A.chart')
    expect(canonicalDocumentPath(' /A.chart/ ')).toBe('/A.chart')
  })
  it('publishes only loaded filesystem identities and does not republish an alias', async () => {
    await render(null)
    await render('ps-tab:123')
    expect(updateCurrentWorkspaceTab).not.toHaveBeenCalled()
    await render('/A.chart/chart.json')
    await render('/A.chart')
    expect(updateCurrentWorkspaceTab).toHaveBeenCalledExactlyOnceWith({ resource: { path: '/A.chart' } })
  })
  it('surfaces a rejected binding and retries the same identity', async () => {
    vi.mocked(updateCurrentWorkspaceTab).mockResolvedValueOnce({ updated: false })
    await render('/A.chart')
    expect(binding.error).toContain('restart restoration is not confirmed')
    await act(async () => binding.retry())
    expect(binding.error).toBeNull()
    expect(updateCurrentWorkspaceTab).toHaveBeenCalledTimes(2)
  })
  it('serializes slow A then B updates and ignores an obsolete A failure', async () => {
    let reject!: (error: Error) => void
    vi.mocked(updateCurrentWorkspaceTab).mockImplementationOnce(() => new Promise((_, no) => { reject = no }))
    await render('/A.chart')
    await render('/B.chart')
    expect(updateCurrentWorkspaceTab).toHaveBeenCalledTimes(1)
    await act(async () => reject(new Error('old request failed')))
    expect(updateCurrentWorkspaceTab).toHaveBeenLastCalledWith({ resource: { path: '/B.chart' } })
    expect(binding.error).toBeNull()
  })
})
