import { expect, it, vi } from 'vitest'
import type { AgentToolInvokeContext } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
import { formatAgentToolJson } from '@purescience/platform-ui/bridge/agentToolHelpers'
import { createChartAgentSpec, getChartAgentContext } from '../../../lib/agentChartTools'
import type { ChartAgentToolContext } from '../../context'
import { FACET_VALUES_LISTED, facetChartHandler } from './facetChart'
import { setChartTitleHandler } from './setChartTitle'

function wideCsv(columns: number, rows: number): string {
  const head = ['month', 'region', ...Array.from({ length: columns - 2 }, (_, i) => `measure_${i}`)]
  const lines = [head.join(',')]
  for (let r = 0; r < rows; r++) {
    lines.push([`2024-${String((r % 12) + 1).padStart(2, '0')}-01`, `Region ${r}`, ...Array.from({ length: columns - 2 }, (_, i) => String(r * 10 + i))].join(','))
  }
  return lines.join('\n')
}

function invoke(shortName: string, args: Record<string, unknown>): AgentToolInvokeContext {
  return { toolCallId: 'test', shortName, arguments: args } as AgentToolInvokeContext
}

it('replies to a spec edit with counts, not the column list', async () => {
  const { spec, table } = createChartAgentSpec({ dataText: wideCsv(40, 200) })
  const ctx = { spec, table, documentPath: '/tmp/wide.chart', applyChartSpec: vi.fn() } as unknown as ChartAgentToolContext
  const result = await setChartTitleHandler(ctx, invoke('setChartTitle', { title: 'Wide' }))
  const reply = JSON.parse(String(result.content))
  expect(reply).toMatchObject({ title: 'Wide', documentPath: '/tmp/wide.chart', data: { rowCount: 200, columnCount: 40 } })
  expect(reply.data.columns).toBeUndefined()
  expect(reply.style.customPalettes).toBeUndefined()
  expect(reply.style.customPaletteCount).toBe(0)
  const full = formatAgentToolJson(getChartAgentContext({ spec, table, documentPath: '/tmp/wide.chart', status: 'x' }))
  expect(String(result.content).length).toBeLessThan(full.length / 2)
})

it('names only the first facet values and counts the rest', async () => {
  const { spec, table } = createChartAgentSpec({ dataText: wideCsv(4, 500) })
  const ctx = { spec, table, applyChartSpec: vi.fn() } as unknown as ChartAgentToolContext
  const result = await facetChartHandler(ctx, invoke('facetChart', { column: 'region' }))
  const reply = JSON.parse(String(result.content))
  expect(reply.panels).toBe(500)
  expect(reply.values).toHaveLength(FACET_VALUES_LISTED)
  expect(reply).toMatchObject({ valuesTruncated: true, moreValues: 500 - FACET_VALUES_LISTED })
  expect(ctx.applyChartSpec).toHaveBeenCalledOnce()
})
