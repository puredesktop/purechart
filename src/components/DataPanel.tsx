import { useEffect, useMemo, useRef, useState } from 'react'
import { parseTable } from '../lib/dataParse'
import { styled } from 'styled-components'
import {
  MetaText,
  SidebarSectionLabel,
} from '@purescience/platform-ui/components/common/containers/AppChrome'
import type { DataTable } from '../lib/dataParse'
import type { SheetChart } from '../lib/chartSheet'
import { chartDataImpact } from '../lib/chartDataImpact'


interface DataPanelProps {
  sourceText: string
  charts?: SheetChart[]
  table: DataTable
  onPasteText: (text: string, options?: { resetChart?: boolean }) => void
}

//#region styled-components

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-sm);
  min-width: 0;
  > ${MetaText} {
    white-space: normal;
    overflow-wrap: anywhere;
    font-family: var(--platform-typography-font-family);
  }
`

const StyledTextarea = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  min-height: 220px;
  max-height: 45vh;
  resize: vertical;
  padding: var(--purechart-space-sm) 10px;
  border: 1px solid var(--purechart-border);
  border-radius: var(--purechart-radius-control);
  background: var(--purechart-panel);
  color: var(--purechart-text);
  font-family: var(--platform-typography-font-family-mono);
  font-size: var(--pure-chrome-ui-size);
  line-height: 1.5;

  &:focus {
    outline: none;
    border-color: var(--purechart-focus);
  }
`

const StyledMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

// Column name · type is meta: mono 11, muted.
const StyledChip = styled(MetaText)`
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border: 1px solid var(--purechart-border-soft);
  border-radius: 6px;
  background: var(--purechart-panel-subtle);
`

const StyledRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
`

const StyledActions = styled.div`
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
`

// The rail already carries the 16px inset, so the label sits flush.
const StyledTitle = styled(SidebarSectionLabel)`
  && {
    padding: 0; font-size: 13px; font-weight: 600; font-family: inherit; letter-spacing: normal; text-transform: none; color: var(--purechart-text);
  }
`

// Load is the sidebar's one primary control: the accent, used once.
const StyledActionButton = styled.button<{ $primary?: boolean }>`
  height: var(--pure-chrome-control-height);
  padding: 0 11px;
  border: 1px solid
    ${({ $primary }) =>
      $primary ? 'var(--pure-chrome-accent)' : 'var(--purechart-border)'};
  border-radius: var(--purechart-radius-control);
  background: ${({ $primary }) =>
    $primary ? 'var(--pure-chrome-accent)' : 'var(--purechart-panel)'};
  color: ${({ $primary }) =>
    $primary ? 'var(--pure-chrome-on-accent)' : 'var(--purechart-text)'};
  font: inherit;
  font-size: var(--pure-chrome-ui-size);
  font-weight: 500;
  cursor: pointer;

  &:disabled { opacity: 0.45; cursor: default; }

  &:hover:not(:disabled) {
    border-color: ${({ $primary }) =>
      $primary ? 'var(--app-text)' : 'var(--purechart-border)'};
    background: ${({ $primary }) =>
      $primary ? 'var(--app-text)' : 'var(--purechart-panel-subtle)'};
  }

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--purechart-focus) 34%, transparent);
    outline-offset: 2px;
  }
`

const StyledFileInput = styled.input`
  display: none;
`

//#endregion

export function DataPanel({
  sourceText,
  charts = [],
  table,
  onPasteText,
}: DataPanelProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(sourceText)
  const importGeneration = useRef(0)
  const [error, setError] = useState('')
  useEffect(() => { importGeneration.current += 1; setDraft(sourceText); setError('') }, [sourceText])
  const preview = useMemo(() => { try { return parseTable(draft) } catch { return null } }, [draft])
  const impacts = useMemo(() => preview && draft !== sourceText ? chartDataImpact(charts, preview) : [], [charts, preview, draft, sourceText])
  const apply = () => {
    try {
      const parsed = parseTable(draft)
      if (!parsed.rows.length) throw new Error('Add a header row and at least one row of data.')
      if (!parsed.columns.some(column => column.type === 'number')) throw new Error('Include at least one numeric column to chart.')
      if (parsed.columns.some(column => !column.name.trim()) || new Set(parsed.columns.map(column => column.name)).size !== parsed.columns.length) throw new Error('Give each column a unique, non-empty heading.')
      onPasteText(draft)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  const visibleColumns = table.columns.slice(0, 3)
  const hiddenColumnCount = Math.max(
    0,
    table.columns.length - visibleColumns.length,
  )

  return (
    <StyledPanel>
      <StyledRow>
        <StyledTitle>Data source</StyledTitle>
        <StyledActions>
          <StyledActionButton
            type="button"
            $primary
            onClick={() => inputRef.current?.click()}
          >
            Import file
          </StyledActionButton>
        </StyledActions>
      </StyledRow>
      <StyledFileInput
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.json,.txt,text/csv,text/tab-separated-values,application/json"
        onChange={event => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          const generation = ++importGeneration.current
          void file.text().then(text => {
            if (generation !== importGeneration.current) return
            setDraft(text)
            setError('')
          }).catch(cause => {
            if (generation === importGeneration.current) setError(`Could not read file: ${String(cause)}`)
          })
        }}
      />
      <MetaText>Paste a table from a spreadsheet, or import CSV, TSV, or JSON. Data is shared by every chart in this document.</MetaText>
      <StyledTextarea
        aria-label="Chart data"
        placeholder="Paste CSV, TSV, or JSON here…"
        spellCheck={false}
        value={draft}
        onChange={event => { importGeneration.current += 1; setDraft(event.target.value) }}
        onPaste={event => {
          const text = event.clipboardData.getData('text/plain')
          // Native textarea insertion can spend minutes laying out tens of
          // thousands of lines. Set the controlled buffer once for bulk paste.
          if (text.length < 20_000) return
          event.preventDefault()
          const field = event.currentTarget
          const start = field.selectionStart, end = field.selectionEnd
          importGeneration.current += 1
          setDraft(field.value.slice(0, start) + text + field.value.slice(end))
          setError('')
          requestAnimationFrame(() => { if (field.isConnected) field.setSelectionRange(start + text.length, start + text.length) })
        }}
        onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); apply() } }}
      />
      {draft !== sourceText && preview && preview.columns.length > 0 && <div style={{ overflowX: 'auto' }}>
        <MetaText>Import preview · {preview.rows.length} rows · {preview.columns.length} columns</MetaText>
        <table aria-label="Import preview" style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{preview.columns.slice(0, 4).map((column, i) => <th key={i} style={{ textAlign: 'left', padding: 4 }}>{column.name}</th>)}</tr></thead>
          <tbody>{preview.rows.slice(0, 5).map((row, i) => <tr key={i}>{preview.columns.slice(0, 4).map((column, j) => <td key={j} style={{ padding: 4 }}>{String(row[column.name] ?? '')}</td>)}</tr>)}</tbody>
        </table>
        <MetaText>First 5 rows and 4 columns. Applying replaces the shared data; Undo restores it.</MetaText>
      </div>}
      {impacts.length > 0 && <div role="status" style={{ overflowWrap: 'anywhere' }}>
        <strong>Check {impacts.length} {impacts.length === 1 ? 'chart' : 'charts'} after applying</strong>
        <p style={{ margin: '6px 0' }}>The incoming data is missing columns used by:</p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{impacts.map((impact, index) => <li key={index}>{impact.title}: {impact.missing.join(', ')}</li>)}</ul>
        <p style={{ margin: '6px 0' }}>The current chart may receive a suggested mapping. Other charts and calculations may need remapping. Undo restores the whole sheet.</p>
      </div>}
      <StyledActions>
        <StyledActionButton type="button" $primary onClick={apply} disabled={draft === sourceText}>Apply data</StyledActionButton>
        {draft !== sourceText && <StyledActionButton type="button" onClick={() => { setDraft(sourceText); setError('') }}>Discard edits</StyledActionButton>}
      </StyledActions>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--platform-colors-danger, #b42318)' }}>{error}</p>}
      <MetaText>{draft !== sourceText ? 'Changes are not applied yet. ⌘/Ctrl + Enter to apply.' : `${table.rows.length} rows · ${table.columns.length} columns`}</MetaText>
      {table.columns.length > 0 && (
        <StyledMeta>
          {visibleColumns.map(column => (
            <StyledChip key={column.name}>
              {column.name} · {column.type}
            </StyledChip>
          ))}
          {hiddenColumnCount > 0 && (
            <StyledChip>+{hiddenColumnCount} columns</StyledChip>
          )}
        </StyledMeta>
      )}
    </StyledPanel>
  )
}
