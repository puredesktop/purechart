import { startAssetPointerDrag } from '@purescience/platform-ui/bridge/assetDrag'
import { CrossAppDragHandle } from '@purescience/platform-ui/components/assets/CrossAppDragHandle'
import { svgAssetDataUrl } from '@purescience/platform-editor/assetTransfer.ts'
import { useMemo, useState, useRef } from 'react'
import { styled } from 'styled-components'
import { applyForm, suggestForms } from '../lib/chartForms'
import { renderChartSvg } from '../lib/chartRender'
import { reviewChart } from '../lib/chartReview'
import { specForChart, type ChartSheet } from '../lib/chartSheet'
import type { ChartSpec } from '../lib/chartSpec'
import type { DataTable } from '../lib/dataParse'

/**
 * The sheet: every reading of this table, at once.
 *
 * A document used to be one chart, so every experiment destroyed the last one
 * and every control had to stay on screen in case you wanted to get back.
 * Here the charts are all in front of you, small, and the controls belong to
 * whichever one you open.
 */

const CARD_WIDTH = 460
const CARD_HEIGHT = 230

interface SheetViewProps {
  sheet: ChartSheet
  table: DataTable
  onFocus: (id: string) => void
  onAdd: (spec: ChartSpec, label: string) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
}

export function SheetView({
  sheet,
  table,
  onFocus,
  onAdd,
  onDuplicate,
  onRemove,
}: SheetViewProps): React.ReactElement {
  const gesture = useRef({x:0,y:0,dragged:false})
  const [dragError, setDragError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const cards = useMemo(
    () =>
      sheet.charts.map(chart => {
        const spec = specForChart(sheet, chart.id)
        const drawn = renderChartSvg(table, spec, {
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          background: null,
          bare: true,
        })
        const review = drawn.message ? null : reviewChart(table, spec)
        const blocking =
          review?.findings.filter(f => f.severity === 'blocking').length ?? 0
        const checks =
          review?.findings.filter(f => f.severity === 'check').length ?? 0
        return {
          id: chart.id,
          spec,
          svg: drawn.message ? null : drawn.svg.replace(/^<\?xml[^>]*\?>\s*/, ''),
          message: drawn.message,
          blocking,
          checks,
        }
      }),
    [sheet, table],
  )

  const candidates = useMemo(() => suggestForms(table), [table])
  const base = specForChart(sheet, sheet.charts[0]?.id ?? null)

  return (
    <StyledSheet aria-label="Every chart on this sheet">
      {dragError && <p role="alert">{dragError}</p>}
      {cards.map((card, index) => (
        <StyledCard key={card.id}>
          <StyledOpen
            type="button"
            onClick={() => onFocus(card.id)}
            aria-label={`Open ${card.spec.title || 'chart'}`}
          >
            <StyledCardHead>
              <StyledCardTitle>
                {card.spec.title || `Chart ${index + 1}`}
              </StyledCardTitle>
              {card.blocking > 0 ? (
                <StyledFlag $tone="blocking">{card.blocking}</StyledFlag>
              ) : card.checks > 0 ? (
                <StyledFlag $tone="check">{card.checks}</StyledFlag>
              ) : card.svg ? (
                <StyledDot title="Second look: clear" />
              ) : null}
            </StyledCardHead>
            <StyledDrawing title="Drag chart to the app beside this one" style={{cursor:card.svg ? 'grab' : undefined,touchAction:'none'}}
              onPointerDown={event => {
                if (!card.svg) return
                gesture.current = {x:event.clientX,y:event.clientY,dragged:false}
                setDragError(null)
                startAssetPointerDrag(event, () => {
                  const full = renderChartSvg(table, card.spec, {width:1000,height:650})
                  if (full.message) throw Error(full.message)
                  return {name:`${card.spec.title || 'chart'}.svg`,alt:card.spec.title || 'Chart',caption:card.spec.chart.caption || undefined,dataUrl:svgAssetDataUrl(full.svg)}
                }, setDragError)
              }}
              onPointerMove={event => { if (Math.hypot(event.clientX-gesture.current.x,event.clientY-gesture.current.y)>5) gesture.current.dragged=true }}
              onClickCapture={event => { if (gesture.current.dragged) {event.preventDefault();event.stopPropagation();gesture.current.dragged=false} }}>

              {card.svg ? (
                <span dangerouslySetInnerHTML={{ __html: card.svg }} />
              ) : (
                <StyledNothing>{card.message}</StyledNothing>
              )}
            </StyledDrawing>
            {card.spec.chart.caption ? (
              <StyledCaption>{card.spec.chart.caption}</StyledCaption>
            ) : null}
          </StyledOpen>
          <StyledCardActions>
            <CrossAppDragHandle label="chart" disabled={!card.svg} getContent={() => {
              const full = renderChartSvg(table,card.spec,{width:1000,height:650})
              if(full.message)throw new Error(full.message)
              return {name:`${card.spec.title || 'chart'}.svg`,alt:card.spec.title || 'Chart',caption:card.spec.chart.caption || undefined,dataUrl:svgAssetDataUrl(full.svg)}
            }} />
            <StyledSmall type="button" data-card-action="" onClick={() => onDuplicate(card.id)}>
              Duplicate
            </StyledSmall>
            <StyledSmall
              type="button"
              data-card-action=""
              onClick={() => onRemove(card.id)}
              disabled={sheet.charts.length < 2}
            >
              Remove
            </StyledSmall>
          </StyledCardActions>
        </StyledCard>
      ))}

      <StyledAdd>
        {adding ? (
          <StyledMenu aria-label="Add chart">
            <StyledMenuHead>
              Add chart
              <StyledSmall type="button" onClick={() => setAdding(false)}>
                Close
              </StyledSmall>
            </StyledMenuHead>
            {candidates.length === 0 ? (
              <StyledNothing>Load some data first.</StyledNothing>
            ) : (
              candidates.map((candidate, index) => (
                <StyledCandidate
                  key={`${candidate.type}-${candidate.facet ?? ''}-${index}`}
                  type="button"
                  disabled={!candidate.supported}
                  onClick={() => {
                    onAdd(applyForm(base, candidate), candidate.job)
                    setAdding(false)
                  }}
                >
                  <span className="job">{candidate.job}</span>
                  <span className="why">{candidate.because}</span>
                </StyledCandidate>
              ))
            )}
          </StyledMenu>
        ) : (
          <StyledAddButton type="button" onClick={() => setAdding(true)}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="label">Add chart</span>
            <span className="note">
              {candidates.filter(form => form.supported).length} this table
              supports
            </span>
          </StyledAddButton>
        )}
      </StyledAdd>
    </StyledSheet>
  )
}

//#region styled-components

const StyledSheet = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: var(--purechart-space-md);
  align-content: start;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: var(--purechart-space-xs);
`

const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: var(--purechart-radius-panel);
  border: 1px solid var(--purechart-border);
  background: var(--pure-chrome-paper, #fff);
  overflow: hidden;
  transition: border-color 120ms ease, box-shadow 120ms ease;
  &:hover { border-color: var(--purechart-focus); box-shadow: 0 3px 12px #00000008; }

  &:focus-within button[data-card-action],
  &:hover button[data-card-action] {
    opacity: 1;
  }
`

const StyledOpen = styled.button`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
  padding: 14px 14px 0;
  border: none;
  background: transparent;
  color: var(--purechart-content-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: -2px;
  }
`

const StyledCardHead = styled.div`
  display: flex;
  align-items: center;
  gap: var(--purechart-space-sm);
`

const StyledCardTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--platform-typography-font-size-sm);
  font-weight: var(--platform-typography-font-weight-semibold);
`

const StyledDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--pure-success-text, #0ca30c);
  flex-shrink: 0;
`

const StyledFlag = styled.span<{ $tone: 'blocking' | 'check' }>`
  font-size: var(--platform-typography-font-size-xs);
  font-weight: var(--platform-typography-font-weight-bold);
  padding: 1px 7px;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === 'blocking' ? 'var(--pure-danger-muted)' : 'var(--pure-attention-muted)'};
  color: ${({ $tone }) =>
    $tone === 'blocking' ? 'var(--pure-danger-text)' : 'var(--pure-attention-text)'};
`

const StyledDrawing = styled.span`
  display: block;
  border-radius: var(--purechart-radius-control);
  background: transparent;
  overflow: hidden;

  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`

const StyledCaption = styled.span`
  font-size: var(--platform-typography-font-size-xs);
  line-height: 1.4;
  color: var(--purechart-content-muted);
`

const StyledNothing = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 90px;
  padding: var(--purechart-space-sm);
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
  text-align: center;
`

const StyledCardActions = styled.div`
  display: flex;
  gap: var(--purechart-space-xs);
  padding: var(--purechart-space-sm);
  margin-top: auto;
`

const StyledSmall = styled.button`
  font: inherit;
  font-size: var(--platform-typography-font-size-xs);
  padding: 3px 8px;
  border-radius: var(--purechart-radius-control);
  border: 1px solid var(--purechart-border);
  background: transparent;
  color: var(--purechart-muted);
  cursor: pointer;
  opacity: 1;
  transition: opacity 120ms ease;

  &:focus-visible {
    opacity: 1;
    outline: 2px solid var(--purechart-focus);
    outline-offset: 1px;
  }

  &:hover:not(:disabled) {
    color: var(--purechart-text);
  }

  &:disabled {
    cursor: default;
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const StyledAdd = styled.div`
  display: flex;
  min-height: 160px;
`

const StyledAddButton = styled.button`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--purechart-space-xs);
  border-radius: var(--purechart-radius-panel);
  border: 1.5px dashed var(--purechart-border);
  background: transparent;
  color: var(--purechart-muted);
  font: inherit;
  cursor: pointer;

  .label {
    font-size: var(--platform-typography-font-size-sm);
    font-weight: var(--platform-typography-font-weight-semibold);
    color: var(--purechart-text);
  }

  .note {
    font-size: var(--platform-typography-font-size-xs);
  }

  &:hover {
    border-color: var(--purechart-focus);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

const StyledMenu = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-panel);
  border: 1px solid var(--purechart-border);
  background: var(--purechart-panel);
  overflow: auto;
`

const StyledMenuHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--purechart-space-sm);
  font-size: var(--platform-typography-font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--purechart-muted);

  button {
    opacity: 1;
  }
`

const StyledCandidate = styled.button`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-control);
  border: 1px solid var(--purechart-border);
  background: var(--purechart-panel-subtle);
  color: var(--purechart-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  .job {
    font-size: var(--platform-typography-font-size-sm);
    font-weight: var(--platform-typography-font-weight-semibold);
  }

  .why {
    font-size: var(--platform-typography-font-size-xs);
    line-height: 1.4;
    color: var(--purechart-content-muted);
  }

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }

  &:not(:disabled):hover {
    border-color: var(--purechart-focus);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 1px;
  }
`

//#endregion
