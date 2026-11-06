import { forwardRef, useState } from 'react'
import type { RadialGeometry } from '../lib/chartLayout'
import { formatChartNumber } from '../lib/chartPresentation'
import type { ChartSpec } from '../lib/chartSpec'
import {
  CHART_AXIS_FONT_SIZE,
  CHART_FONT_FAMILY,
  CHART_INK,
  CHART_MUTED_INK,
} from '../lib/chartTheme'
import { CHART_TRANSIENT_ATTR } from '../lib/chartExport'

const TRANSIENT = { [CHART_TRANSIENT_ATTR]: '' } as const
const KEY_ROW = 22

interface RadialFigureProps {
  radial: RadialGeometry
  spec: ChartSpec
  width: number
  height: number
  bare?: boolean
}

function percent(share: number): string {
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`
}

/**
 * Pie and donut.
 *
 * The key beside the drawing is a small table: name, amount, share, read
 * across one baseline. It names every slice in words, so nothing is told by
 * colour alone, and it carries the numbers a reader would otherwise have to
 * estimate from angles, which people judge badly.
 */
export const RadialFigure = forwardRef<SVGSVGElement, RadialFigureProps>(
  function RadialFigure({ radial, spec, width, height, bare = false }, ref) {
    const [hover, setHover] = useState<string | null>(null)
    const format = spec.chart.axes.y.format
    const unit = spec.chart.axes.y.unit
    const amount = (value: number) => `${formatChartNumber(value, format === 'plain' ? 'grouped' : format)}${unit ? ` ${unit}` : ''}`
    const { cx, cy, outer, inner, slices, key } = radial
    const active = slices.find(slice => slice.key === hover) ?? null
    const valueX = key ? key.x + 18 + key.nameWidth + 16 + 84 : 0
    const shareX = valueX + 16 + 48

    return (
      <svg
        ref={ref}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={spec.title}
        tabIndex={0}
        onKeyDown={event => { if (event.key === 'Escape') setHover(null) }}
        style={{ fontFamily: CHART_FONT_FAMILY, display: 'block', outline: 'none' }}
      >
        {!bare && (
          <text x={64} y={24} fontSize={18} fontWeight={700} fill={CHART_INK}>
            {spec.title}
          </text>
        )}

        <g aria-label={spec.chart.type === 'donut' ? 'Donut' : 'Pie'} onMouseLeave={() => setHover(null)}>
          {slices.map(slice => (
            <path
              key={slice.key}
              d={slice.path}
              transform={`translate(${cx}, ${cy})`}
              fill={slice.color}
              // A surface-coloured edge keeps neighbouring slices apart.
              stroke="#ffffff"
              strokeWidth={slices.length > 1 ? 2 : 0}
              strokeLinejoin="round"
              opacity={active && active.key !== slice.key ? 0.35 : 1}
              onMouseEnter={() => setHover(slice.key)}
              data-slice={slice.key}
            >
              <title>{`${slice.key}: ${amount(slice.value)} (${percent(slice.share)})`}</title>
            </path>
          ))}
        </g>

        {!bare && slices.filter(slice => slice.showLabel).map(slice => (
          <text
            key={`share-${slice.key}`}
            x={slice.labelX}
            y={slice.labelY}
            fontSize={CHART_AXIS_FONT_SIZE}
            fontWeight={600}
            textAnchor={slice.labelAnchor}
            fill={CHART_MUTED_INK}
          >
            {percent(slice.share)}
          </text>
        ))}

        {!bare && inner > 0 && (
          <g aria-label="Total">
            <text x={cx} y={cy + 2} fontSize={Math.max(14, Math.min(26, inner / 2.6))} fontWeight={700} textAnchor="middle" fill={CHART_INK}>
              {amount(active ? active.value : radial.total)}
            </text>
            <text x={cx} y={cy + 22} fontSize={CHART_AXIS_FONT_SIZE} textAnchor="middle" fill={CHART_MUTED_INK}>
              {active ? active.key : 'Total'}
            </text>
          </g>
        )}

        {!bare && key && (
          <g aria-label="Key">
            {slices.map((slice, index) => {
              const y = key.y + index * KEY_ROW
              return (
                <g
                  key={`key-${slice.key}`}
                  onMouseEnter={() => setHover(slice.key)}
                  onMouseLeave={() => setHover(null)}
                  opacity={active && active.key !== slice.key ? 0.45 : 1}
                >
                  <rect x={key.x} y={y - 10} width={10} height={10} rx={2} fill={slice.color} />
                  <text x={key.x + 18} y={y} fontSize={CHART_AXIS_FONT_SIZE} fill={CHART_INK}>
                    {slice.key.length * 7 > key.nameWidth ? `${slice.key.slice(0, Math.max(3, Math.floor(key.nameWidth / 7) - 1))}…` : slice.key}
                    <title>{slice.key}</title>
                  </text>
                  <text x={valueX} y={y} fontSize={CHART_AXIS_FONT_SIZE} textAnchor="end" fill={CHART_INK}>
                    {amount(slice.value)}
                  </text>
                  <text x={shareX} y={y} fontSize={CHART_AXIS_FONT_SIZE} textAnchor="end" fill={CHART_MUTED_INK}>
                    {percent(slice.share)}
                  </text>
                </g>
              )
            })}
            {radial.folded > 0 && (
              <text x={key.x} y={key.y + slices.length * KEY_ROW + 4} fontSize={11} fill={CHART_MUTED_INK}>
                {`Other sums the ${radial.folded} smallest.`}
              </text>
            )}
          </g>
        )}

        {!bare && active && inner === 0 && (
          <g {...TRANSIENT} pointerEvents="none">
            <rect x={12} y={height - 40} width={Math.min(width - 24, 320)} height={28} rx={3} fill="#ffffff" stroke="#dfe2e7" />
            <text x={22} y={height - 21} fontSize={CHART_AXIS_FONT_SIZE} fill={CHART_INK}>
              {`${active.key}: ${amount(active.value)}, ${percent(active.share)} of the total`}
            </text>
          </g>
        )}
      </svg>
    )
  },
)
