import { ChartPanel } from './ChartPanel'
import { useMemo, useState } from 'react'
import { styled } from 'styled-components'
import type { ChartSession } from '../hooks/useChartSession'
import { renderChartSvg } from '../lib/chartRender'
import { serializeTableCsv, serializeTableJson, svgToPngBytes } from '../lib/chartExport'
import { SelectField } from './SelectField'
import { sayStale, type FigurePalette } from '../lib/chartFigures'
import { enterprise } from '../enterpriseLook'

const PRESETS = [
  { id: 'report', label: 'Report figure', width: 1200, height: 800, scale: 1 },
  { id: 'slides', label: 'Slides · 16:9', width: 1600, height: 900, scale: 1 },
  { id: 'print', label: 'Print · high resolution', width: 1800, height: 1200, scale: 2 },
]

function safeStem(title: string): string {
  const stem = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || 'untitled-chart'
}

function triggerDownload(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function ExportPanel({ session }: { session: ChartSession }) {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id)
  const [drafts, setDrafts] = useState({
    width: String(PRESETS[0]!.width),
    height: String(PRESETS[0]!.height),
    scale: String(PRESETS[0]!.scale),
  })
  const [transparent, setTransparent] = useState(false)
  const [palette, setPalette] = useState<FigurePalette>('source')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'status' | 'alert'; message: string } | null>(null)

  const width = drafts.width.trim() === '' ? NaN : Math.round(Number(drafts.width))
  const height = drafts.height.trim() === '' ? NaN : Math.round(Number(drafts.height))
  const scale = drafts.scale.trim() === '' ? NaN : Math.round(Number(drafts.scale))
  const valid =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number.isFinite(scale) &&
    scale >= 1 &&
    scale <= 4 &&
    width >= 320 &&
    width <= 4096 &&
    height >= 240 &&
    height <= 4096 &&
    width * height * scale ** 2 <= 40_000_000

  // The preview is drawn the way the file will be: one ink means one ink.
  const previewSpec = useMemo(
    () =>
      palette === 'monochrome'
        ? { ...session.spec, chart: { ...session.spec.chart, style: { ...session.spec.chart.style, palette: 'mono' } } }
        : session.spec,
    [session.spec, palette],
  )
  const preview = useMemo(
    () =>
      valid
        ? renderChartSvg(session.table, previewSpec, {
            width,
            height,
            background: transparent ? null : undefined,
          })
        : null,
    [session.table, previewSpec, width, height, transparent, valid],
  )
  const exporting = async (format: 'svg' | 'png') => {
    setBusy(true)
    setFeedback(null)
    try {
      await (format === 'svg' ? session.exportSvg : session.exportPng)(null, {
        width,
        height,
        scale,
        transparent,
        palette,
      })
    } finally {
      setBusy(false)
    }
  }
  const copyPng = async () => {
    if (!preview || preview.message || !valid) return
    setBusy(true)
    setFeedback(null)
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('Copying PNG images to the clipboard is not supported in this browser.')
      }
      const bytes = await svgToPngBytes(preview.svg, preview.width, preview.height, {
        scale,
        background: transparent ? null : undefined,
      })
      const buffer = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(buffer).set(bytes)
      const blob = new Blob([buffer], { type: 'image/png' })
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setFeedback({ tone: 'status', message: 'Copied PNG to clipboard.' })
    } catch (error) {
      setFeedback({
        tone: 'alert',
        message: error instanceof Error ? error.message : 'Could not copy PNG to clipboard.',
      })
    } finally {
      setBusy(false)
    }
  }
  const exportData = (format: 'csv' | 'json') => {
    if (session.table.columns.length === 0) return
    const stem = safeStem(session.spec.title)
    if (format === 'csv') {
      const fileName = `${stem}.csv`
      triggerDownload(fileName, serializeTableCsv(session.table), 'text/csv;charset=utf-8')
      setFeedback({ tone: 'status', message: `Downloaded ${fileName}.` })
    } else {
      const fileName = `${stem}.json`
      triggerDownload(fileName, serializeTableJson(session.table), 'application/json;charset=utf-8')
      setFeedback({ tone: 'status', message: `Downloaded ${fileName}.` })
    }
  }

  const stale = new Set(session.staleFigures)
  const orphans = new Set(session.orphanedFigures)
  const redrawing = async (which?: typeof session.figures) => {
    setBusy(true)
    try { await session.rerenderFigures(which) }
    finally { setBusy(false) }
  }
  const hasData = session.table.columns.length > 0
  return <Panel>
    <h3>Export chart</h3>
    <SelectField
      label="Export preset"
      value={presetId}
      options={PRESETS}
      onChange={id => {
        const preset = PRESETS.find(p => p.id === id)
        if (!preset) return
        setPresetId(preset.id)
        setDrafts({
          width: String(preset.width),
          height: String(preset.height),
          scale: String(preset.scale),
        })
      }}
    />
    {(['width', 'height', 'scale'] as const).map(key => <label key={key}>{key === 'scale' ? 'PNG pixel scale' : `${key.charAt(0).toUpperCase() + key.slice(1)} (px)`}
      <input
        aria-label={`Export ${key}`}
        type="number"
        value={drafts[key]}
        min={key === 'scale' ? 1 : key === 'width' ? 320 : 240}
        max={key === 'scale' ? 4 : 4096}
        step={1}
        onChange={event => {
          setDrafts(current => ({ ...current, [key]: event.target.value }))
        }}
      />
    </label>)}
    <label><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} /> Transparent background</label>
    <SelectField label="Colours" value={palette} options={[{ id: 'source', label: 'The chart’s own palette' }, { id: 'monochrome', label: 'One ink, for print' }]} onChange={id => setPalette(id as FigurePalette)} />
    <p>{valid ? `PNG: ${width * scale} × ${height * scale} pixels. SVG remains scalable.` : 'Enter valid dimensions (320–4096 px) and scale (1–4).'}</p>
    {!preview?.message && preview?.warnings.map(warning => <p role="status" key={warning}>{warning}</p>)}
    {!valid ? <p role="alert">Choose at least 320 × 240 (up to 4096 × 4096), scale 1–4, and no more than 40 million output pixels.</p> : preview?.message ? <p role="alert">{preview.message}</p> : <Preview aria-hidden="true" dangerouslySetInnerHTML={{ __html: preview?.svg.replace(/^<\?xml[^>]*\?>\s*/, '') ?? '' }} />}
    <button type="button" disabled={busy || !valid || !!preview?.message} onClick={() => void exporting('svg')}>Export SVG</button>
    <button type="button" disabled={busy || !valid || !!preview?.message} onClick={() => void exporting('png')}>{busy ? 'Exporting…' : 'Export PNG'}</button>
    <button type="button" disabled={busy || !valid || !!preview?.message} onClick={() => void copyPng()}>Copy PNG</button>
    <DataActions>
      <button type="button" disabled={busy || !hasData} onClick={() => exportData('csv')}>Export CSV</button>
      <button type="button" disabled={busy || !hasData} onClick={() => exportData('json')}>Export JSON</button>
    </DataActions>
    {feedback && <p role={feedback.tone}>{feedback.message}</p>}
    <p>Saved documents export to their assets/figures folder. Unsaved standalone charts download to your computer.</p>
    {session.figures.length ? <Figures aria-label="Figures drawn from this chart">
      <h4>Drawn into</h4>
      <p data-stale={session.staleFigures.length > 0 || undefined}>{orphans.size && !session.staleFigures.length ? 'No figures need redrawing.' : sayStale(session.staleFigures.length)}</p>
      <ul>
        {session.figures.map(figure => <li key={`${figure.collectionPath}/${figure.relativePath}`} data-stale={stale.has(figure) || undefined}>
          <span>{figure.relativePath.split('/').pop()}</span>
          <small>{figure.collectionPath.split('/').pop()} · {figure.width}×{figure.height}{figure.scale > 1 ? ` @${figure.scale}×` : ''}{figure.palette === 'monochrome' ? ' · one ink' : ''}{orphans.has(figure) ? ' · source chart removed' : stale.has(figure) ? ' · behind' : ''}</small>
          {!orphans.has(figure) ? <button type="button" disabled={busy} onClick={() => void redrawing([figure])}>Redraw</button> : null}
          <button type="button" disabled={busy} onClick={() => void session.forgetFigure(figure)} aria-label={`Stop tracking ${figure.relativePath}`}>Forget</button>
        </li>)}
      </ul>
      {session.staleFigures.length ? <button type="button" disabled={busy} onClick={() => void redrawing()}>{busy ? 'Redrawing…' : `Redraw ${session.staleFigures.length === 1 ? 'the figure that is' : `the ${session.staleFigures.length} figures that are`} behind`}</button> : null}
    </Figures> : null}
  </Panel>
}
const Panel = ChartPanel
const DataActions = styled.div`
  display: flex;
  gap: 8px;
  > button { flex: 1; }
`
const Figures = styled.section`
  display: grid; gap: 6px; padding-top: 8px; border-top: 1px solid var(--purechart-border);
  h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
  ${enterprise} & h4 { font-weight: 600; text-transform: none; letter-spacing: normal; }
  p[data-stale] { color: var(--purechart-warning, #a15c00); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; grid-template-columns: 1fr auto auto; column-gap: 8px; align-items: center; font-size: 13px; }
  li small { grid-column: 1 / -1; opacity: 0.7; }
  li[data-stale] span::before { content: '●'; margin-right: 6px; color: var(--purechart-warning, #a15c00); }
`
const Preview = styled.div`border: 1px solid var(--purechart-border); background: #fff; svg { display: block; width: 100%; height: auto; pointer-events: none; }`
