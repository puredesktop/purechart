import { styled } from 'styled-components'
import { X } from 'lucide-react'
import { SegmentedControl } from '@purescience/platform-ui/components/common/buttons/SegmentedControl'
import { PaletteDropdown } from '@purescience/platform-ui/components/common/inputs/PaletteDropdown'
import { PlatformIcon } from '@purescience/platform-ui/components/chrome/PlatformIcon'
import { SidebarSectionLabel } from '@purescience/platform-ui/components/common/containers/AppChrome'
import { CHART_TYPES } from '../lib/chartSpec'
import type { ChartType } from '../lib/chartSpec'
import { chartPaletteList } from '../lib/chartTheme'
import type { InteractionMode } from '../lib/chartInteraction'
import type { DataTable } from '../lib/dataParse'
import type { ChartSession } from '../hooks/useChartSession'
import { SelectField, type SelectOption } from './SelectField'

const NONE_ID = '__none__'

interface ControlsPanelProps {
  session: ChartSession
  table: DataTable
  /**
   * Show the full list of chart types.
   *
   * The forms rail is the way in; this is the drawer marked "every form,
   * including the ones this table argues against", opened on request.
   */
  expanded?: boolean
  section?: 'chart' | 'style'
  interactionMode: InteractionMode
  onInteractionModeChange: (mode: InteractionMode) => void
  onResetInteraction: () => void
}

//#region styled-components

const StyledPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`

// The rail already carries the 16px inset, so the label sits flush.
const StyledTitle = styled(SidebarSectionLabel)`
  && { padding: 0; margin: 0; font-size: 13px; font-family: inherit; font-weight: 600; letter-spacing: normal; text-transform: none; color: var(--purechart-text); }
`

const StyledToggles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--purechart-space-xs);
`

const StyledUtilityRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--purechart-space-xs);
`

const StyledHint = styled.p`
  margin: 0;
  color: var(--purechart-soft);
  font-size: var(--pure-chrome-ui-size);
  line-height: 1.4;
`

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-sm);
`

const StyledMeasureList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const StyledMeasureChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  max-width: 100%;
  padding: 0 6px 0 10px;
  border: 1px solid var(--purechart-border-soft);
  border-radius: var(--platform-radius-sm);
  background: var(--purechart-panel-subtle);
  color: var(--purechart-text);
  font-size: var(--pure-chrome-ui-size);
  font-weight: 500;
`

const StyledMeasureName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StyledRemoveMeasure = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: var(--platform-radius-sm);
  background: transparent;
  color: var(--purechart-muted);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--pure-chrome-hover);
    color: var(--purechart-text);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }
`

const StyledEmptyMeasures = styled.span`
  color: var(--purechart-muted);
  font-size: var(--pure-chrome-ui-size);
`

const StyledSegmentedWrap = styled.div`
  --platform-colors-surface: var(--purechart-panel);
  --platform-colors-border: var(--purechart-border);
  --platform-colors-surface-hover: var(--purechart-panel-subtle);
  --platform-radius-sm: 7px;

  button[aria-pressed='true'] {
    border-bottom: 0;
    background: var(--app-bg);
    color: var(--app-text);
  }

  button[aria-pressed='true']:hover {
    background: var(--app-bg);
    color: var(--app-text);
  }
`

const StyledToggleButton = styled.button<{ $selected?: boolean }>`
  display: inline-flex;
  align-items: center;
  height: var(--pure-chrome-control-height);
  padding: 0 10px;
  border: 1px solid
    ${({ $selected }) =>
      $selected ? 'var(--app-text)' : 'var(--purechart-border-soft)'};
  border-radius: var(--purechart-radius-control);
  background: ${({ $selected }) =>
    $selected ? 'var(--app-bg)' : 'var(--purechart-panel)'};

  [data-platform-theme='dark'] & {
    background: ${({ $selected }) =>
      $selected ? 'var(--app-bg)' : 'var(--purechart-panel)'};
  }

  color: ${({ $selected }) =>
    $selected ? 'var(--app-text)' : 'var(--purechart-text)'};
  font: inherit;
  font-size: var(--pure-chrome-ui-size);
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: ${({ $selected }) =>
      $selected ? 'var(--app-text)' : 'var(--purechart-border)'};
    background: ${({ $selected }) =>
      $selected ? 'var(--app-bg)' : 'var(--purechart-panel-subtle)'};
  }

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--purechart-focus) 34%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }
`

const StyledNumberRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--purechart-space-sm);
`

const StyledNumberField = styled.label`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
  color: var(--purechart-muted);
  font-size: var(--pure-chrome-ui-size);
  font-weight: 500;
`

/** Typed loosely on purpose: styled-components' attrs rejects data-* literals. */
const fieldChrome: Record<string, string> = { 'data-chrome': 'field' }

const StyledNumberInput = styled.input.attrs(fieldChrome)`
  box-sizing: border-box;
  width: 100%;
  border-radius: var(--purechart-radius-control);
  font-weight: 500;

  &:focus {
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }
`

const StyledPaletteField = styled.div`
  --platform-colors-surface: var(--purechart-panel);
  --platform-colors-surface-hover: var(--purechart-panel-subtle);
  --platform-colors-border: var(--purechart-border-soft);
  --platform-colors-text: var(--purechart-text);
  --platform-colors-text-secondary: var(--purechart-muted);
  --platform-palette-dropdown-height: var(--purechart-control-height);
  --platform-palette-dropdown-radius: var(--purechart-radius-control);
`

//#endregion

const TYPE_LABELS: Record<ChartType, string> = {
  line: 'Line',
  area: 'Area',
  bar: 'Bar',
  'grouped-bar': 'Grouped',
  'stacked-bar': 'Stacked',
  scatter: 'Scatter',
  'connected-scatter': 'Connected',
  lollipop: 'Lollipop',
  slopegraph: 'Slope',
  histogram: 'Histogram',
}

export function ControlsPanel({
  session,
  table,
  expanded = false,
  section = 'chart',
  interactionMode,
  onInteractionModeChange,
  onResetInteraction,
}: ControlsPanelProps): React.ReactElement {
  const { spec } = session
  const { encodings, style } = spec.chart

  const allColumns: SelectOption[] = table.columns.map(column => ({
    id: column.name,
    label: column.name,
  }))
  const numericColumns: SelectOption[] = table.columns
    .filter(column => column.type === 'number')
    .map(column => ({ id: column.name, label: column.name }))
  const seriesColumns: SelectOption[] = [
    { id: NONE_ID, label: 'None' },
    ...table.columns
      .filter(column => column.type !== 'number')
      .map(column => ({ id: column.name, label: column.name })),
  ]
  const availableYColumns: SelectOption[] = numericColumns.filter(
    column => !encodings.y.includes(column.id),
  )
  const chartTypeOptions: SelectOption[] = CHART_TYPES.map(type => ({
    id: type,
    label: TYPE_LABELS[type],
  }))
  const palettes = chartPaletteList(style.customPalettes)
  const facetColumnOptions: SelectOption[] = table.columns
    .filter(column => column.type !== 'number' && column.name !== encodings.x)
    .map(column => ({ id: column.name, label: column.name }))

  const disabled = table.columns.length === 0

  return (
    <StyledPanel>
      {section === 'chart' ? <>
      {expanded ? (
        <StyledSection>
          <StyledTitle>Chart type</StyledTitle>
          <SelectField
            label="Type"
            value={spec.chart.type}
            options={chartTypeOptions}
            disabled={disabled}
            onChange={id => session.setType(id as ChartType)}
          />
          <StyledHint>
            Choose a chart type, then select the columns to plot.
          </StyledHint>
        </StyledSection>
      ) : null}

      <StyledSection>
        <StyledTitle>Data mapping</StyledTitle>
        <SelectField
          label="X axis"
          value={encodings.x}
          options={allColumns}
          disabled={disabled}
          onChange={session.setX}
        />
        <SelectField
          label="Add Y measure"
          value={null}
          options={availableYColumns}
          disabled={disabled}
          placeholder={
            encodings.y.length > 0 ? 'Add another measure' : 'Choose measure'
          }
          onChange={session.addY}
        />
        <StyledMeasureList aria-label="Selected Y measures">
          {encodings.y.length > 0 ? (
            encodings.y.map(column => (
              <StyledMeasureChip key={column}>
                <StyledMeasureName>{column}</StyledMeasureName>
                <StyledRemoveMeasure
                  type="button"
                  aria-label={`Remove ${column}`}
                  disabled={disabled}
                  onClick={() => session.removeY(column)}
                >
                  <PlatformIcon icon={X} size={12} strokeWidth={2} />
                </StyledRemoveMeasure>
              </StyledMeasureChip>
            ))
          ) : (
            <StyledEmptyMeasures>No Y measures selected</StyledEmptyMeasures>
          )}
        </StyledMeasureList>
        <SelectField
          label="Series"
          value={encodings.series ?? NONE_ID}
          options={seriesColumns}
          disabled={disabled}
          onChange={id => session.setSeries(id === NONE_ID ? null : id)}
        />
      </StyledSection>

      <StyledSection>
        <StyledTitle>Panels</StyledTitle>
        <SelectField
          label="One panel per"
          value={spec.chart.facet.column ?? NONE_ID}
          options={[
            { id: NONE_ID, label: 'One chart' },
            ...facetColumnOptions,
          ]}
          disabled={disabled || facetColumnOptions.length === 0}
          onChange={id => session.setFacet(id === NONE_ID ? null : id)}
        />
        <StyledHint>
          Split categories into separate charts with a shared scale.
        </StyledHint>
      </StyledSection>

      </> : <>
      <StyledSection>
        <StyledTitle>Marks and color</StyledTitle>
        <StyledPaletteField>
          <PaletteDropdown
            label="Data palette"
            value={style.palette}
            palettes={palettes}
            disabled={disabled}
            allowCustom
            menuPlacement="auto"
            onChange={session.setPalette}
            onCreatePalette={session.addCustomPalette}
          />
        </StyledPaletteField>
        <StyledToggles>
          <StyledToggleButton
            type="button"
            $selected={style.rangeFrame}
            aria-pressed={style.rangeFrame}
            disabled={disabled}
            onClick={() => session.toggleStyle('rangeFrame')}
          >
            Range frame
          </StyledToggleButton>
          <StyledToggleButton
            type="button"
            $selected={style.grid}
            aria-pressed={style.grid}
            disabled={disabled}
            onClick={() => session.toggleStyle('grid')}
          >
            Gridlines
          </StyledToggleButton>
          <StyledToggleButton
            type="button"
            $selected={style.directLabels}
            aria-pressed={style.directLabels}
            disabled={disabled}
            onClick={() => session.toggleStyle('directLabels')}
          >
            Direct labels
          </StyledToggleButton>
          <StyledToggleButton
            type="button"
            $selected={style.rug}
            aria-pressed={style.rug}
            disabled={disabled}
            onClick={() => session.toggleStyle('rug')}
          >
            Rug marks
          </StyledToggleButton>
        </StyledToggles>
        <StyledNumberRow>
          <StyledNumberField>
            Stroke width
            <StyledNumberInput
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={style.strokeWidth}
              disabled={disabled}
              onChange={event => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value > 0)
                  session.setStyle({ strokeWidth: value })
              }}
            />
          </StyledNumberField>
          <StyledNumberField>
            Point radius
            <StyledNumberInput
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={style.pointRadius}
              disabled={disabled}
              onChange={event => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value >= 0)
                  session.setStyle({ pointRadius: value })
              }}
            />
          </StyledNumberField>
        </StyledNumberRow>
      </StyledSection>
      <StyledSection>
        <StyledTitle>Axes</StyledTitle>
        <StyledAxisRow>
          <StyledAxisField>
            <StyledAxisLabel htmlFor="axis-x-name">X axis label</StyledAxisLabel>
            <StyledAxisInput
              id="axis-x-name"
              value={spec.chart.axes.x.name ?? ''}
              placeholder={encodings.x ?? 'the x column'}
              disabled={disabled}
              onChange={event => session.setAxis('x', { name: event.target.value || null })}
            />
          </StyledAxisField>
          <StyledAxisField>
            <StyledAxisLabel htmlFor="axis-y-name">Y axis label</StyledAxisLabel>
            <StyledAxisInput
              id="axis-y-name"
              value={spec.chart.axes.y.name ?? ''}
              placeholder={encodings.y[0] ?? 'the measure'}
              disabled={disabled}
              onChange={event => session.setAxis('y', { name: event.target.value || null })}
            />
          </StyledAxisField>
        </StyledAxisRow>
        <StyledAxisRow>
          <StyledAxisField>
            <StyledAxisLabel htmlFor="axis-y-unit">Y unit</StyledAxisLabel>
            <StyledAxisInput
              id="axis-y-unit"
              value={spec.chart.axes.y.unit ?? ''}
              placeholder="minutes, NZ$, %"
              disabled={disabled}
              onChange={event => session.setAxis('y', { unit: event.target.value || null })}
            />
          </StyledAxisField>
        </StyledAxisRow>
        <StyledHint>
          Axis labels and units are included in exports.
        </StyledHint>
      </StyledSection>

      <StyledSection>
        <StyledTitle>Mode</StyledTitle>
        <StyledUtilityRow>
          <StyledSegmentedWrap>
            <SegmentedControl
              aria-label="Chart interaction mode"
              options={[
                { value: 'read', label: 'Read' },
                { value: 'explore', label: 'Explore' },
              ]}
              value={interactionMode}
              onValueChange={mode => {
                if (!disabled) onInteractionModeChange(mode)
              }}
            />
          </StyledSegmentedWrap>
          <StyledToggleButton
            type="button"
            disabled={disabled}
            onClick={onResetInteraction}
          >
            Reset view
          </StyledToggleButton>
          <StyledToggleButton
            type="button"
            disabled={spec.chart.annotations.length === 0}
            onClick={session.clearAnnotations}
          >
            Clear annotations
          </StyledToggleButton>
        </StyledUtilityRow>
        <StyledHint>
          Hover to inspect. Shift-click compares. Explore enables brush and
          zoom; double-click adds a mark. Reset view restores the zoom and selection.
        </StyledHint>
      </StyledSection>

      </>}

    </StyledPanel>
  )
}

const StyledAxisRow = styled.div`
  display: flex;
  gap: var(--purechart-space-sm);
`

const StyledAxisField = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const StyledAxisLabel = styled.label`
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
`

const StyledAxisInput = styled.input`
  box-sizing: border-box;
  width: 100%;
  height: var(--purechart-control-height);
  padding: 0 8px;
  border-radius: var(--purechart-radius-control);
  border: 1px solid var(--purechart-border);
  background: var(--purechart-panel);
  color: var(--purechart-text);
  font: inherit;
  font-size: var(--platform-typography-font-size-sm);

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 1px;
  }
`
