import { describe, expect, it } from 'vitest'
import { applyForm, suggestForms } from './chartForms'
import { defaultSpec } from './chartSpec'
import { parseTable } from './dataParse'

const overTime = parseTable(
  [
    'month,region,nominations',
    ...[
      ['Aotearoa', [18, 24, 31]],
      ['Australia', [12, 15, 14]],
      ['Pacific', [4, 6, 9]],
    ].flatMap(([region, values]) =>
      (values as number[]).map(
        (value, index) => `2026-0${index + 1},${region as string},${value}`,
      ),
    ),
  ].join('\n'),
)

describe('a date column, a measure and a few categories', () => {
  const forms = suggestForms(overTime)

  it('leads with change over time, split by the category', () => {
    const first = forms[0]!
    expect(first.type).toBe('line')
    expect(first.job).toBe('How each region moved')
    expect(first.encodings).toEqual({
      x: 'month',
      y: ['nominations'],
      series: 'region',
    })
  })

  it('names the job, not the geometry', () => {
    expect(forms.map(form => form.job)).toContain('Which region is biggest')
    expect(forms.every(form => form.job !== 'Bar chart')).toBe(true)
  })

  it('says why each form suits the table', () => {
    expect(forms[0]!.because).toContain('region has 3 values')
  })

  it('warns that a stack has to actually sum to the whole', () => {
    const stack = forms.find(form => form.type === 'stacked-bar')!
    expect(stack.because).toContain('sum to the whole')
  })
})

describe('forms the table cannot support', () => {
  const forms = suggestForms(overTime)

  it('still offers them, with the reason', () => {
    const scatter = forms.find(form => form.type === 'scatter')!
    expect(scatter.supported).toBe(false)
    expect(scatter.because).toContain('only one numeric column'.replace('only', 'Only'))
  })

  it('sorts everything unsupported below everything supported', () => {
    const firstUnsupported = forms.findIndex(form => !form.supported)
    expect(forms.slice(firstUnsupported).every(form => !form.supported)).toBe(true)
  })

  it('will not offer a histogram of a dozen rows', () => {
    const small = parseTable('month,count\n2026-01,4\n2026-02,9')
    const histogram = suggestForms(small).find(form => form.type === 'histogram')!
    expect(histogram.supported).toBe(false)
    expect(histogram.because).toContain('reading noise')
  })
})

describe('many categories', () => {
  it('promotes a panel each above the crowded single plot', () => {
    const many = parseTable(
      [
        'month,category,entries',
        ...['Essays', 'Fiction', 'Poetry', 'Reportage', 'Zines'].flatMap(
          (category, index) => [
            `2026-01,${category},${10 + index}`,
            `2026-02,${category},${18 + index}`,
          ],
        ),
      ].join('\n'),
    )
    const forms = suggestForms(many)
    const facet = forms.findIndex(form => form.facet === 'category')
    const bars = forms.findIndex(form => form.type === 'bar')
    expect(facet).toBeLessThan(bars)
  })
})

describe('choosing a candidate', () => {
  it('sets the type, the encodings and the facet, and nothing else', () => {
    const spec = defaultSpec('Mine')
    spec.chart.style.grid = true
    const next = applyForm(spec, suggestForms(overTime)[0]!)
    expect(next.chart.type).toBe('line')
    expect(next.chart.encodings.series).toBe('region')
    expect(next.chart.style.grid).toBe(true)
    expect(next.title).toBe('Mine')
  })
})

describe('an empty table', () => {
  it('suggests nothing rather than guessing', () => {
    expect(suggestForms(parseTable(''))).toEqual([])
  })
})

describe('a year column, which arrives as a number', () => {
  const byYear = parseTable(
    'year,north,south\n2018,12,8\n2019,15,11\n2020,9,14\n2021,18,16\n2022,21,15\n2023,24,19',
  )

  it('is read as an axis to follow, not as a measure', () => {
    const first = suggestForms(byYear)[0]!
    expect(first.type).toBe('line')
    expect(first.encodings.x).toBe('year')
    expect(first.encodings.y).not.toContain('year')
  })

  it('still offers the two measures against each other', () => {
    const scatter = suggestForms(byYear).find(form => form.type === 'scatter')!
    expect(scatter.supported).toBe(true)
    expect([scatter.encodings.x, scatter.encodings.y[0]]).toEqual([
      'north',
      'south',
    ])
  })
})

it('does not misclassify increasing measurements as a time axis', () => {
  const table = parseTable('region,value\nNorth,10\nNorth,30\nSouth,60')
  const form = suggestForms(table).find(form => form.supported)
  expect(form?.type).toBe('bar')
  expect(form?.encodings).toMatchObject({ x: 'region', y: ['value'] })
})
