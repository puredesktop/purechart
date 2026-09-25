import { useMemo, useRef, useState } from 'react'
import { styled } from 'styled-components'
import { dataGrid, type DataEdit } from '../lib/dataEditing'
import { SelectField } from './SelectField'
import type { ColumnTypes, ColumnType, DataTable } from '../lib/dataParse'

const ROW_HEIGHT = 32
const WINDOW_ROWS = 32

function Cell({ value, label, onCommit, onPaste, issue }: { issue?: string; value: string; label: string; onCommit: (value: string) => void; onPaste?: React.ClipboardEventHandler<HTMLInputElement> }) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  return <input aria-label={label} aria-invalid={issue ? true : undefined} title={issue} value={draft ?? value}
    onChange={event => { cancelled.current = false; setDraft(event.target.value) }}
    onBlur={() => { if (!cancelled.current && draft !== null && draft !== value) onCommit(draft); cancelled.current = false; setDraft(null) }}
    onKeyDown={event => {
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') { event.preventDefault(); cancelled.current = true; setDraft(null); event.currentTarget.blur() }
    }}
    onPaste={onPaste} />
}

export function DataGridEditor({ table, sourceText, onEdit, columnTypes = {} }: { columnTypes?: ColumnTypes; table: DataTable; sourceText: string; onEdit: (edit: DataEdit) => void }) {
  const grid = useMemo(() => dataGrid(sourceText, table), [sourceText, table])
  const issues = useMemo(() => new Map(table.issues?.map(issue => [JSON.stringify([issue.row, issue.column]), issue.message])), [table.issues])
  const [scrollTop, setScrollTop] = useState(0)
  const start = Math.min(Math.max(0, grid.rows.length - WINDOW_ROWS), Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4))
  const end = Math.min(grid.rows.length, start + WINDOW_ROWS)
  return <Root>
    <Actions>
      <button onClick={() => onEdit({ kind: 'insert-row', row: grid.rows.length })}>Add row</button>
      <button onClick={() => {
        let index = grid.columns.length + 1
        while (grid.columns.includes(`Column ${index}`)) index += 1
        onEdit({ kind: 'add-column', name: `Column ${index}` })
      }}>Add column</button>
      <span>Edit cells or paste a spreadsheet selection. Changes affect every chart and can be undone.</span>
    </Actions>
    {!!table.issues?.length && <p role="status">{table.issues.length} invalid {table.issues.length === 1 ? 'value' : 'values'} highlighted. Original text is retained; charts treat these cells as missing.</p>}
    <Scroll onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
      <table aria-label="Editable source data" aria-rowcount={grid.rows.length + 1}>
        <thead><tr><th scope="col">Row</th>{grid.columns.map((name, column) => <th key={column} scope="col">
          <Cell value={name} label={`Column ${column + 1} name`} onCommit={value => onEdit({ kind: 'rename', column, name: value })} />
          <SelectField label={`Type of ${name}`} value={columnTypes[name] ?? 'auto'}
            options={[{ id: 'auto', label: `Auto (${table.columns[column]?.type ?? 'text'})` }, { id: 'string', label: 'Text' }, { id: 'number', label: 'Number' }, { id: 'date', label: 'Date' }]}
            onChange={type => onEdit({ kind: 'type', column, type: type as ColumnType | 'auto' })} />
          <button aria-label={`Remove column ${name}`} disabled={grid.columns.length < 2} onClick={() => onEdit({ kind: 'remove-column', column })}>Remove</button>
        </th>)}<th scope="col">Actions</th></tr></thead>
        <tbody>
          {start > 0 && <tr aria-hidden="true"><td colSpan={grid.columns.length + 2} style={{ height: start * ROW_HEIGHT, padding: 0 }} /></tr>}
          {grid.rows.slice(start, end).map((row, offset) => {
            const index = start + offset
            return <tr key={index} aria-rowindex={index + 2} style={{ height: ROW_HEIGHT }}>
              <th scope="row">{index + 1}</th>
              {grid.columns.map((name, column) => <td key={column}>
                <Cell value={row[column] ?? ''} label={`Row ${index + 1}, ${name}`}
                  issue={issues.get(JSON.stringify([index, name]))}
                  onCommit={value => onEdit({ kind: 'cell', row: index, column, value })}
                  onPaste={event => {
                    const text = event.clipboardData.getData('text/plain')
                    if (text.includes('\t') || text.includes('\n')) { event.preventDefault(); onEdit({ kind: 'paste', row: index, column, text }) }
                  }} />
              </td>)}
              <td><button aria-label={`Delete row ${index + 1}`} onClick={() => onEdit({ kind: 'remove-row', row: index })}>Delete</button></td>
            </tr>
          })}
          {end < grid.rows.length && <tr aria-hidden="true"><td colSpan={grid.columns.length + 2} style={{ height: (grid.rows.length - end) * ROW_HEIGHT, padding: 0 }} /></tr>}
        </tbody>
      </table>
    </Scroll>
  </Root>
}

const Root = styled.div`
  min-width: 0;
  button { border: 1px solid var(--purechart-border); background: var(--purechart-panel); color: var(--purechart-text); border-radius: 4px; font: inherit; padding: 4px 8px; cursor: pointer; }
  button:disabled { opacity: .4; cursor: default; }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--purechart-focus); outline-offset: -2px; }
`
const Actions = styled.div`
  display: flex; align-items: center; gap: 8px; padding: 6px 0;
  span { color: var(--purechart-muted); font-size: 11px; }
`
const Scroll = styled.div`
  max-height: 28vh; overflow: auto;
  table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 12px; table-layout: fixed; }
  th, td { padding: 0; border-bottom: 1px solid var(--purechart-border); min-width: 130px; width: 160px; }
  th:first-child { width: 45px; min-width: 45px; font-weight: 400; }
  th:last-child { width: 70px; }
  thead th { position: sticky; top: 0; background: var(--glass-popover); z-index: 1; }
  input { box-sizing: border-box; height: 31px; width: 100%; padding: 4px 8px; border: 0; background: transparent; color: var(--purechart-text); font: inherit; }
  input[aria-invalid="true"] { background: #fff0eb; color: #9b281c; box-shadow: inset 0 -2px #c64c32; }
  tbody tr:focus-within { background: var(--pure-chrome-hover); }
`
