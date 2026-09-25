import { CrossAppDragHandle } from '@purescience/platform-ui/components/assets/CrossAppDragHandle'
import { svgAssetDataUrl } from '@purescience/platform-editor/assetTransfer.ts'
import { serializeSvg } from '../lib/chartExport'
import { ChartProposalPanel } from './ChartProposalPanel'
import { PresentationPanel } from './PresentationPanel'
import { ExportPanel } from './ExportPanel'
import { CalculationsPanel } from './CalculationsPanel'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { EmptyState } from '@purescience/platform-ui/components/common/feedback/EmptyState'
import { InlineBanner } from '@purescience/platform-ui/components/common/feedback/InlineBanner'
import {
  AppSidebar,
  EditorToolbar,
  MetaText,
  PaperSurface,
  ToolbarSelect,
} from '@purescience/platform-ui/components/common/containers/AppChrome'
import { styled } from 'styled-components'
import { computeChartGeometry } from '../lib/chartLayout'
import { facetLayout } from '../lib/chartFacet'
import { chartFindings } from '../lib/chartFindings'
import { reviewChart } from '../lib/chartReview'
import { openAssistantDrawer } from '../bridge/platformBridge'
import type { InteractionMode } from '../lib/chartInteraction'
import type { ChartSession } from '../hooks/useChartSession'
import { useElementSize } from '../hooks/useElementSize'
import { ChartCanvas } from './ChartCanvas'
import { ChartCaption } from './ChartCaption'
import { ControlsPanel } from './ControlsPanel'
import { DataPanel } from './DataPanel'
import { FacetCanvas } from './FacetCanvas'
import { FormsRail } from './FormsRail'
import { SecondLookPanel } from './SecondLookPanel'
import { SheetView } from './SheetView'
import { TableDrawer } from './TableDrawer'

//#region styled-components

// Chrome measures, faces and colours are the platform's --pure-chrome-*
// tokens; the --purechart-* names below are aliases the panels read so the
// chart's own palette (chartTheme.ts) stays separate from the UI around it.
const StyledRoot = styled.div`
  --purechart-line-height-ui: 1.35;
  --purechart-space-xs: 4px;
  --purechart-space-sm: 8px;
  --purechart-space-md: var(--pure-chrome-inset);
  --purechart-space-lg: 24px;
  --purechart-control-height: var(--pure-chrome-field-height);
  --purechart-radius-control: 7px;
  --purechart-radius-panel: 12px;
  --purechart-panel: var(--glass-panel);
  --pure-chrome-surface: var(--glass-panel);
  --pure-chrome-bar: var(--glass-panel);
  --purechart-panel-subtle: var(--pure-chrome-well);
  --purechart-border: var(--pure-chrome-line);
  --purechart-border-soft: var(--pure-chrome-line);
  --purechart-text: var(--platform-colors-text);
  --purechart-muted: var(--pure-chrome-muted);
  --purechart-soft: var(--pure-chrome-soft);
  --purechart-focus: var(--pure-chrome-accent);
  --purechart-content-text: var(--platform-colors-text);
  --purechart-content-muted: var(--platform-colors-text-secondary);
  --platform-empty-state-padding: var(--platform-spacing-lg, 24px);
  --platform-empty-state-title-size: 14px;
  --platform-empty-state-message-width: 24rem;

  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: radial-gradient(ellipse at 8% 0%, #b4eaff, transparent 60%),
    radial-gradient(ellipse at 100% 0%, #c6f4ee, transparent 60%),
    linear-gradient(145deg, #f3f7ff 35%, #faf6ed);
  :root[data-platform-appearance='white'] & { background: #fff; }
  color: var(--purechart-text);
  font-family: var(--platform-typography-font-family);
  font-size: var(--pure-chrome-ui-size);
  line-height: var(--purechart-line-height-ui);
`

const StyledWorkspace = styled.div`
  display: grid;
  grid-template-columns: minmax(0, min(var(--chart-panel-width, 360px), 52%)) minmax(0, 1fr);
  min-height: 0;
  min-width: 0;
  &[data-controls-hidden='true'] { grid-template-columns: minmax(0, 1fr); }
  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(160px, 40%) minmax(200px, 1fr);
    &[data-controls-hidden='true'] { grid-template-rows: minmax(0, 1fr); }
  }
`

const StyledSidebar = styled(AppSidebar)`
  && {
    min-width: 0;
    width: auto;
    padding: 0 16px 20px;
    border: 0;
    background: transparent;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  &[hidden] { display: none; }
`

const StyledPaneSize = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 16px;
  font-size: 12px;
  color: var(--purechart-muted);
  input { min-width: 0; width: 130px; accent-color: var(--purechart-focus); }
  @media (max-width: 600px) { display: none; }
`

const StyledTabs = styled.nav`
  display: flex;
  padding: 4px;
  gap: 2px;
  border: 1px solid var(--purechart-border);
  border-radius: 10px;
  background: var(--purechart-panel-subtle);
`

const StyledTab = styled.button`
  flex: 1;
  min-width: 0;
  min-height: 32px;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 0 5px;
  background: transparent;
  color: var(--purechart-text);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  &[aria-pressed='true'] {
    background: var(--purechart-panel);
    border-color: var(--purechart-border);
    box-shadow: 0 1px 3px #0000000a;
    font-weight: 600;
  }
  &:focus-visible { outline: 2px solid var(--purechart-focus); outline-offset: 2px; }
`

const StyledMain = styled.section`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
`

// The chart's title bar is the editor toolbar: 36px, title + meta on the
// left, export controls on the right. The app header itself is shell-drawn.
const StyledHeader = styled(EditorToolbar)`
  background: var(--glass-panel);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  && {
    justify-content: space-between;
    gap: 12px;
    margin: 0 12px 12px;
    min-width: 0;
    height: auto;
    min-height: 40px;
    flex-wrap: wrap;
    padding: 6px 10px;
  }
`

const StyledHeaderTitle = styled.div`
  display: flex;
  flex: 1 1 240px;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
`

const StyledChartTitle = styled.input`
  flex: 1;
  min-width: 0;
  max-width: 48ch;
  margin: 0;
  padding: 2px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
  color: var(--purechart-text);
  font: inherit;
  font-size: var(--pure-chrome-ui-size);
  font-weight: var(--platform-typography-font-weight-bold);
  line-height: var(--purechart-line-height-ui);
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover,
  &:focus {
    border-bottom-color: var(--purechart-border);
    outline: 0;
  }

  &::placeholder {
    color: var(--purechart-soft);
  }
`

const StyledChartMeta = styled(MetaText)`
  flex: none;
  font-variant-numeric: tabular-nums;
  @media (max-width: 1000px) { display: none; }
`

const StyledHeaderActions = styled.div`
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
`

const StyledHeaderExportButton = styled(ToolbarSelect)`
  && { min-height: 32px; border-radius: 7px; padding: 0 10px; font-size: 12px; }
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--pure-chrome-hover);
  }

  &:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--purechart-focus) 34%, transparent);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`

const StyledCanvasArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 0 16px 12px 0;
  [data-controls-hidden=true] & { padding-left: 16px; }
  @media (max-width: 600px) { padding-left: 16px; }
  background: transparent;
  overflow: hidden;
`

// The chart sits on the platform paper slab (white in the light, a lighter
// slab on dusk in the dark) so the frame never paints a white block.
const StyledCanvasFrame = styled(PaperSurface)`
  display: flex;
  /* The caption belongs under the chart. PaperSurface lays out in a row by
     default, which put it alongside and squeezed the drawing. */
  flex-direction: column;
  align-items: center;
  min-height: 0;
  width: 100%;
  flex: 1;
  overflow: hidden;
  box-sizing: border-box;
  padding: clamp(8px, 2vw, 24px);
  border-radius: 12px;
  border: 1px solid var(--purechart-border);
  box-shadow: none;
`

const StyledChartStage = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: stretch;
  width: min(100%, 1240px);
  flex: 1;
  min-height: 0;
  color: var(--purechart-content-text);
`

/** The caption sits under the drawing, on the same measure as the drawing. */
const StyledCaptionSlot = styled.div`
  width: min(100%, 1240px);
  flex-shrink: 0;
  padding-top: var(--purechart-space-sm);
`

const StyledRailContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-md);
  padding: 20px 0 0;
  min-width: 0;
  > h2 { margin: 0; font-size: 16px; font-weight: 650; }
  p { line-height: 1.5; }
  details > summary { padding: 8px 0; font-size: 12px; font-weight: 600; cursor: pointer; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, summary:focus-visible {
    outline: 2px solid var(--purechart-focus); outline-offset: 2px;
  }
`

const StyledStatus = styled(MetaText)`
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 0 0 auto;
  > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  > button { flex: none; white-space: nowrap; }
  padding: var(--purechart-space-sm) var(--purechart-space-lg);
  border-top: 1px solid var(--pure-chrome-line);
  background: var(--pure-chrome-bar);
  white-space: normal;
`

//#endregion

interface ChartWorkspaceProps {
  saveStatus?: string
  onRetrySave?: () => void
  session: ChartSession
  /** The rendered chart element, shared with the exportChart agent tool. */
  svgRef: RefObject<SVGSVGElement | null>
  /** Commit the chart title as the document name (rename on filed docs). */
  onCommitTitle: (title: string) => void
}

export function ChartWorkspace({
  saveStatus,
  onRetrySave,
  session,
  svgRef,
  onCommitTitle,
}: ChartWorkspaceProps): React.ReactElement {
  const { ref: canvasRef, size } = useElementSize<HTMLDivElement>()
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>('read')
  const [interactionResetToken, setInteractionResetToken] = useState(0)
  const [tableOpen, setTableOpen] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(false)
  const [panelWidth, setPanelWidth] = useState(() => {
    try { const value = Number(localStorage.getItem('purechart.panelWidth')); return value >= 300 && value <= 640 ? value : 360 }
    catch { return 360 }
  })
  const showPanel = (next: typeof panel) => { setPanel(next); setControlsHidden(false) }
  const [panel, setPanel] = useState<'data' | 'chart' | 'style' | 'review' | 'export'>(session.table.rows.length ? 'chart' : 'data')

  const geometry = useMemo(
    () => computeChartGeometry(session.table, session.spec, size),
    [session.table, session.spec, size],
  )
  const facets = useMemo(
    () => facetLayout(session.table, session.spec, size),
    [session.table, session.spec, size],
  )
  // Measured against the chart as drawn, so the review and the drawing can
  // never disagree about which series are on screen or what colour they are.
  const review = useMemo(
    () => reviewChart(session.table, session.spec, facets ? undefined : geometry),
    [session.table, session.spec, geometry, facets],
  )
  const findings = useMemo(
    () => chartFindings(session.table, session.spec, facets ? undefined : geometry),
    [session.table, session.spec, geometry, facets],
  )
  const drawn = facets !== null || !geometry.empty
  // null means the sheet itself is on screen rather than one of its charts.
  const onSheet = session.sheet.focusedId === null

  // Escape returns to the sheet; Cmd/Ctrl + number opens a chart.
  // Alt + arrows navigate charts without stealing ordinary control keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (typing || event.defaultPrevented) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) session.redo()
        else session.undo()
        return
      }
      if (target?.closest('button, [role=combobox], [role=menu], [role=dialog]')) return
      const charts = session.sheet.charts
      if (event.key === 'Escape' && !onSheet && !event.defaultPrevented) {
        event.preventDefault()
        session.focusChart(null)
        return
      }
      if ((event.metaKey || event.ctrlKey) && /^[0-9]$/.test(event.key)) {
        const index = Number(event.key)
        if (index === 0) {
          event.preventDefault()
          session.focusChart(null)
        } else if (charts[index - 1]) {
          event.preventDefault()
          session.focusChart(charts[index - 1]!.id)
        }
        return
      }
      if (onSheet || charts.length < 2) return
      if (event.altKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        const at = charts.findIndex(entry => entry.id === session.sheet.focusedId)
        if (at === -1) return
        event.preventDefault()
        const step = event.key === 'ArrowRight' ? 1 : -1
        const next = (at + step + charts.length) % charts.length
        session.focusChart(charts[next]!.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSheet, session])

  return (
    <StyledRoot data-app="chart">
        <StyledHeader>
          <StyledHeaderTitle>
            <StyledChartTitle
              aria-label={onSheet ? 'Document name' : 'Chart name'}
              value={onSheet ? session.sheet.title : session.spec.title}
              placeholder={onSheet ? 'Untitled chart' : 'Name this chart'}
              onChange={event =>
                onSheet
                  ? session.setTitle(event.target.value)
                  : session.setChartName(event.target.value)
              }
              onBlur={event => {
                if (!onSheet) return
                if (!event.target.value.trim())
                  session.setTitle('Untitled chart')
                onCommitTitle(event.target.value)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <StyledChartMeta>
              {session.table.rows.length} rows · {session.table.columns.length}{' '}
              columns
              {session.sheet.charts.length > 1
                ? ` · ${session.sheet.charts.length} charts`
                : ''}
            </StyledChartMeta>
          </StyledHeaderTitle>
          <StyledHeaderActions>
            <StyledHeaderExportButton aria-expanded={!controlsHidden} onClick={() => setControlsHidden(value => !value)}>{controlsHidden ? 'Show controls' : 'Hide controls'}</StyledHeaderExportButton>
            <StyledHeaderExportButton aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={!session.canUndo} onClick={session.undo}>Undo</StyledHeaderExportButton>
            <StyledHeaderExportButton aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={!session.canRedo} onClick={session.redo}>Redo</StyledHeaderExportButton>
            {onSheet ? null : (
              <StyledHeaderExportButton
                onClick={() => session.focusChart(null)}
              >
                ‹ Sheet
              </StyledHeaderExportButton>
            )}
            <StyledHeaderExportButton disabled={!drawn || onSheet} onClick={() => showPanel('export')}>Export…</StyledHeaderExportButton>
          </StyledHeaderActions>
        </StyledHeader>
      <StyledWorkspace data-controls-hidden={controlsHidden} style={{ '--chart-panel-width': `${panel === 'data' ? Math.max(440, panelWidth) : panelWidth}px` } as CSSProperties}>
      <StyledSidebar hidden={controlsHidden} aria-label="Chart controls">
        <StyledPaneSize>Pane width<input aria-label="Pane width" type="range" min={300} max={640} value={panelWidth} onChange={event => {
          const width = Number(event.target.value); setPanelWidth(width)
          try { localStorage.setItem('purechart.panelWidth', String(width)) } catch { /* Sizing still works without storage. */ }
        }} /></StyledPaneSize>
        <StyledTabs aria-label="Editor panels">
          {(['data', 'chart', 'style', 'review', 'export'] as const).map(tab => (
            <StyledTab key={tab} type="button" aria-pressed={panel === tab}
              onClick={() => setPanel(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </StyledTab>
          ))}
        </StyledTabs>
        <StyledRailContent>
          <h2>{({ data: 'Data', chart: 'Chart', style: 'Style', review: 'Review', export: 'Export' })[panel]}</h2>
          {session.staleFigures.length > 0 && panel !== 'export' ? (
            <StyledFiguresBehind>
              <span>{session.staleFigures.length === 1 ? 'One figure drawn from this chart is behind it.' : `${session.staleFigures.length} figures drawn from this chart are behind it.`}</span>
              <button type="button" onClick={() => setPanel('export')}>Redraw…</button>
            </StyledFiguresBehind>
          ) : null}
          {session.proposal && <ChartProposalPanel key={session.proposal.id} session={session} />}
          <div hidden={panel !== 'data'}><DataPanel
            sourceText={session.spec.data.inline?.text ?? ''}
            charts={session.sheet.charts}
            table={session.table}
            onPasteText={(text, options) => {
              const firstImport = session.table.rows.length === 0
              session.setPastedText(text, options)
              if (firstImport && session.sheet.charts[0]) {
                session.focusChart(session.sheet.charts[0].id)
                setPanel('chart')
              }
            }}
          /></div>
          {onSheet && panel !== 'data' ? (
            <EmptyState title="Choose a chart" message="Open a chart on the sheet to edit its design, or add a new chart." />
          ) : null}
          {!onSheet && (panel === 'chart' || panel === 'style') && <ControlsPanel
            session={session}
            table={session.table}
            section={panel}
            expanded
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            onResetInteraction={() => setInteractionResetToken(value => value + 1)}
          />}
          {!onSheet && panel === 'style' && <PresentationPanel session={session} />}
          {!onSheet && panel === 'export' && <ExportPanel session={session} />}
          {!onSheet && panel === 'chart' && <CalculationsPanel session={session} />}
          {!onSheet && panel === 'chart' && <details>
            <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Suggested charts</summary>
            <FormsRail
              table={session.table}
              spec={session.spec}
              onChoose={(next, label) => session.applyChartSpec(next, { table: session.table, status: label })}
              onShowEveryForm={() => setPanel('chart')}
            />
          </details>}
          {!onSheet && panel === 'review' && <SecondLookPanel
            review={review}
            spec={session.spec}
            onApply={(next, label) => session.applyChartSpec(next, { table: session.table, status: label })}
            onNameAxis={() => setPanel('style')}
            onShowTable={() => setTableOpen(true)}
          />}
          {session.error && <InlineBanner variant="danger">{session.error}</InlineBanner>}
        </StyledRailContent>
      </StyledSidebar>

      <StyledMain>

        <StyledCanvasArea>
          <StyledCanvasFrame>
            {!onSheet && drawn && <CrossAppDragHandle label="chart" style={{alignSelf:'flex-end',margin:8}} getContent={() => {
              if (!svgRef.current) throw new Error('The chart is not ready.')
              return { name: `${session.spec.title || 'chart'}.svg`, alt: session.spec.title || 'Chart', caption: session.spec.chart.caption || undefined, dataUrl: svgAssetDataUrl(serializeSvg(svgRef.current)) }
            }} />}

            <StyledChartStage ref={canvasRef}>
              {session.table.rows.length === 0 ? (
                <EmptyState title="Turn your data into a chart" message="Import a file or paste a table in the Data panel, then Apply data." />
              ) : onSheet ? (
                <SheetView
                  sheet={session.sheet}
                  table={session.table}
                  onFocus={session.focusChart}
                  onAdd={session.addChart}
                  onDuplicate={session.duplicateChart}
                  onRemove={session.removeChart}
                />
              ) : facets ? (
                <FacetCanvas
                  ref={svgRef}
                  layout={facets}
                  spec={session.spec}
                  dims={size}
                  onAddAnnotation={session.addAnnotation}
                />
              ) : geometry.empty ? (
                <EmptyState
                  title="No chart yet"
                  message={geometry.message ?? 'Import or paste your data.'}
                />
              ) : (
                <ChartCanvas
                  ref={svgRef}
                  geometry={geometry}
                  spec={session.spec}
                  interactionMode={interactionMode}
                  resetToken={interactionResetToken}
                  onAddAnnotation={session.addAnnotation}
                />
              )}
            </StyledChartStage>
            {drawn && !onSheet ? (
              <StyledCaptionSlot>
                <ChartCaption
                  caption={session.spec.chart.caption}
                  findings={findings}
                  onChange={session.setCaption}
                  onAsk={() => void openAssistantDrawer()}
                />
              </StyledCaptionSlot>
            ) : null}
          </StyledCanvasFrame>
          <TableDrawer
            columnTypes={session.spec.data.columnTypes}
            sourceText={session.spec.data.inline?.text ?? ''}
            onEdit={session.editData}
            table={session.table}
            open={tableOpen}
            onToggle={() => setTableOpen(value => !value)}
          />
        </StyledCanvasArea>
        <StyledStatus as="footer" role="status"><span title={[saveStatus, session.status].filter(Boolean).join(' · ')}>{saveStatus && `${saveStatus} · `}{session.status}</span>{onRetrySave && <button onClick={onRetrySave}>Retry save</button>}</StyledStatus>
      </StyledMain>
      </StyledWorkspace>
    </StyledRoot>
  )
}

const StyledFiguresBehind = styled.p`
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin: 0 0 8px; padding: 6px 8px; font-size: 12px;
  border: 1px solid var(--purechart-border); border-radius: 6px;
  color: var(--purechart-warning, #a15c00);
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
`
