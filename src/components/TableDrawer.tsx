import { DataGridEditor } from './DataGridEditor'
import type { DataEdit } from '../lib/dataEditing'
import { styled } from 'styled-components'
import type { ColumnTypes, DataTable } from '../lib/dataParse'

/**
 * The table, as the other half of the figure.
 *
 * Not a fallback for when the chart fails: a chart whose colours are pale, or
 * whose reader uses a screen reader, or whose page is printed in one ink,
 * still has to say what it says — and the numbers are how. It is shown here
 * the way it is shipped, with row headers and figures that line up.
 */

const MAX_ROWS = 200

interface TableDrawerProps {
  columnTypes?: ColumnTypes
  sourceText?: string
  onEdit?: (edit: DataEdit) => void
  table: DataTable
  open: boolean
  onToggle: () => void
}

export function TableDrawer({
  table,
  sourceText = '',
  columnTypes,
  onEdit,
  open,
  onToggle,
}: TableDrawerProps): React.ReactElement | null {
  if (table.columns.length === 0) return null
  const shown = table.rows.slice(0, MAX_ROWS)

  return (
    <StyledDrawer>
      <StyledBar type="button" aria-expanded={open} onClick={onToggle}>
        <StyledChevron aria-hidden="true" $open={open}>
          ›
        </StyledChevron>
        <StyledLabel>Table</StyledLabel>
        <StyledMeta>
          {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'} ·{' '}
          {table.columns.length}{' '}
          {table.columns.length === 1 ? 'column' : 'columns'} ·{' '}
          {table.columns.map(column => column.name).join(', ')}
        </StyledMeta>
        <StyledNote>Source data</StyledNote>
      </StyledBar>

      {open && onEdit ? <DataGridEditor columnTypes={columnTypes} table={table} sourceText={sourceText} onEdit={onEdit} /> : open ? (
        <StyledScroll>
          <StyledTable>
            <thead>
              <tr>
                {table.columns.map(column => (
                  <StyledHeaderCell
                    key={column.name}
                    scope="col"
                    $numeric={column.type === 'number'}
                  >
                    {column.name}
                  </StyledHeaderCell>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, index) => (
                <tr key={index}>
                  {table.columns.map((column, cell) => {
                    const value = row[column.name]
                    const text =
                      value === null || value === undefined
                        ? ''
                        : value instanceof Date
                          ? value.toISOString().slice(0, 10)
                          : String(value)
                    return cell === 0 ? (
                      <StyledRowHeader key={column.name} scope="row">
                        {text}
                      </StyledRowHeader>
                    ) : (
                      <StyledCell
                        key={column.name}
                        $numeric={column.type === 'number'}
                      >
                        {text}
                      </StyledCell>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </StyledTable>
          {table.rows.length > MAX_ROWS ? (
            <StyledTruncation>
              Showing the first {MAX_ROWS} of {table.rows.length} rows. The
              whole table is what ships.
            </StyledTruncation>
          ) : null}
        </StyledScroll>
      ) : null}
    </StyledDrawer>
  )
}

//#region styled-components

const StyledDrawer = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 0 0 auto;
  border-top: 1px solid var(--purechart-border);
`

const StyledBar = styled.button`
  display: flex;
  align-items: center;
  gap: var(--purechart-space-sm);
  padding: var(--purechart-space-sm) 0;
  border: none;
  background: transparent;
  color: var(--purechart-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

const StyledChevron = styled.span<{ $open: boolean }>`
  display: inline-block;
  color: var(--purechart-muted);
  transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
  transition: transform 120ms ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const StyledLabel = styled.span`
  font-size: var(--platform-typography-font-size-sm);
  font-weight: var(--platform-typography-font-weight-semibold);
`

const StyledMeta = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
`

const StyledNote = styled.span`
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
`

const StyledScroll = styled.div`
  overflow: auto;
  max-height: 28vh;
  padding-bottom: var(--purechart-space-sm);
`

const StyledTable = styled.table`
  border-collapse: collapse;
  width: 100%;
  font-size: var(--platform-typography-font-size-xs);
  font-variant-numeric: tabular-nums;
`

const StyledHeaderCell = styled.th<{ $numeric: boolean }>`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 10px 6px 0;
  text-align: ${({ $numeric }) => ($numeric ? 'right' : 'left')};
  font-weight: var(--platform-typography-font-weight-semibold);
  color: var(--purechart-content-muted);
  background: var(--purechart-panel);
  border-bottom: 1px solid var(--purechart-border);
  white-space: nowrap;
`

const StyledRowHeader = styled.th`
  padding: 5px 10px 5px 0;
  text-align: left;
  font-weight: var(--platform-typography-font-weight-normal);
  border-bottom: 1px solid var(--purechart-border-soft);
  white-space: nowrap;
`

const StyledCell = styled.td<{ $numeric: boolean }>`
  padding: 5px 10px 5px 0;
  text-align: ${({ $numeric }) => ($numeric ? 'right' : 'left')};
  border-bottom: 1px solid var(--purechart-border-soft);
  white-space: nowrap;
`

const StyledTruncation = styled.p`
  margin: var(--purechart-space-sm) 0 0;
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
`

//#endregion
