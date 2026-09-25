import { forwardRef, useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent, WheelEvent } from 'react'
import type { ChartGeometry } from '../lib/chartLayout'
import type { ChartAnnotation, ChartSpec } from '../lib/chartSpec'
import {
  annotationFromBrush,
  annotationFromPoint,
  brushContainsPoint,
  brushSelection,
  nearestPoint,
  normalizeBrush,
  pointId,
  summarizeBrush,
} from '../lib/chartInteraction'
import type {
  BrushRange,
  InteractionMode,
  InteractivePoint,
} from '../lib/chartInteraction'
import {
  CHART_AXIS_FONT_SIZE,
  CHART_FAINT,
  CHART_FONT_FAMILY,
  CHART_INK,
  CHART_LABEL_FONT_SIZE,
  CHART_MUTED_INK,
} from '../lib/chartTheme'
import { CHART_TRANSIENT_ATTR } from '../lib/chartExport'

/** Props that keep live exploration state out of every export. */
const TRANSIENT = { [CHART_TRANSIENT_ATTR]: '' } as const

const RUG_TICK = 6

interface ChartCanvasProps {
  geometry: ChartGeometry
  spec: ChartSpec
  interactionMode: InteractionMode
  resetToken: number
  onAddAnnotation: (annotation: ChartAnnotation) => void
  /**
   * Draw the marks and the axes, and nothing else.
   *
   * A thumbnail is a silhouette: it answers "what shape is this" at a glance,
   * and a title, a legend and a value on every bar all say things the card
   * around it already says, in type too small to read.
   */
  bare?: boolean
}

/**
 * What an axis is called.
 *
 * An explicit name wins; otherwise the column's own name, which is better
 * than nothing but is why naming an axis exists. A unit is appended in
 * parentheses rather than repeated on every tick.
 */
function axisTitle(
  spec: ChartSpec,
  axis: 'x' | 'y',
  fallback: string | null,
): string | null {
  const { name, unit } = spec.chart.axes[axis]
  const base = name ?? (unit ? fallback : null)
  if (!base) return null
  return unit ? `${base} (${unit})` : base
}

function formatValue(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function isLineLike(type: ChartSpec['chart']['type']): boolean {
  return (
    type === 'line' ||
    type === 'area' ||
    type === 'connected-scatter' ||
    type === 'slopegraph'
  )
}

function isBarLike(type: ChartSpec['chart']['type']): boolean {
  return (
    type === 'bar' ||
    type === 'grouped-bar' ||
    type === 'stacked-bar' ||
    type === 'histogram'
  )
}

function isPointLike(type: ChartSpec['chart']['type']): boolean {
  return type === 'scatter'
}

function pointerPosition(
  event: MouseEvent<SVGRectElement>,
  width: number,
  height: number,
): { x: number; y: number } {
  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left) * (width / bounds.width),
    y: (event.clientY - bounds.top) * (height / bounds.height),
  }
}

/**
 * Renders chart geometry as SVG. d3 computed the numbers in lib; this component
 * draws them and owns only transient exploration state. Saved annotations live
 * in the chart spec so export stays deliberate and clean.
 */
export const ChartCanvas = forwardRef<SVGSVGElement, ChartCanvasProps>(
  function ChartCanvas(
    { geometry, spec, interactionMode, resetToken, onAddAnnotation, bare = false },
    ref,
  ) {
    const { dims, plot, xTicks, yTicks, xFrame, yFrame, series } = geometry
    const { type, style, annotations, encodings } = spec.chart
    const lineLike = isLineLike(type)
    const barLike = isBarLike(type)
    const pointLike = isPointLike(type)
    const [hover, setHover] = useState<InteractivePoint | null>(null)
    const [pinned, setPinned] = useState<InteractivePoint[]>([])
    const [brushStart, setBrushStart] = useState<{
      x: number
      y: number
    } | null>(null)
    const [brush, setBrush] = useState<BrushRange | null>(null)
    const [focusedSeries, setFocusedSeries] = useState<string | null>(null)
    const [zoomLevel, setZoomLevel] = useState(1)
    /**
     * One clip per chart.
     *
     * A fixed id meant every chart on the page shared the first one defined,
     * so once the forms rail put thumbnails above the stage, the stage's
     * marks were clipped to a thumbnail's plot and vanished — while the axes
     * and labels, which sit outside the clip, stayed. The drawing looked
     * empty for no reason anyone could see.
     */
    const instanceId = useId().replace(/:/g, '')
    const clipId = `purechart-plot-clip-${instanceId}`
    const marksClipId = `purechart-marks-clip-${instanceId}`
    const edgePadding = zoomLevel === 1 ? Math.max(style.pointRadius + 8, style.strokeWidth + 3) : 0
    const shadowId = `purechart-mark-shadow-${instanceId}`

    useEffect(() => {
      setHover(null)
      setPinned([])
      setBrushStart(null)
      setBrush(null)
      setFocusedSeries(null)
      setZoomLevel(1)
    }, [resetToken])

    const interactivePoints = useMemo(
      () =>
        series.flatMap(s =>
          s.points.map((point, index) => ({
            ...point,
            id: pointId(s.key, point.xLabel, index),
            seriesKey: s.key,
            color: s.color,
          })),
        ),
      [series],
    )

    const brushSummary = useMemo(
      () => summarizeBrush(interactivePoints, brush),
      [brush, interactivePoints],
    )

    const activePoint = hover ?? pinned[pinned.length - 1] ?? null
    const xAxisStart = style.rangeFrame ? xFrame.start : plot.left
    const xAxisEnd = style.rangeFrame ? xFrame.end : plot.right
    const yAxisStart = style.rangeFrame ? yFrame.start : plot.bottom
    const yAxisEnd = style.rangeFrame ? yFrame.end : plot.top
    const tooltipWidth = 204
    const tooltipHeight = pinned.length > 1 ? 82 : 76
    const tooltipX = activePoint
      ? Math.min(
          Math.max(plot.left + 6, activePoint.cx + 14),
          dims.width - tooltipWidth - 8,
        )
      : 0
    const tooltipY = activePoint
      ? Math.min(
          Math.max(8, activePoint.cy - tooltipHeight - 12),
          dims.height - tooltipHeight - 8,
        )
      : 0

    function clearTransientSelection(): void {
      setHover(null)
      setPinned([])
      setBrushStart(null)
      setBrush(null)
      setFocusedSeries(null)
      setZoomLevel(1)
    }

    function handlePointerMove(event: MouseEvent<SVGRectElement>): void {
      const pos = pointerPosition(event, dims.width, dims.height)
      if (brushStart && interactionMode === 'explore') {
        setBrush(normalizeBrush(brushStart, pos, plot))
        return
      }
      if (pinned.length > 0) return
      setHover(nearestPoint(interactivePoints, pos.x, pos.y))
    }

    function handlePointerDown(event: MouseEvent<SVGRectElement>): void {
      if (interactionMode !== 'explore') return
      setBrushStart(pointerPosition(event, dims.width, dims.height))
      setBrush(null)
    }

    function handlePointerUp(): void {
      if (!brush) {
        setBrushStart(null)
        return
      }
      const tooSmall = brush.x1 - brush.x0 < 8 && brush.y1 - brush.y0 < 8
      if (tooSmall) setBrush(null)
      setBrushStart(null)
    }

    function handlePointClick(event: MouseEvent<SVGRectElement>): void {
      if (brushStart) return
      const pos = pointerPosition(event, dims.width, dims.height)
      const nextPinned = nearestPoint(interactivePoints, pos.x, pos.y)
      if (!nextPinned) {
        setPinned([])
        setHover(null)
        return
      }
      if (event.shiftKey) {
        setPinned(current => {
          if (current.some(point => point.id === nextPinned.id)) return current
          return [...current, nextPinned].slice(-3)
        })
      } else {
        setPinned([nextPinned])
      }
      setHover(null)
    }

    function handleDoubleClick(event: MouseEvent<SVGRectElement>): void {
      const pos = pointerPosition(event, dims.width, dims.height)
      const point = nearestPoint(interactivePoints, pos.x, pos.y)
      if (point) {
        onAddAnnotation(annotationFromPoint(point))
        return
      }
      if (brush && brushSummary) {
        // Stored as data, not as the brush rectangle: the first and last
        // selected x labels and the brushed y extent in axis units.
        const annotation = annotationFromBrush(
          brushSelection(interactivePoints, brush),
          brushSummary,
          {
            from: geometry.yValueAtPixel(brush.y1),
            to: geometry.yValueAtPixel(brush.y0),
          },
        )
        if (annotation) onAddAnnotation(annotation)
      }
    }

    function handleKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
      if (event.key === 'Escape') clearTransientSelection()
    }

    function handleWheel(event: WheelEvent<SVGRectElement>): void {
      if (interactionMode !== 'explore') return
      event.preventDefault()
      const delta = event.deltaY < 0 ? 0.12 : -0.12
      setZoomLevel(current => Math.min(3, Math.max(1, current + delta)))
    }

    function seriesOpacity(key: string): number {
      if (!focusedSeries) return 1
      return focusedSeries === key ? 1 : 0.16
    }

    function pointOpacity(point: InteractivePoint): number {
      if (!brush) return 1
      return brushContainsPoint(brush, point) ? 1 : 0.18
    }

    function annotationAnchor(
      annotation: ChartAnnotation,
    ): InteractivePoint | null {
      const target = annotation.target
      if (target.kind !== 'point') return null
      return (
        interactivePoints.find(
          point =>
            point.seriesKey === target.seriesKey &&
            point.xLabel === target.xLabel,
        ) ?? null
      )
    }

    return (
      <svg
        ref={ref}
        width={dims.width}
        height={dims.height}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        role="img"
        aria-label={spec.title}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: CHART_FONT_FAMILY,
          display: 'block',
          outline: 'none',
        }}
      >
        <defs>
          <filter
            id={shadowId}
            x="-12%"
            y="-12%"
            width="124%"
            height="124%"
          >
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="2"
              floodColor="#1c1a17"
              floodOpacity="0.08"
            />
          </filter>
          <clipPath id={clipId}>
            <rect
              x={plot.left}
              y={plot.top}
              width={plot.width}
              height={plot.height}
            />
          </clipPath>
          <clipPath id={marksClipId}>
            <rect x={plot.left - edgePadding} y={plot.top - edgePadding} width={plot.width + edgePadding * 2} height={plot.height + edgePadding * 2} />
          </clipPath>
        </defs>

        {!bare && (
          <text
            x={plot.left}
            y={24}
            fontSize={18}
            fontWeight={700}
            fill={CHART_INK}
          >
            {spec.title}
          </text>
        )}

        {!bare && (spec.chart.presentation?.legend ?? 'auto') !== 'none' &&
          ((spec.chart.presentation?.legend ?? 'auto') !== 'auto' || barLike) &&
          series.map((s, index) => {
            const position = spec.chart.presentation?.legend ?? 'auto'
            const x = position === 'right' ? plot.right + 20 : plot.left
            const y = position === 'bottom' ? plot.bottom + 62 + index * 20 : position === 'right' ? plot.top + index * 20 : 44 + index * 20
            return <g key={`legend-${s.key}`} aria-label={`Series: ${s.key}`}>
              <rect x={x} y={y - 9} width={10} height={10} fill={s.color} />
              <text x={x + 18} y={y} fontSize={CHART_AXIS_FONT_SIZE} fill={CHART_INK}>{s.key}</text>
            </g>
          })}
        <g clipPath={`url(#${clipId})`}>
          {spec.chart.presentation?.references.map(reference => {
            const y = geometry.yPixelForValue(reference.value)
            const x = geometry.xPixelForLabel(String(reference.value))
            if (reference.axis === 'x' && x === null) return null
            return <g key={reference.id} aria-label={`Reference: ${reference.label}`}>
              <line x1={reference.axis === 'x' ? x! : plot.left} x2={reference.axis === 'x' ? x! : plot.right}
                y1={reference.axis === 'y' ? y : plot.top} y2={reference.axis === 'y' ? y : plot.bottom}
                stroke={CHART_MUTED_INK} strokeWidth={1.5} strokeDasharray="6 4" />
              <text x={reference.axis === 'x' ? x! + 5 : plot.left + 5} y={reference.axis === 'y' ? y - 5 : plot.top + 14} fontSize={11} fill={CHART_INK}>{reference.label}</text>
            </g>
          })}

        </g>

        {style.grid &&
          yTicks.map((tick, i) => (
            <line
              key={`grid-${i}`}
              x1={plot.left}
              x2={plot.right}
              y1={tick.position}
              y2={tick.position}
              stroke={CHART_FAINT}
              strokeWidth={1}
              strokeDasharray="2 6"
            />
          ))}

        <line
          x1={xAxisStart}
          x2={xAxisEnd}
          y1={plot.bottom}
          y2={plot.bottom}
          stroke={CHART_MUTED_INK}
          strokeWidth={1}
        />
        <line
          x1={plot.left}
          x2={plot.left}
          y1={yAxisStart}
          y2={yAxisEnd}
          stroke={CHART_MUTED_INK}
          strokeWidth={1}
        />

        {!bare && yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={plot.left - 4}
              x2={plot.left}
              y1={tick.position}
              y2={tick.position}
              stroke={CHART_MUTED_INK}
              strokeWidth={1}
            />
            <text
              x={plot.left - 8}
              y={tick.position}
              fontSize={CHART_AXIS_FONT_SIZE}
              textAnchor="end"
              dominantBaseline="middle"
              fill={CHART_MUTED_INK}
            >
              {tick.label}
            </text>
          </g>
        ))}

        {!bare && xTicks.map((tick, i) => (
          <text
            key={`x-${i}`}
            x={tick.position}
            y={plot.bottom + 16}
            fontSize={CHART_AXIS_FONT_SIZE}
            textAnchor="middle"
            fill={CHART_MUTED_INK}
          >
            {tick.fullLabel && tick.fullLabel !== tick.label && (
              <title>{tick.fullLabel}</title>
            )}
            {tick.label}
          </text>
        ))}

        {/* What the axes are called. A column name is not a label, and a
            figure that travels into a document takes its labels with it. */}
        {!bare && axisTitle(spec, 'x', encodings.x) && (
          <text
            x={(plot.left + plot.right) / 2}
            y={plot.bottom + 36}
            fontSize={CHART_AXIS_FONT_SIZE}
            textAnchor="middle"
            fill={CHART_MUTED_INK}
          >
            {axisTitle(spec, 'x', encodings.x)}
          </text>
        )}
        {!bare && axisTitle(spec, 'y', encodings.y[0] ?? null) && (
          <text
            x={16}
            y={(plot.top + plot.bottom) / 2}
            fontSize={CHART_AXIS_FONT_SIZE}
            textAnchor="middle"
            fill={CHART_MUTED_INK}
            transform={`rotate(-90 16 ${(plot.top + plot.bottom) / 2})`}
          >
            {axisTitle(spec, 'y', encodings.y[0] ?? null)}
          </text>
        )}

        {style.rug && (
          <g aria-hidden="true">
            {interactivePoints.map(point => (
              <g key={`rug-${point.id}`}>
                <line
                  x1={point.cx}
                  x2={point.cx}
                  y1={plot.bottom}
                  y2={plot.bottom - RUG_TICK}
                  stroke={point.color}
                  strokeOpacity={0.55}
                  strokeWidth={1}
                />
                <line
                  x1={plot.left}
                  x2={plot.left + RUG_TICK}
                  y1={point.cy}
                  y2={point.cy}
                  stroke={point.color}
                  strokeOpacity={0.55}
                  strokeWidth={1}
                />
              </g>
            ))}
          </g>
        )}

        <g clipPath={`url(#${marksClipId})`}>
          <g
            transform={`translate(${plot.left + plot.width / 2}, ${
              plot.top + plot.height / 2
            }) scale(${zoomLevel}) translate(${-plot.left - plot.width / 2}, ${
              -plot.top - plot.height / 2
            })`}
          >
            {series.map(s => (
              <g key={s.key} opacity={seriesOpacity(s.key)}>
                {barLike &&
                  s.bars.map((bar, i) => (
                    <g key={`bar-${i}`}>
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        fill={s.color}
                        fillOpacity={0.68}
                        filter={`url(#${shadowId})`}
                        rx={7}
                      />
                    </g>
                  ))}
                {lineLike && s.linePath && (
                  <>
                    {s.areaPath && (
                      <path
                        d={s.areaPath}
                        fill={s.color}
                        fillOpacity={type === 'area' ? 0.18 : 0.05}
                      />
                    )}
                    {type !== 'area' && (
                      <path
                        d={s.linePath}
                        fill="none"
                        stroke={s.color}
                        strokeOpacity={0.14}
                        strokeWidth={style.strokeWidth + 5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}
                    <path
                      d={s.linePath}
                      fill="none"
                      stroke={s.color}
                      strokeOpacity={type === 'area' ? 0.9 : 1}
                      strokeWidth={
                        type === 'area'
                          ? style.strokeWidth + 0.4
                          : style.strokeWidth + 0.8
                      }
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {s.points.map((point, i) => (
                      <circle
                        key={`line-pt-${i}`}
                        cx={point.cx}
                        cy={point.cy}
                        r={
                          type === 'area'
                            ? style.pointRadius + 1.4
                            : style.pointRadius + 2
                        }
                        fill="#ffffff"
                        stroke={s.color}
                        strokeWidth={1.8}
                      />
                    ))}
                  </>
                )}
                {type === 'lollipop' &&
                  s.points.map((point, i) => (
                    <g key={`lollipop-${i}`}>
                      <line
                        x1={point.cx}
                        x2={point.cx}
                        y1={plot.bottom}
                        y2={point.cy}
                        stroke={s.color}
                        strokeOpacity={0.24}
                        strokeWidth={1.4}
                      />
                      <circle
                        cx={point.cx}
                        cy={point.cy}
                        r={style.pointRadius + 4}
                        fill={s.color}
                        fillOpacity={0.16}
                      />
                      <circle
                        cx={point.cx}
                        cy={point.cy}
                        r={style.pointRadius + 1.8}
                        fill={s.color}
                        fillOpacity={0.86}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    </g>
                  ))}
                {pointLike &&
                  s.points.map((point, i) => (
                    <g key={`pt-${i}`}>
                      <circle
                        cx={point.cx}
                        cy={point.cy}
                        r={style.pointRadius + 7}
                        fill={s.color}
                        fillOpacity={0.12}
                      />
                      <circle
                        cx={point.cx}
                        cy={point.cy}
                        r={style.pointRadius + 2.2}
                        fill={s.color}
                        fillOpacity={0.82}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    </g>
                  ))}
          {s.points.filter(p => p.error).map((point, index) => <g key={`${s.key}-error-${index}`} aria-label={`Error interval ${point.error!.lower} to ${point.error!.upper}`} stroke={s.color} strokeWidth={1.5}>
            <line x1={point.cx} x2={point.cx} y1={point.error!.lowerY} y2={point.error!.upperY} />
            <line x1={point.cx - 5} x2={point.cx + 5} y1={point.error!.lowerY} y2={point.error!.lowerY} />
            <line x1={point.cx - 5} x2={point.cx + 5} y1={point.error!.upperY} y2={point.error!.upperY} />
          </g>)}

              </g>
            ))}
          </g>
        </g>

        {!bare && !barLike && zoomLevel === 1 && series.map(s => {
          const label = s.label
          if (!label || label.x - 6 < plot.left || label.x - 6 > plot.right || label.y < plot.top || label.y > plot.bottom) return null
          const width = Math.max(20, geometry.dims.width - label.x - 12)
          // One font-size per character leaves room even for wide capitals or
          // CJK glyphs. Prefer word breaks, with a full label in the SVG title.
          const chars = Math.max(1, Math.floor(width / CHART_LABEL_FONT_SIZE))
          const lines: string[] = []
          let remaining = label.text
          while (remaining && lines.length < 4) {
            let end = Math.min(chars, remaining.length)
            const space = remaining.slice(0, end + 1).lastIndexOf(' ')
            if (end < remaining.length && space >= end / 2) end = space
            const part = remaining.slice(0, end)
            remaining = remaining.slice(end).trimStart()
            lines.push(lines.length === 3 && remaining ? `${part.slice(0, -1)}…` : part)
          }
          const lineHeight = CHART_LABEL_FONT_SIZE + 3
          const y = Math.max(plot.top + lineHeight / 2, Math.min(label.y, plot.bottom - (lines.length - .5) * lineHeight))
          return <text key={`direct-${s.key}`} data-direct-label="true" x={label.x} y={y}
            fontSize={CHART_LABEL_FONT_SIZE} fontWeight={600} dominantBaseline="middle" fill={s.color}
            opacity={seriesOpacity(s.key)} onClick={() => setFocusedSeries(current => current === s.key ? null : s.key)} style={{ cursor: 'pointer' }}>
            <title>{label.text}</title>
            {lines.map((line, index) => <tspan key={index} x={label.x} dy={index ? lineHeight : 0}>{line}</tspan>)}
          </text>
        })}

        {!bare &&
          barLike &&
          zoomLevel === 1 &&
          series.map(s => (
            <g
              key={`values-${s.key}`}
              opacity={seriesOpacity(s.key)}
              data-bar-values="true"
            >
              {s.bars.map((bar, index) => (
                <text
                  key={index}
                  x={bar.labelX}
                  y={bar.labelY}
                  fontSize={CHART_AXIS_FONT_SIZE}
                  fontWeight={700}
                  textAnchor="middle"
                  fill={CHART_MUTED_INK}
                >
                  {formatValue(bar.value)}
                </text>
              ))}
            </g>
          ))}

        {brush && (
          <g pointerEvents="none" {...TRANSIENT}>
            <rect
              x={plot.left}
              y={plot.top}
              width={plot.width}
              height={brush.y0 - plot.top}
              fill="var(--platform-colors-surface-subtle, #faf9f6)"
              fillOpacity={0.68}
            />
            <rect
              x={plot.left}
              y={brush.y1}
              width={plot.width}
              height={plot.bottom - brush.y1}
              fill="var(--platform-colors-surface-subtle, #faf9f6)"
              fillOpacity={0.68}
            />
            <rect
              x={plot.left}
              y={brush.y0}
              width={brush.x0 - plot.left}
              height={brush.y1 - brush.y0}
              fill="var(--platform-colors-surface-subtle, #faf9f6)"
              fillOpacity={0.68}
            />
            <rect
              x={brush.x1}
              y={brush.y0}
              width={plot.right - brush.x1}
              height={brush.y1 - brush.y0}
              fill="var(--platform-colors-surface-subtle, #faf9f6)"
              fillOpacity={0.68}
            />
            <rect
              x={brush.x0}
              y={brush.y0}
              width={brush.x1 - brush.x0}
              height={brush.y1 - brush.y0}
              fill="#ffffff"
              fillOpacity={0.08}
              stroke="var(--platform-colors-text-tertiary, #8f897f)"
              strokeWidth={1.5}
              strokeDasharray="3 5"
            />
          </g>
        )}

        {annotations.map(annotation => {
          if (annotation.target.kind === 'range') {
            // Resolve the saved data range against THIS drawing's scales.
            // A label no longer on the axis (data replaced) draws nothing.
            const { x, y } = annotation.target
            const xa = geometry.xPixelForLabel(x.from)
            const xb = geometry.xPixelForLabel(x.to)
            if (xa === null || xb === null) return null
            const range = {
              x0: Math.max(plot.left, Math.min(xa, xb) - geometry.xPad),
              x1: Math.min(plot.right, Math.max(xa, xb) + geometry.xPad),
              y0: Math.max(plot.top, geometry.yPixelForValue(y.to)),
              y1: Math.min(plot.bottom, geometry.yPixelForValue(y.from)),
            }
            return (
              <g key={annotation.id} pointerEvents="none">
                <rect
                  x={range.x0}
                  y={range.y0}
                  width={Math.max(0, range.x1 - range.x0)}
                  height={Math.max(0, range.y1 - range.y0)}
                  fill="var(--platform-colors-warning-muted, #f8edd6)"
                  stroke="var(--platform-colors-warning, #d99a21)"
                  strokeWidth={1}
                  strokeDasharray="4 5"
                  fillOpacity={0.28}
                />
                <text
                  x={range.x0 + 8}
                  y={range.y0 + 18}
                  fontSize={CHART_AXIS_FONT_SIZE}
                  fontWeight={700}
                  fill="var(--platform-colors-warning-text, #8a6012)"
                >
                  {annotation.text}
                </text>
              </g>
            )
          }
          const point = annotationAnchor(annotation)
          if (!point) return null
          const textX = Math.min(point.cx + 18, plot.right - 120)
          const textY = Math.max(plot.top + 18, point.cy - 18)
          return (
            <g key={annotation.id} pointerEvents="none">
              <line
                x1={point.cx}
                y1={point.cy}
                x2={textX - 6}
                y2={textY - 5}
                stroke="var(--platform-colors-warning, #d99a21)"
                strokeWidth={1}
              />
              <circle
                cx={point.cx}
                cy={point.cy}
                r={4}
                fill="var(--platform-colors-warning, #d99a21)"
              />
              <text
                x={textX}
                y={textY}
                fontSize={CHART_AXIS_FONT_SIZE}
                fontWeight={700}
                fill="var(--platform-colors-warning-text, #8a6012)"
              >
                {annotation.text}
              </text>
            </g>
          )
        })}

        {interactivePoints.length > 0 && (
          <rect
            {...TRANSIENT}
            x={plot.left}
            y={plot.top}
            width={plot.width}
            height={plot.height}
            fill="transparent"
            aria-label="Inspect chart points"
            onMouseMove={handlePointerMove}
            onMouseLeave={() => {
              if (pinned.length === 0 && !brushStart) setHover(null)
            }}
            onMouseDown={handlePointerDown}
            onMouseUp={handlePointerUp}
            onClick={handlePointClick}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            style={{
              cursor: interactionMode === 'explore' ? 'crosshair' : 'default',
            }}
          />
        )}

        {pinned.map(point => (
          <circle
            key={`pin-${point.id}`}
            {...TRANSIENT}
            cx={point.cx}
            cy={point.cy}
            r={style.pointRadius + 8}
            fill="var(--app-bg, #e8f6f2)"
            fillOpacity={0.82}
            stroke="var(--app-acc, #00886c)"
            strokeOpacity={0.74}
            strokeWidth={2}
            pointerEvents="none"
          />
        ))}

        {activePoint && (
          <g
            pointerEvents="none"
            opacity={pointOpacity(activePoint)}
            {...TRANSIENT}
          >
            <line
              x1={activePoint.cx}
              x2={activePoint.cx}
              y1={plot.top}
              y2={plot.bottom}
              stroke={CHART_FAINT}
              strokeWidth={1}
              strokeDasharray="2 5"
            />
            <line
              x1={plot.left}
              x2={plot.right}
              y1={activePoint.cy}
              y2={activePoint.cy}
              stroke={CHART_FAINT}
              strokeWidth={1}
              strokeDasharray="2 5"
            />
            <circle
              cx={activePoint.cx}
              cy={activePoint.cy}
              r={style.pointRadius + 8}
              fill="var(--app-bg, #e8f6f2)"
              fillOpacity={0.82}
              stroke="var(--app-acc, #00886c)"
              strokeOpacity={0.78}
              strokeWidth={2}
            />
            <g transform={`translate(${tooltipX}, ${tooltipY})`}>
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                rx={10}
                fill="#ffffff"
                stroke={CHART_FAINT}
                filter={`url(#${shadowId})`}
              />
              <text
                x={14}
                y={24}
                fontSize={CHART_LABEL_FONT_SIZE}
                fontWeight={700}
                fill={CHART_INK}
              >
                {activePoint.seriesKey}
              </text>
              <text
                x={14}
                y={47}
                fontSize={CHART_AXIS_FONT_SIZE}
                fill={CHART_MUTED_INK}
              >
                {activePoint.xLabel} · {formatValue(activePoint.value)}
              </text>
              <text x={14} y={68} fontSize={10} fill={CHART_MUTED_INK}>
                double-click to annotate
              </text>
            </g>
          </g>
        )}

        {brushSummary && (
          <g
            {...TRANSIENT}
            transform={`translate(${Math.max(
              plot.left + 8,
              brush!.x0,
            )}, ${Math.max(plot.top + 8, brush!.y0 - 70)})`}
            pointerEvents="none"
          >
            <rect
              width={222}
              height={58}
              rx={10}
              fill="#ffffff"
              stroke={CHART_FAINT}
              filter={`url(#${shadowId})`}
            />
            <text
              x={12}
              y={20}
              fontSize={CHART_LABEL_FONT_SIZE}
              fontWeight={700}
              fill={CHART_INK}
            >
              {brushSummary.count} selected
            </text>
            <text
              x={12}
              y={40}
              fontSize={CHART_AXIS_FONT_SIZE}
              fill={CHART_MUTED_INK}
            >
              min {formatValue(brushSummary.min)} · max{' '}
              {formatValue(brushSummary.max)} · avg{' '}
              {formatValue(brushSummary.average)}
            </text>
          </g>
        )}

        {interactionMode === 'explore' && zoomLevel > 1 && (
          <text
            {...TRANSIENT}
            x={plot.right}
            y={24}
            textAnchor="end"
            fontSize={CHART_AXIS_FONT_SIZE}
            fill={CHART_MUTED_INK}
          >
            zoom {zoomLevel.toFixed(1)}x
          </text>
        )}
      </svg>
    )
  },
)
