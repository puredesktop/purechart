import { ChartPanel } from './ChartPanel'
import { CHART_STYLES_KEY, readChartStyles, saveChartStyle, deleteChartStyle, applyChartStyle, type SavedChartStyle } from '../lib/chartStyles'
import { useEffect, useState } from 'react'
import type { ChartSession } from '../hooks/useChartSession'
import { defaultPresentation, type ChartPresentation } from '../lib/chartPresentation'
import { type ChartAxis } from '../lib/chartSpec'
import { SelectField } from './SelectField'

function NumberField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (value: number | null) => void }) {
  return <label>{label}<input aria-label={label} type="number" placeholder="Auto" key={String(value)} defaultValue={value ?? ''} onBlur={event => {
    const raw = event.currentTarget.value
    const next = raw === '' ? null : Number(raw)
    if (next === null || Number.isFinite(next)) onChange(next)
  }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></label>
}

export function PresentationPanel({ session }: { session: ChartSession }) {
  const { spec } = session
  const presentation = spec.chart.presentation ?? defaultPresentation()
  const update = (next: ChartPresentation) => session.applyChartSpec({ ...spec, chart: { ...spec.chart, presentation: next } }, { table: session.table })
  const [referenceValue, setReferenceValue] = useState('')
  const [referenceLabel, setReferenceLabel] = useState('')
  const [referenceAxis, setReferenceAxis] = useState<'x' | 'y'>('y')
  const [styles, setStyles] = useState<SavedChartStyle[]>([])
  const [styleName, setStyleName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const refresh = () => {
      try { setStyles(readChartStyles(localStorage)); setError('') }
      catch { setError('Could not read saved styles. Existing chart styling is unchanged.') }
    }
    const changed = (event: StorageEvent) => { if (event.key === CHART_STYLES_KEY || event.key === null) refresh() }
    refresh()
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  const numeric = session.table.columns.filter(c => c.type === 'number').map(c => ({ id: c.name, label: c.name }))
  return <Panel>
    <h3>Axes and layout</h3>
    {(['x', 'y'] as const).map(axis => <details key={axis}>
      <summary>{axis.toUpperCase()} axis bounds and format</summary>
      <SelectField label={`${axis.toUpperCase()} scale`} value={spec.chart.axes[axis].scale ?? 'linear'} options={[{ id: 'linear', label: 'Linear' }, { id: 'log', label: 'Logarithmic' }]} onChange={scale => session.setAxis(axis, { scale: scale as 'linear' | 'log' })} />
      <NumberField label={`${axis.toUpperCase()} minimum`} value={spec.chart.axes[axis].min} onChange={min => session.setAxis(axis, { min })} />
      <NumberField label={`${axis.toUpperCase()} maximum`} value={spec.chart.axes[axis].max} onChange={max => session.setAxis(axis, { max })} />
      <SelectField label={`${axis.toUpperCase()} number format`} value={spec.chart.axes[axis].format} options={['plain', 'grouped', 'percent', 'compact'].map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }))} onChange={format => session.setAxis(axis, { format: format as ChartAxis['format'] })} />
      <p>Bounds apply to numeric axes. Log scales require positive values. Bars retain a linear scale.</p>
    </details>)}
    <SelectField label="Legend position" value={presentation.legend} options={['auto', 'top', 'right', 'bottom', 'none'].map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }))} onChange={legend => update({ ...presentation, legend: legend as ChartPresentation['legend'] })} />
    <details><summary>Reference lines ({presentation.references.length})</summary>
      {presentation.references.map(line => <div key={line.id}>{line.label || line.axis}: {line.value} <button aria-label={`Remove reference ${line.label || line.value}`} onClick={() => update({ ...presentation, references: presentation.references.filter(r => r.id !== line.id) })}>Remove</button></div>)}
      <SelectField label="Reference axis" value={referenceAxis} options={[{ id: 'y', label: 'Y' }, { id: 'x', label: 'Numeric X' }]} onChange={axis => setReferenceAxis(axis as 'x' | 'y')} />
      <input aria-label="Reference value" type="number" placeholder="Value" value={referenceValue} onChange={e => setReferenceValue(e.target.value)} />
      <input aria-label="Reference label" placeholder="Label" value={referenceLabel} onChange={e => setReferenceLabel(e.target.value)} />
      <button disabled={!referenceValue.trim() || !Number.isFinite(Number(referenceValue))} onClick={() => { update({ ...presentation, references: [...presentation.references, { id: crypto.randomUUID(), axis: referenceAxis, value: Number(referenceValue), label: referenceLabel }] }); setReferenceValue(''); setReferenceLabel('') }}>Add reference line</button>
    </details>
    <details><summary>Error bars</summary>
      <p>Choose absolute lower and upper bounds for one Y measure. Each plotted row needs its own interval; duplicate categories cannot be aggregated.</p>
      <SelectField label="Lower bound column" value={presentation.errorBars?.lower ?? '__none__'} options={[{ id: '__none__', label: 'No error bars' }, ...numeric]} onChange={lower => update({ ...presentation, errorBars: lower === '__none__' ? null : { lower, upper: presentation.errorBars?.upper ?? lower } })} />
      {presentation.errorBars && <SelectField label="Upper bound column" value={presentation.errorBars.upper} options={numeric} onChange={upper => update({ ...presentation, errorBars: { ...presentation.errorBars!, upper } })} />}
    </details>
    <details><summary>Edit annotations ({spec.chart.annotations.length})</summary>
      {!spec.chart.annotations.length && <p>Double-click a chart point to add an annotation.</p>}
      {spec.chart.annotations.map(annotation => <div key={annotation.id}>
        <input aria-label={`Annotation ${annotation.text}`} defaultValue={annotation.text} key={annotation.text} onBlur={event => session.applyChartSpec({ ...spec, chart: { ...spec.chart, annotations: spec.chart.annotations.map(a => a.id === annotation.id ? { ...a, text: event.target.value } : a) } }, { table: session.table })} />
        <button aria-label={`Remove annotation ${annotation.text}`} onClick={() => session.applyChartSpec({ ...spec, chart: { ...spec.chart, annotations: spec.chart.annotations.filter(a => a.id !== annotation.id) } }, { table: session.table })}>Remove</button>
      </div>)}
    </details>
    <details><summary>Reusable styles</summary>
      <SelectField label="Apply saved style" value={null} disabled={!styles.length} options={styles.map(style => ({ id: style.name, label: style.name }))} onChange={name => {
        try {
          const saved = readChartStyles(localStorage).find(style => style.name === name)
          if (!saved) throw new Error('This style is no longer available.')
          session.applyChartSpec(applyChartStyle(session.liveSpec(), saved), { table: session.liveTable(), status: `Applied style “${name}”` })
          setError('')
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not apply this style.') }
      }} />
      {styles.map(style => <div key={style.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{style.name}</span>
        <button aria-label={`Delete style ${style.name}`} onClick={() => {
          try { setStyles(deleteChartStyle(localStorage, style.name)); setError('') }
          catch { setError('Could not delete this style. The saved style library is unchanged.') }
        }}>Delete</button>
      </div>)}
      <input aria-label="Style name" placeholder="Name this style" value={styleName} onChange={e => setStyleName(e.target.value)} />
      <button disabled={!styleName.trim()} onClick={() => {
        const name = styleName.trim()
        try { setStyles(saveChartStyle(localStorage, name, session.liveSpec())); setStyleName(''); setError('') }
        catch { setError('Could not store this style. Local storage may be unavailable, full, or contain an unreadable style library.') }
      }}>Save style</button>
      <p>Styles store colors, marks, grid, labels, and legend placement. Saving an existing name replaces that style. Applying is undoable; deleting a saved style leaves charts unchanged. Colors are shared across the sheet.</p>
      {error && <p role="alert">{error}</p>}
    </details>
  </Panel>
}
const Panel = ChartPanel
