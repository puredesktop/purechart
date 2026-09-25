import { expect, it, vi } from 'vitest'
import type { ChartAgentToolContext } from '../../context'
import type { AgentToolInvokeContext } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { createChartAgentSpec } from '../../../lib/agentChartTools'
import { exportChartHandler } from './exportChart'

function context() {
  const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
  return { spec, table, documentPath: null, getChartSvg: vi.fn(() => null), saveDocument: vi.fn(async () => '/tmp/test.chart'), exportSvg: vi.fn(), exportPng: vi.fn() } as unknown as ChartAgentToolContext
}
const invocation = (args: Record<string, unknown>) => ({ arguments: args }) as AgentToolInvokeContext

it.each([
  { width: NaN }, { height: Infinity }, { width: '900' },
  { width: 5000 }, { scale: NaN }, { scale: 0 },
  { width: 4096, height: 4096, scale: 2 },
])('rejects invalid PNG options before creating a document: %j', async options => {
  const ctx = context()
  await expect(exportChartHandler(ctx, invocation({ format: 'png', ...options }))).rejects.toThrow()
  expect(ctx.saveDocument).not.toHaveBeenCalled()
  expect(ctx.exportPng).not.toHaveBeenCalled()
})
it('reports failed document creation without attempting export', async () => {
  const ctx = context()
  vi.mocked(ctx.saveDocument).mockResolvedValue(null)
  await expect(exportChartHandler(ctx, invocation({}))).rejects.toThrow('could not create')
  expect(ctx.exportSvg).not.toHaveBeenCalled()
})
it('reports a failed file export instead of returning a success path', async () => {
  const ctx = context()
  vi.mocked(ctx.exportSvg).mockResolvedValue(null)
  await expect(exportChartHandler(ctx, invocation({}))).rejects.toThrow('export failed')
})
it('exports at the requested dimensions and reports the actual file', async () => {
  const ctx = context()
  vi.mocked(ctx.exportPng).mockResolvedValue({ kind: 'file', path: '/tmp/test.chart/assets/figures/test.png' })
  const result = await exportChartHandler(ctx, invocation({ format: 'png', width: 1600, height: 900, scale: 2 }))
  expect(ctx.exportPng).toHaveBeenCalledWith(null, expect.objectContaining({ width: 1600, height: 900, scale: 2, basePath: '/tmp/test.chart' }))
  expect(JSON.stringify(result)).toContain('test.chart/assets/figures/test.png')
})
it('draws in one ink when asked, and refuses a palette it does not have', async () => {
  const ctx = context()
  vi.mocked(ctx.exportSvg).mockResolvedValue({ kind: 'file', path: '/tmp/test.chart/assets/figures/test.svg' })
  const result = await exportChartHandler(ctx, invocation({ palette: 'monochrome' }))
  expect(ctx.exportSvg).toHaveBeenCalledWith(null, expect.objectContaining({ palette: 'monochrome' }))
  expect(result.content).toContain('"linked": true')
  await expect(exportChartHandler(context(), invocation({ palette: 'sepia' }))).rejects.toThrow('palette')
})
