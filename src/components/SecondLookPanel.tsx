import { styled } from 'styled-components'
import {
  applyChartFix,
  type ChartFinding,
  type ChartReview,
} from '../lib/chartReview'
import type { ChartSpec } from '../lib/chartSpec'

/**
 * Second look, on screen.
 *
 * No score and no grade: a chart is not better for having fewer findings, it
 * is better for having none that matter. Each finding names the mark it is
 * about and carries the change that settles it, so the panel is a short list
 * of decisions rather than a report card.
 */

interface SecondLookPanelProps {
  review: ChartReview
  spec: ChartSpec
  onApply: (spec: ChartSpec, label: string) => void
  onNameAxis: (axis: 'x' | 'y') => void
  onShowTable: () => void
}

export function SecondLookPanel({
  review,
  spec,
  onApply,
  onNameAxis,
  onShowTable,
}: SecondLookPanelProps): React.ReactElement | null {
  if (review.findings.length === 0 && review.cleared.length === 0) return null

  const take = (finding: ChartFinding, index: number): void => {
    const fix = finding.fixes[index]
    if (!fix) return
    if (fix.kind === 'name-axis') {
      onNameAxis(fix.axis)
      return
    }
    if (fix.kind === 'table') {
      onShowTable()
      return
    }
    onApply(applyChartFix(spec, fix), fix.label)
  }

  return (
    <StyledPanel aria-label="Second look">
      <StyledHeading>
        Second look
        {review.findings.length > 0 ? (
          <StyledCount>{review.findings.length}</StyledCount>
        ) : null}
      </StyledHeading>

      {review.findings.map(finding => (
        <StyledFinding key={finding.id} $severity={finding.severity}>
          <StyledTag $severity={finding.severity}>
            {finding.severity === 'blocking'
              ? "Won't read"
              : finding.severity === 'check'
                ? 'Check'
                : 'Note'}
          </StyledTag>
          <StyledTitle>{finding.title}</StyledTitle>
          <StyledDetail>{finding.detail}</StyledDetail>
          {finding.fixes.length > 0 ? (
            <StyledFixes>
              {finding.fixes.map((fix, index) => (
                <StyledFix
                  key={fix.label}
                  type="button"
                  $primary={index === 0}
                  onClick={() => take(finding, index)}
                >
                  {fix.label}
                </StyledFix>
              ))}
            </StyledFixes>
          ) : null}
        </StyledFinding>
      ))}

      {review.findings.length === 0 ? (
        <StyledClearNote>
          Nothing to look at. Every pair of colours, the baseline and the
          labels were measured.
        </StyledClearNote>
      ) : null}

      {review.cleared.length > 0 ? (
        <StyledCleared>
          <StyledClearedHeading>Checked and clear</StyledClearedHeading>
          <StyledClearedList>
            {review.cleared.map(item => (
              <li key={item}>{item}</li>
            ))}
          </StyledClearedList>
        </StyledCleared>
      ) : null}

      {review.colour.worstNormal !== null ? (
        <StyledWorking>
          Closest pair {review.colour.worstNormal} apart to ordinary colour
          vision
          {review.colour.worstCvd !== null
            ? `, ${review.colour.worstCvd} under simulated colour blindness`
            : ''}
          {review.colour.scope === 'all'
            ? ' — every pair checked, because this form puts them all on screen at once.'
            : '.'}
        </StyledWorking>
      ) : null}
    </StyledPanel>
  )
}

//#region styled-components

const StyledPanel = styled.section`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-sm);
  min-width: 0;
`

const StyledHeading = styled.h2`
  display: flex;
  align-items: center;
  gap: var(--purechart-space-sm);
  margin: 0;
  font-size: var(--platform-typography-font-size-xs);
  font-weight: var(--platform-typography-font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--purechart-muted);
`

const StyledCount = styled.span`
  padding: 0 6px;
  border-radius: 999px;
  background: var(--purechart-panel-subtle);
  color: var(--purechart-text);
  letter-spacing: 0;
`

const StyledFinding = styled.div<{ $severity: ChartFinding['severity'] }>`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-panel);
  border: 1px solid
    ${({ $severity }) =>
      $severity === 'blocking'
        ? 'var(--pure-danger-border, var(--purechart-border))'
        : $severity === 'check'
          ? 'var(--pure-attention-border, var(--purechart-border))'
          : 'var(--purechart-border)'};
  background: ${({ $severity }) =>
    $severity === 'blocking'
      ? 'var(--pure-danger-muted)'
      : $severity === 'check'
        ? 'var(--pure-attention-muted)'
        : 'var(--purechart-panel)'};
`

const StyledTag = styled.span<{ $severity: ChartFinding['severity'] }>`
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: var(--purechart-radius-control);
  font-size: var(--platform-typography-font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: ${({ $severity }) =>
    $severity === 'blocking'
      ? 'var(--pure-danger-text)'
      : $severity === 'check'
        ? 'var(--pure-attention-text)'
        : 'var(--purechart-panel-subtle)'};
  color: ${({ $severity }) =>
    $severity === 'note'
      ? 'var(--purechart-muted)'
      : 'var(--pure-chrome-on-accent)'};
`

const StyledTitle = styled.p`
  margin: 0;
  font-size: var(--platform-typography-font-size-sm);
  font-weight: var(--platform-typography-font-weight-semibold);
`

const StyledDetail = styled.p`
  margin: 0;
  font-size: var(--platform-typography-font-size-xs);
  line-height: 1.45;
  color: var(--purechart-content-muted);
`

const StyledFixes = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--purechart-space-xs);
  margin-top: var(--purechart-space-xs);
`

const StyledFix = styled.button<{ $primary: boolean }>`
  padding: 5px 10px;
  border-radius: var(--purechart-radius-control);
  border: 1px solid
    ${({ $primary }) =>
      $primary ? 'transparent' : 'var(--purechart-border)'};
  background: ${({ $primary }) =>
    $primary ? 'var(--pure-chrome-accent)' : 'var(--purechart-panel)'};
  color: ${({ $primary }) =>
    $primary ? 'var(--pure-chrome-on-accent)' : 'var(--purechart-text)'};
  font: inherit;
  font-size: var(--platform-typography-font-size-xs);
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

const StyledClearNote = styled.p`
  margin: 0;
  font-size: var(--platform-typography-font-size-xs);
  line-height: 1.45;
  color: var(--purechart-content-muted);
`

const StyledCleared = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
`

const StyledClearedHeading = styled.span`
  font-size: var(--platform-typography-font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--purechart-muted);
`

const StyledClearedList = styled.ul`
  margin: 0;
  padding-left: 1.1em;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--platform-typography-font-size-xs);
  line-height: 1.4;
  color: var(--purechart-content-muted);
`

const StyledWorking = styled.p`
  margin: 0;
  font-size: var(--platform-typography-font-size-xs);
  line-height: 1.4;
  color: var(--purechart-muted);
  font-variant-numeric: tabular-nums;
`

//#endregion
