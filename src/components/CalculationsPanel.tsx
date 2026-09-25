import { ChartPanel } from './ChartPanel'
import { useMemo, useState } from 'react'
import { styled } from 'styled-components'
import type { ChartSession } from '../hooks/useChartSession'
import { defaultTransform, transformChartData, type Aggregate, type ChartFilter } from '../lib/chartTransform'
import { SelectField } from './SelectField'

export function CalculationsPanel({ session }: { session: ChartSession }) {
  const config = session.spec.chart.transform ?? defaultTransform(session.spec)
  const result = useMemo(() => transformChartData(session.table, session.spec), [session.table, session.spec])
  const columns = session.table.columns.map(c => ({ id: c.name, label: c.name }))
  const [column, setColumn] = useState<string | null>(null)
  const [operator, setOperator] = useState<ChartFilter['op']>('eq')
  const [value, setValue] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(result.table.rows.length / 50))
  const safePage = Math.min(page, pageCount - 1)
  return <Panel>
    <h3>Calculations</h3>
    <SelectField label="Calculate" value={config.aggregate} options={[
      { id: 'none', label: 'Individual rows' }, { id: 'sum', label: 'Sum' }, { id: 'mean', label: 'Average' }, { id: 'count', label: 'Count numeric values' }, { id: 'percent', label: 'Percentage of total' },
    ]} onChange={aggregate => session.setTransform({ ...config, aggregate: aggregate as Aggregate })} />
    <SelectField label="Missing values" value={config.missing} options={[{ id: 'omit', label: 'Omit from calculation' }, { id: 'zero', label: 'Treat as zero' }]} onChange={missing => session.setTransform({ ...config, missing: missing as 'omit' | 'zero' })} />
    <SelectField label="Sort by" value={config.sort?.column ?? '__source__'} options={[{ id: '__source__', label: 'Source order' }, ...columns]} onChange={column => session.setTransform({ ...config, sort: column === '__source__' ? null : { column, direction: config.sort?.direction ?? 'asc' } })} />
    {config.sort && <SelectField label="Sort direction" value={config.sort.direction} options={[{ id: 'asc', label: 'Ascending' }, { id: 'desc', label: 'Descending' }]} onChange={direction => session.setTransform({ ...config, sort: { ...config.sort!, direction: direction as 'asc' | 'desc' } })} />}
    <details><summary>Filters ({config.filters.length})</summary>
      {config.filters.map((filter, index) => <div key={index}>{filter.column} {filter.op} {filter.value} <button aria-label={`Remove filter ${index + 1}`} onClick={() => session.setTransform({ ...config, filters: config.filters.filter((_, i) => index !== i) })}>Remove</button></div>)}
      <SelectField label="Filter column" value={column} options={columns} onChange={setColumn} />
      <SelectField label="Condition" value={operator} options={[{ id: 'eq', label: 'Equals' }, { id: 'neq', label: 'Does not equal' }, { id: 'contains', label: 'Contains' }, { id: 'gt', label: 'Greater than' }, { id: 'lt', label: 'Less than' }]} onChange={op => setOperator(op as ChartFilter['op'])} />
      <input aria-label="Filter value" placeholder="Value" value={value} onChange={event => setValue(event.target.value)} />
      <button disabled={!column || !columns.some(c => c.id === column)} onClick={() => { session.setTransform({ ...config, filters: [...config.filters, { column: column!, op: operator, value }] }); setValue('') }}>Add filter</button>
    </details>
    <p role={result.error ? 'alert' : undefined}>{result.error ?? result.summary}</p>
    <details onToggle={event => setInspecting(event.currentTarget.open)}><summary>Inspect plotted values and source rows</summary>
      <p>Source row numbers refer to the editable table. Missing measures are omitted unless “Treat as zero” is selected.</p>
      <Provenance>
        {inspecting && result.table.rows.slice(safePage * 50, safePage * 50 + 50).map((row, offset) => { const i = safePage * 50 + offset; return <details key={i}>
          <summary>{String(row[session.spec.chart.encodings.x ?? ''] ?? i + 1)} · {session.spec.chart.encodings.y.map(y => `${y}: ${row[y] ?? 'missing'}`).join(' · ')}</summary>
          <p>Source rows: {result.sourceRows[i].map(index => index + 1).join(', ')}</p>
        </details> })}
      </Provenance>
      <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous values</button> {safePage + 1} / {pageCount} <button disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>Next values</button>
      {!!result.excludedRows.length && <details><summary>Filtered-out source rows</summary><Provenance>{result.excludedRows.map(i => i + 1).join(', ')}</Provenance></details>}
    </details>
  </Panel>
}
const Panel = ChartPanel
const Provenance = styled.div`max-height: 220px; overflow: auto; overflow-wrap: anywhere;`
