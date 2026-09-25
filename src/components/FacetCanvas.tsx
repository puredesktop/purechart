import { formatChartNumber } from '../lib/chartPresentation'
import { forwardRef } from 'react'
import { ChartCanvas } from './ChartCanvas'
import { FACET_PANEL_TITLE_HEIGHT, type FacetLayout } from '../lib/chartFacet'
import type { ChartDims } from '../lib/chartLayout'
import type { ChartAnnotation, ChartSpec } from '../lib/chartSpec'
import {
  CHART_FONT_FAMILY,
  CHART_INK,
  CHART_MUTED_INK,
} from '../lib/chartTheme'

/**
 * The panels, drawn as one figure.
 *
 * Each panel is a nested `<svg>`, so the whole thing is still a single
 * exportable drawing — and each panel is the same component that draws a
 * chart on its own, so nothing about a faceted chart is a second rendering of
 * the same idea. Behind each panel's own line sit the others in grey, which
 * is what turns a row of small pictures into a comparison.
 */

const CONTEXT_INK = '#e3e6ea'

interface FacetCanvasProps {
  layout: FacetLayout
  spec: ChartSpec
  dims: ChartDims
  onAddAnnotation: (annotation: ChartAnnotation) => void
}

export const FacetCanvas = forwardRef<SVGSVGElement, FacetCanvasProps>(
  function FacetCanvas({ layout, spec, dims, onAddAnnotation }, ref) {
    const panelSpec: ChartSpec = {
      ...spec,
      title: '',
      chart: {
        ...spec.chart,
        // A panel's own title names it; end labels would repeat that on every
        // one of them, and there is only ever one line to label.
        style: { ...spec.chart.style, directLabels: false },
        facet: { ...spec.chart.facet, column: null },
      },
    }

    return (
      <svg
        ref={ref}
        width={dims.width}
        height={dims.height}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        role="img"
        aria-label={`${spec.title}, one panel per ${spec.chart.facet.column ?? 'group'}`}
      >
        {!layout.compact && <text x={12} y={24} fontFamily={CHART_FONT_FAMILY} fontSize={18} fontWeight={700} fill={CHART_INK}>{spec.title}</text>}
        {layout.message && <text x={12} y={60} fontFamily={CHART_FONT_FAMILY} fontSize={12} fill={CHART_MUTED_INK}>{layout.message}</text>}
        {layout.panels.map((panel, index) => (
          <svg
            key={panel.value}
            x={panel.frame.x}
            y={panel.frame.y}
            width={panel.frame.width}
            height={panel.frame.height}
            overflow="visible"
          >
            <text
              x={12}
              y={17}
              fontFamily={CHART_FONT_FAMILY}
              fontSize={13}
              fontWeight={600}
              fill={CHART_INK}
            >
              {panel.value}
            </text>
            <text
              x={panel.frame.width - 12}
              y={17}
              textAnchor="end"
              fontFamily={CHART_FONT_FAMILY}
              fontSize={11}
              fill={CHART_MUTED_INK}
            >
              {endValueOf(panel, spec)}
            </text>

            <g transform={`translate(0, ${FACET_PANEL_TITLE_HEIGHT})`}>
              {/* The rest of the chart, faint, so this panel is read against it. */}
              <g aria-hidden="true">
                {layout.panels.map((other, otherIndex) =>
                  otherIndex === index
                    ? null
                    : other.geometry.series.map(series =>
                        series.linePath ? (
                          <path
                            key={`${other.value}-${series.key}`}
                            d={series.linePath}
                            fill="none"
                            stroke={CONTEXT_INK}
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : null,
                      ),
                )}
              </g>
              <ChartCanvas
                geometry={panel.geometry}
                bare={layout.compact}
                spec={panelSpec}
                interactionMode="read"
                resetToken={0}
                onAddAnnotation={onAddAnnotation}
              />
            </g>
          </svg>
        ))}
      </svg>
    )
  },
)

function endValueOf(panel: FacetLayout['panels'][number], spec: ChartSpec): string {
  const series = panel.geometry.series[0]
  const points = series?.points ?? []
  const last = points[points.length - 1]
  if (!last) return ''
  return formatChartNumber(last.value, spec.chart.axes.y.format)
}
