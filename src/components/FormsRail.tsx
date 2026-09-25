import { useMemo } from 'react'
import { styled } from 'styled-components'
import { renderChartSvg } from '../lib/chartRender'
import { applyForm, suggestForms, type FormCandidate } from '../lib/chartForms'
import type { ChartSpec } from '../lib/chartSpec'
import type { DataTable } from '../lib/dataParse'

/**
 * The forms this table can show, drawn from this table.
 *
 * A dropdown of geometry names asks the person to translate a question into a
 * shape, and lets them pick one the data cannot honestly support. These are
 * the same candidates, made from their own rows, so the choice is made by
 * looking. The ones the table cannot support stay on the list with the
 * reason, because "you can't do that here" is more useful than a missing
 * option.
 */

const THUMB_WIDTH = 260
const THUMB_HEIGHT = 96

interface FormsRailProps {
  table: DataTable
  spec: ChartSpec
  onChoose: (spec: ChartSpec, label: string) => void
  onShowEveryForm: () => void
}

export function FormsRail({
  table,
  spec,
  onChoose,
  onShowEveryForm,
}: FormsRailProps): React.ReactElement | null {
  const candidates = useMemo(() => suggestForms(table), [table])

  const thumbs = useMemo(
    () =>
      candidates.map(candidate =>
        candidate.supported
          ? renderChartSvg(table, applyForm(spec, candidate), {
              width: THUMB_WIDTH,
              height: THUMB_HEIGHT,
              background: null,
              bare: true,
            }).svg.replace(/^<\?xml[^>]*\?>\s*/, '')
          : null,
      ),
    // Keep previews in sync with the palette and styling of the live chart.
    [candidates, table, spec],
  )

  if (candidates.length === 0) return null

  const chosen = (candidate: FormCandidate): boolean =>
    candidate.type === spec.chart.type &&
    (candidate.facet ?? null) === spec.chart.facet.column &&
    candidate.encodings.series === spec.chart.encodings.series

  return (
    <StyledRail aria-label="Ways to show this table">
      <StyledHeading>Ways to show it</StyledHeading>
      {candidates.map((candidate, index) => (
        <StyledCard
          key={`${candidate.type}-${candidate.facet ?? ''}-${index}`}
          type="button"
          $chosen={chosen(candidate)}
          $supported={candidate.supported}
          aria-pressed={chosen(candidate)}
          disabled={!candidate.supported}
          title={candidate.because}
          onClick={() => onChoose(applyForm(spec, candidate), candidate.job)}
        >
          <StyledThumb aria-hidden="true">
            {thumbs[index] ? (
              <span dangerouslySetInnerHTML={{ __html: thumbs[index]! }} />
            ) : (
              <StyledNoThumb>not from this table</StyledNoThumb>
            )}
          </StyledThumb>
          <StyledJob>{candidate.job}</StyledJob>
          <StyledBecause>{candidate.because}</StyledBecause>
        </StyledCard>
      ))}
      <StyledEveryForm type="button" onClick={onShowEveryForm}>
        Choose any chart type above
      </StyledEveryForm>
    </StyledRail>
  )
}

//#region styled-components

const StyledRail = styled.nav`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-sm);
  min-width: 0;
`

const StyledHeading = styled.h2`
  margin: 0;
  font-size: var(--platform-typography-font-size-xs);
  font-weight: var(--platform-typography-font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--purechart-muted);
`

const StyledCard = styled.button<{ $chosen: boolean; $supported: boolean }>`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-panel);
  border: 1px solid
    ${({ $chosen }) =>
      $chosen ? 'var(--purechart-focus)' : 'var(--purechart-border)'};
  box-shadow: ${({ $chosen }) =>
    $chosen ? '0 0 0 1px var(--purechart-focus) inset' : 'none'};
  background: var(--purechart-panel);
  color: var(--purechart-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  opacity: ${({ $supported }) => ($supported ? 1 : 0.55)};

  &:disabled {
    cursor: default;
  }

  &:not(:disabled):hover {
    border-color: var(--purechart-focus);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

const StyledThumb = styled.span`
  display: block;
  border-radius: var(--purechart-radius-control);
  background: var(--purechart-panel-subtle);
  overflow: hidden;

  svg {
    display: block;
    width: 100%;
    height: auto;
  }
`

const StyledNoThumb = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
`

const StyledJob = styled.span`
  font-size: var(--platform-typography-font-size-sm);
  font-weight: var(--platform-typography-font-weight-semibold);
`

const StyledBecause = styled.span`
  font-size: var(--platform-typography-font-size-xs);
  line-height: 1.4;
  color: var(--purechart-muted);
`

const StyledEveryForm = styled.button`
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-control);
  border: 1px dashed var(--purechart-border);
  background: transparent;
  color: var(--purechart-muted);
  font: inherit;
  font-size: var(--platform-typography-font-size-xs);
  text-align: left;
  cursor: pointer;

  &:hover {
    color: var(--purechart-text);
    border-color: var(--purechart-focus);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

//#endregion
