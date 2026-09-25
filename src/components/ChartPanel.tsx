import { styled } from 'styled-components'

/** Shared form rhythm for the chart inspectors; chart marks keep their own theme. */
export const ChartPanel = styled.section`
  display: grid;
  gap: 12px;
  min-width: 0;
  h3, p { margin: 0; }
  h3 { font-size: 13px; font-weight: 600; }
  p { color: var(--purechart-muted); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
  label { display: grid; gap: 6px; font-size: 12px; font-weight: 500; }
  label:has(> input[type=checkbox]) { display: flex; align-items: center; gap: 8px; }
  input, button { box-sizing: border-box; min-width: 0; font: inherit; color: inherit; }
  input:not([type=checkbox]), button {
    min-height: 32px;
    padding: 7px 9px;
    border: 1px solid var(--purechart-border);
    border-radius: 7px;
    background: var(--purechart-panel);
  }
  input:not([type=checkbox]) { width: 100%; }
  input[type=checkbox] { margin: 0; accent-color: var(--purechart-focus); }
  button { cursor: pointer; font-size: 12px; font-weight: 500; }
  button:hover:not(:disabled) { background: var(--pure-chrome-hover); }
  button:disabled { opacity: .4; cursor: default; }
  summary { cursor: pointer; font-size: 12px; font-weight: 600; padding: 7px 0; }
  details[open] > :not(summary) { margin-top: 10px; }
  details > button { margin-right: 5px; }
  [role=alert] { color: var(--pure-danger-text, #a03930); }
`
