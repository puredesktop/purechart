import { expect, it, vi } from 'vitest'
import manifest from '../../../../plugin.json'
import { PURECHART_AGENT_TOOL_NAMES } from '../../catalog'
import { proposeChartHandler } from './proposeChart'
import { addChartAnnotationHandler } from './addChartAnnotation'
import { createChartAgentSpec } from '../../../lib/agentChartTools'
import { createChartProposal } from '../../../lib/chartProposal'
import type { ChartAgentToolContext } from '../../context'
import type { AgentToolInvokeContext } from '@purescience/platform-ui/bridge/react/usePlatformAgentTools'
it('registers the proposal tool in both manifest and runtime catalog', () => {
  expect(manifest.app.agents.tools.map(t => t.name)).toEqual([...PURECHART_AGENT_TOOL_NAMES])
})
it('returns a pending proposal, never an applied or saved edit', async () => {
  const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
  const ctx = { proposeChart: vi.fn(input => createChartProposal('chart1', spec, table, input)), applyChartSpec: vi.fn(), saveDocument: vi.fn() } as unknown as ChartAgentToolContext
  const result = await proposeChartHandler(ctx, { toolCallId: 'test', shortName: 'proposeChart', arguments: { patch: { title: 'Proposal' }, explanation: 'Clarify the title.' } } as AgentToolInvokeContext)
  expect(JSON.stringify(result)).toContain('Pending review')
  expect(ctx.applyChartSpec).not.toHaveBeenCalled()
  expect(ctx.saveDocument).not.toHaveBeenCalled()
})
it('validates direct assistant annotation targets before mutating the chart', async () => {
  const { spec, table } = createChartAgentSpec({ dataText: 'x,y\n1,10\n2,20', type: 'scatter' })
  const ctx = { spec, table, applyChartSpec: vi.fn() } as unknown as ChartAgentToolContext
  const args = { annotation: { id: 'a', text: 'Peak', createdAt: 'now', target: { kind: 'point', seriesKey: 'y', xLabel: '2', value: 99 } } }
  await expect(addChartAnnotationHandler(ctx, { toolCallId: 'test', shortName: 'addChartAnnotation', arguments: args } as AgentToolInvokeContext)).rejects.toThrow('does not target')
  expect(ctx.applyChartSpec).not.toHaveBeenCalled()
  args.annotation.target.value = 20
  await addChartAnnotationHandler(ctx, { toolCallId: 'test', shortName: 'addChartAnnotation', arguments: args } as AgentToolInvokeContext)
  expect(ctx.applyChartSpec).toHaveBeenCalledOnce()
})
