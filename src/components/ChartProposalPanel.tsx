import { useState } from 'react'
import { styled } from 'styled-components'
import type { ChartSession } from '../hooks/useChartSession'
import { proposalBase } from '../lib/chartProposal'

export function ChartProposalPanel({ session }: { session: ChartSession }) {
  const [error, setError] = useState<string | null>(null)
  const proposal = session.proposal
  if (!proposal) return null
  const stale = proposal.base !== proposalBase(session.sheet.focusedId, session.spec, session.table)
  return <Panel aria-label="Proposed chart changes">
    <h3>Proposed changes</h3>
    <p>{proposal.explanation}</p>
    <ul>{proposal.changes.map(change => <li key={change}>{change}</li>)}</ul>
    <Preview aria-label="Proposed chart preview" dangerouslySetInnerHTML={{ __html: proposal.preview.replace(/^<\?xml[^>]*\?>\s*/, '') }} />
    <p>{proposal.calculation}</p>
    {!!proposal.findings.length && <details><summary>Computed findings</summary>{proposal.findings.map(f => <p key={f.id}>{f.text}<small>{f.working}</small></p>)}</details>}
    {!!proposal.warnings.length && <details open><summary>Review notes</summary><ul>{proposal.warnings.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
    {stale && <p role="alert">The chart or data changed. Request a fresh preview before applying.</p>}
    {error && <p role="alert">{error}</p>}
    <button disabled={stale} onClick={() => { try { session.applyProposal(proposal.id) } catch (failure) { setError(String(failure instanceof Error ? failure.message : failure)) } }}>Apply proposal</button>
    <button onClick={session.discardProposal}>Discard proposal</button>
    <small>Apply is one undoable change. Shared palette changes affect every chart on this sheet.</small>
  </Panel>
}
const Panel = styled.section`
  border: 1px solid var(--purechart-border); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
  h3, p, ul { margin: 0; } h3 { font-size: 14px; } p, li, summary { font-size: 12px; line-height: 1.5; }
  ul { padding-left: 16px; } small { display: block; color: var(--purechart-muted); font-size: 11px; }
  button { cursor: pointer; border: 1px solid var(--purechart-border); border-radius: 4px; background: var(--purechart-panel); color: var(--purechart-text); padding: 6px; font: inherit; }
  button:disabled { opacity: .5; cursor: default; }
`
const Preview = styled.div`background: #fcfcfb; svg { display: block; width: 100%; height: auto; pointer-events: none; }`
