import { describe, expect, it } from 'vitest'
import { chartDescription, chartFindings } from './chartFindings'
import { defaultSpec, type ChartSpec } from './chartSpec'
import { parseTable } from './dataParse'

/** Nine months, three regions — the numbers the canvas was drawn from. */
const nominations = [
  'month,region,nominations',
  ...[
    ['Aotearoa', [18, 24, 31, 29, 44, 52, 61, 58, 73]],
    ['Australia', [12, 15, 14, 22, 26, 25, 33, 41, 44]],
    ['Pacific', [4, 6, 9, 8, 11, 17, 15, 22, 28]],
  ].flatMap(([region, values]) =>
    (values as number[]).map(
      (value, index) =>
        `2026-${String(index + 1).padStart(2, '0')},${region as string},${value}`,
    ),
  ),
].join('\n')

function spec(): ChartSpec {
  const value = defaultSpec('Nominations by region, 2026')
  value.chart.encodings = { x: 'month', y: ['nominations'], series: 'region' }
  return value
}

const table = parseTable(nominations)
const findings = chartFindings(table, spec())
const find = (id: string) => findings.find(finding => finding.id === id)

describe('what the chart says', () => {
  it('names the steepest riser over the whole chart, never a chosen window', () => {
    const found = find('biggest-move')!
    expect(found.series).toBe('Pacific')
    // 4 to 28 across the nine months, not 9 to 28 from March — picking the
    // flattering window is exactly what this must not do.
    expect(found.text).toContain('4')
    expect(found.text).toContain('28')
    expect(found.text).toContain('steepest rise of the 3')
  })

  it('says "trebled" only where the multiple is exactly that', () => {
    const trebling = defaultSpec('Trebling')
    trebling.chart.encodings = { x: 'month', y: ['count'], series: null }
    const found = chartFindings(
      parseTable('month,count\n2026-01,9\n2026-02,18\n2026-03,28'),
      trebling,
    ).find(finding => finding.id === 'biggest-move')!
    expect(found.text).toContain('trebled')
  })

  it('shows the arithmetic behind the claim', () => {
    expect(find('biggest-move')!.working).toContain('×')
  })

  it('stays quiet about the sharpest step when two steps tie', () => {
    // Aotearoa gains 15 twice, in May and again in September. Neither is "the"
    // largest jump, so neither is claimed.
    expect(find('largest-jump')).toBeUndefined()
  })

  it('names the sharpest step when one stands clear', () => {
    const jumpy = defaultSpec('Jumpy')
    jumpy.chart.encodings = { x: 'month', y: ['count'], series: null }
    const found = chartFindings(
      parseTable('month,count\n2026-01,10\n2026-02,12\n2026-03,25\n2026-04,28'),
      jumpy,
    ).find(finding => finding.id === 'largest-jump')!
    expect(found.text).toContain('up 13')
    expect(found.working).toContain('next largest 3')
  })

  it('reports that the three never change places', () => {
    expect(find('no-crossing')!.text).toContain('never change places')
  })

  it('reports that all three end higher, with the totals', () => {
    const found = find('all-up')!
    expect(found.text).toContain('All 3')
    expect(found.working).toContain('34')
    expect(found.working).toContain('145')
  })
})

describe('the exceptions', () => {
  it('counts every step that goes down, and names the largest of them', () => {
    const found = find('falls')!
    // Aotearoa dips in April and August, Australia in March and June, Pacific
    // in April and July: six of the twenty-four steps.
    expect(found.text).toContain('6 of the 24 steps go down')
    expect(found.text).toContain('Aotearoa')
    expect(found.working).toContain('down 3')
  })

  it('says plainly when nothing ever goes down', () => {
    const rising = [
      'month,count',
      '2026-01,4',
      '2026-02,9',
      '2026-03,12',
      '2026-04,20',
      '2026-05,26',
    ].join('\n')
    const onlyUp = defaultSpec('Rising')
    onlyUp.chart.encodings = { x: 'month', y: ['count'], series: null }
    const found = chartFindings(parseTable(rising), onlyUp).find(
      finding => finding.id === 'never-falls',
    )
    expect(found?.text).toContain('ever goes down')
  })
})

describe('the chart said aloud', () => {
  const said = chartDescription(table, spec())

  it('opens with the form and the title', () => {
    expect(said.startsWith('Line chart. Nominations by region, 2026.')).toBe(true)
  })

  it('gives every series its own start and end', () => {
    expect(said).toContain('Aotearoa, 18 rising to 73.')
    expect(said).toContain('Australia, 12 rising to 44.')
    expect(said).toContain('Pacific, 4 rising to 28.')
  })

  it('promises the table, because the table is shipped with it', () => {
    expect(said.endsWith('Table follows.')).toBe(true)
  })

  it('reads out the notes on the chart', () => {
    const noted = spec()
    noted.chart.annotations = [
      {
        id: 'n1',
        text: 'Samoan-language call opened',
        target: { kind: 'point', seriesKey: 'Pacific', xLabel: '2026-06', value: 17 },
        createdAt: '2026-09-22T00:00:00Z',
      },
    ]
    expect(chartDescription(table, noted)).toContain('Samoan-language call opened')
  })
})

describe('a chart with nothing in it', () => {
  it('has nothing to say and does not pretend otherwise', () => {
    expect(chartFindings(parseTable(''), defaultSpec())).toEqual([])
    expect(chartDescription(parseTable(''), defaultSpec())).toBe('No data yet.')
  })
})

describe('how a date is quoted', () => {
  it('says the month when the day never varies', () => {
    const monthly = defaultSpec('Monthly')
    monthly.chart.encodings = { x: 'month', y: ['count'], series: null, limitSeries: 0 }
    const found = chartFindings(
      parseTable('month,count\n2026-01,4\n2026-02,9\n2026-03,12'),
      monthly,
    ).find(finding => finding.id === 'biggest-move')!
    expect(found.text).toContain('2026-01')
    expect(found.text).not.toContain('2026-01-01')
  })

  it('keeps the day when it carries information', () => {
    const daily = defaultSpec('Daily')
    daily.chart.encodings = { x: 'day', y: ['count'], series: null, limitSeries: 0 }
    const found = chartFindings(
      parseTable('day,count\n2026-01-03,4\n2026-01-04,9\n2026-01-05,12'),
      daily,
    ).find(finding => finding.id === 'biggest-move')!
    expect(found.text).toContain('2026-01-03')
  })
})
