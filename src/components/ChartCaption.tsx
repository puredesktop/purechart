import { useState } from 'react'
import { styled } from 'styled-components'
import type { ChartFinding } from '../lib/chartFindings'

/**
 * The sentence under the chart, and where it comes from.
 *
 * Not a writing prompt: the findings offered here are arithmetic over the
 * drawn series, each with its working, so taking one cannot put a claim under
 * the chart that the chart does not support. Edit it afterwards and it is
 * yours — the app stops suggesting once you have written something.
 */

interface ChartCaptionProps {
  caption: string
  findings: ChartFinding[]
  onChange: (caption: string) => void
  /** Hand the writing to the assistant, which reads the same findings. */
  onAsk: () => void
}

export function ChartCaption({
  caption,
  findings,
  onChange,
  onAsk,
}: ChartCaptionProps): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  if (findings.length === 0 && caption.trim() === '') return null

  return (
    <StyledCaption>
      <StyledField
        id="chart-caption"
        value={caption}
        placeholder="Say what this chart shows…"
        aria-label="Caption"
        rows={2}
        onChange={event => onChange(event.target.value)}
      />
      {findings.length > 0 ? (
        <StyledSuggest>
          <StyledRow>
            <StyledToggle
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(value => !value)}
            >
              {open ? 'Hide' : `What this table says · ${findings.length}`}
            </StyledToggle>
            <StyledToggle type="button" onClick={onAsk}>
              Ask the assistant to write it
            </StyledToggle>
          </StyledRow>
          {open ? (
            <StyledList>
              {findings.map(finding => (
                <StyledFinding
                  key={finding.id}
                  type="button"
                  onClick={() => {
                    onChange(finding.text)
                    setOpen(false)
                  }}
                >
                  <StyledText>{finding.text}</StyledText>
                  <StyledWorking>{finding.working}</StyledWorking>
                </StyledFinding>
              ))}
            </StyledList>
          ) : null}
        </StyledSuggest>
      ) : null}
    </StyledCaption>
  )
}

//#region styled-components

const StyledCaption = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
`

const StyledField = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  max-height: 140px;
  resize: vertical;
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-control);
  border: 1px solid transparent;
  background: transparent;
  color: var(--purechart-content-text);
  font: inherit;
  font-size: var(--platform-typography-font-size-sm);
  line-height: 1.5;

  &::placeholder {
    color: var(--purechart-muted);
  }

  &:hover,
  &:focus {
    border-color: var(--purechart-border);
    background: var(--purechart-panel);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 1px;
  }
`

const StyledRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--purechart-space-xs);
`

const StyledSuggest = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
`

const StyledToggle = styled.button`
  align-self: flex-start;
  min-height: 28px;
  padding: 4px 9px;
  border-radius: var(--purechart-radius-control);
  border: 1px solid var(--purechart-border);
  background: transparent;
  color: var(--purechart-muted);
  font: inherit;
  font-size: var(--platform-typography-font-size-xs);
  cursor: pointer;

  &:hover {
    color: var(--purechart-text);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--purechart-space-xs);
`

const StyledFinding = styled.button`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--purechart-space-sm);
  border-radius: var(--purechart-radius-control);
  border: 1px solid var(--purechart-border);
  background: var(--purechart-panel);
  color: var(--purechart-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--purechart-focus);
  }

  &:focus-visible {
    outline: 2px solid var(--purechart-focus);
    outline-offset: 2px;
  }
`

const StyledText = styled.span`
  font-size: var(--platform-typography-font-size-sm);
  line-height: 1.4;
`

const StyledWorking = styled.span`
  font-size: var(--platform-typography-font-size-xs);
  color: var(--purechart-muted);
  font-variant-numeric: tabular-nums;
`

//#endregion
