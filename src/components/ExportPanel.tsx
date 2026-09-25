import { ChartPanel } from './ChartPanel'
import { useMemo, useState } from 'react'
import { styled } from 'styled-components'
import type { ChartSession } from '../hooks/useChartSession'
import { renderChartSvg } from '../lib/chartRender'
import { SelectField } from './SelectField'
import { sayStale, type FigurePalette } from '../lib/chartFigures'
const PRESETS = [
  { id: 'report', label: 'Report figure', width: 1200, height: 800, scale: 1 },
  { id: 'slides', label: 'Slides · 16:9', width: 1600, height: 900, scale: 1 },
  { id: 'print', label: 'Print · high resolution', width: 1800, height: 1200, scale: 2 },
]
export function ExportPanel({ session }: { session: ChartSession }) {
  const [settings, setSettings] = useState(PRESETS[0])
  const [transparent, setTransparent] = useState(false)
  const [palette, setPalette] = useState<FigurePalette>('source')
  const [busy, setBusy] = useState(false)
  const pixels = settings.width * settings.height * settings.scale ** 2
  const valid = pixels <= 40_000_000 && settings.width >= 320 && settings.height >= 240
  // The preview is drawn the way the file will be: one ink means one ink.
  const previewSpec = useMemo(() => palette === 'monochrome' ? { ...session.spec, chart: { ...session.spec.chart, style: { ...session.spec.chart.style, palette: 'mono' } } } : session.spec, [session.spec, palette])
  const preview = useMemo(() => valid ? renderChartSvg(session.table, previewSpec, { width: settings.width, height: settings.height, background: transparent ? null : undefined }) : null, [session.table, previewSpec, settings.width, settings.height, transparent, valid])
  const exporting = async (format: 'svg' | 'png') => {
    setBusy(true)
    try { await (format === 'svg' ? session.exportSvg : session.exportPng)(null, { width: settings.width, height: settings.height, scale: settings.scale, transparent, palette }) }
    finally { setBusy(false) }
  }
  const stale = new Set(session.staleFigures)
  const redrawing = async (which?: typeof session.figures) => {
    setBusy(true)
    try { await session.rerenderFigures(which) }
    finally { setBusy(false) }
  }
  return <Panel>
    <h3>Export chart</h3>
    <SelectField label="Export preset" value={settings.id} options={PRESETS} onChange={id => setSettings(PRESETS.find(p => p.id === id)!)} />
    {(['width', 'height', 'scale'] as const).map(key => <label key={key}>{key === 'scale' ? 'PNG pixel scale' : `${key.charAt(0).toUpperCase() + key.slice(1)} (px)`}
      <input aria-label={`Export ${key}`} type="number" value={settings[key]} min={key === 'scale' ? 1 : key === 'width' ? 320 : 240} max={key === 'scale' ? 4 : 4096} step={1} onChange={event => {
        const number = Number(event.target.value)
        if (Number.isFinite(number)) setSettings({ ...settings, [key]: Math.min(key === 'scale' ? 4 : 4096, Math.max(1, Math.round(number))) })
      }} />
    </label>)}
    <label><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} /> Transparent background</label>
    <SelectField label="Colours" value={palette} options={[{ id: 'source', label: 'The chart’s own palette' }, { id: 'monochrome', label: 'One ink, for print' }]} onChange={id => setPalette(id as FigurePalette)} />
    <p>PNG: {settings.width * settings.scale} × {settings.height * settings.scale} pixels. SVG remains scalable.</p>
    {!valid ? <p role="alert">Choose at least 320 × 240 and no more than 40 million output pixels.</p> : preview?.message ? <p role="alert">{preview.message}</p> : <Preview aria-hidden="true" dangerouslySetInnerHTML={{ __html: preview?.svg.replace(/^<\?xml[^>]*\?>\s*/, '') ?? '' }} />}
    <button disabled={busy || !valid || !!preview?.message} onClick={() => void exporting('svg')}>Export SVG</button>
    <button disabled={busy || !valid || !!preview?.message} onClick={() => void exporting('png')}>{busy ? 'Exporting…' : 'Export PNG'}</button>
    <p>Saved documents export to their assets/figures folder. Unsaved standalone charts download to your computer.</p>
    {session.figures.length ? <Figures aria-label="Figures drawn from this chart">
      <h4>Drawn into</h4>
      <p data-stale={session.staleFigures.length > 0 || undefined}>{sayStale(session.staleFigures.length)}</p>
      <ul>
        {session.figures.map(figure => <li key={`${figure.collectionPath}/${figure.relativePath}`} data-stale={stale.has(figure) || undefined}>
          <span>{figure.relativePath.split('/').pop()}</span>
          <small>{figure.collectionPath.split('/').pop()} · {figure.width}×{figure.height}{figure.scale > 1 ? ` @${figure.scale}×` : ''}{figure.palette === 'monochrome' ? ' · one ink' : ''}{stale.has(figure) ? ' · behind' : ''}</small>
          <button type="button" disabled={busy} onClick={() => void redrawing([figure])}>Redraw</button>
          <button type="button" disabled={busy} onClick={() => void session.forgetFigure(figure)} aria-label={`Stop tracking ${figure.relativePath}`}>Forget</button>
        </li>)}
      </ul>
      {session.staleFigures.length ? <button type="button" disabled={busy} onClick={() => void redrawing()}>{busy ? 'Redrawing…' : `Redraw ${session.staleFigures.length === 1 ? 'the figure that is' : `the ${session.staleFigures.length} figures that are`} behind`}</button> : null}
    </Figures> : null}
  </Panel>
}
const Panel = ChartPanel
const Figures = styled.section`
  display: grid; gap: 6px; padding-top: 8px; border-top: 1px solid var(--purechart-border);
  h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
  p[data-stale] { color: var(--purechart-warning, #a15c00); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; grid-template-columns: 1fr auto auto; column-gap: 8px; align-items: center; font-size: 13px; }
  li small { grid-column: 1 / -1; opacity: 0.7; }
  li[data-stale] span::before { content: '●'; margin-right: 6px; color: var(--purechart-warning, #a15c00); }
`
const Preview = styled.div`border: 1px solid var(--purechart-border); background: #fff; svg { display: block; width: 100%; height: auto; pointer-events: none; }`
