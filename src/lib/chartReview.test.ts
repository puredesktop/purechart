import { describe, expect, it } from 'vitest'
import {
  applyChartFix,
  facetCandidates,
  fixFor,
  reviewChart,
} from './chartReview'
import { defaultSpec, type ChartSpec, type ChartType } from './chartSpec'
import { parseTable } from './dataParse'

const nominations = [
  'month,region,nominations',
  '2026-01,Aotearoa,18',
  '2026-02,Aotearoa,24',
  '2026-03,Aotearoa,31',
  '2026-01,Australia,12',
  '2026-02,Australia,15',
  '2026-03,Australia,14',
  '2026-01,Pacific,4',
  '2026-02,Pacific,6',
  '2026-03,Pacific,9',
].join('\n')

/** Eight categories, so a seven-colour palette has to start over. */
const manyCategories = [
  'month,category,entries',
  ...['Essays', 'Fiction', 'Poetry', 'Reportage', 'Zines', 'Comics', 'Audio', 'Film']
    .flatMap((category, index) => [
      `2026-01,${category},${10 + index}`,
      `2026-02,${category},${14 + index}`,
      `2026-03,${category},${19 + index}`,
    ]),
].join('\n')

function specFor(
  type: ChartType,
  encodings: { x: string | null; y: string[]; series: string | null },
  style: Partial<ChartSpec['chart']['style']> = {},
): ChartSpec {
  const spec = defaultSpec('Test')
  spec.chart.type = type
  spec.chart.encodings = encodings
  spec.chart.style = { ...spec.chart.style, ...style }
  return spec
}

describe('a chart with nothing wrong', () => {
  const table = parseTable(nominations)
  const review = reviewChart(
    table,
    specFor('line', { x: 'month', y: ['nominations'], series: 'region' }),
  )

  it('finds nothing to report', () => {
    expect(review.findings.filter(f => f.severity === 'blocking')).toHaveLength(0)
  })

  it('says what it checked and cleared', () => {
    expect(review.cleared).toContain('Every series has a colour of its own')
    expect(review.cleared.length).toBeGreaterThan(2)
  })

  it('shows its working on colour', () => {
    expect(review.colour.scope).toBe('adjacent')
    expect(review.colour.worstNormal).toBeGreaterThan(15)
  })
})

describe('more series than the palette can name', () => {
  const table = parseTable(manyCategories)
  const review = reviewChart(
    table,
    specFor(
      'line',
      { x: 'month', y: ['entries'], series: 'category' },
      { palette: 'quiet' },
    ),
  )

  it('names the ones left without a colour, and calls it blocking', () => {
    const found = review.findings.find(f => f.id === 'colour-overflow')
    expect(found?.severity).toBe('blocking')
    // Quiet holds six; the table has eight categories.
    expect(found?.about?.split(', ')).toHaveLength(2)
  })

  it('offers a panel each, and folding the tail into Other', () => {
    const found = review.findings.find(f => f.id === 'colour-overflow')!
    expect(found.fixes.some(fix => fix.kind === 'facet')).toBe(true)
    expect(found.fixes.some(fix => fix.kind === 'keep-series')).toBe(true)
  })

  it('never hands two series the same hue instead', () => {
    const review2 = reviewChart(
      table,
      specFor('line', { x: 'month', y: ['entries'], series: 'category' }),
    )
    expect(review2.findings.find(f => f.id === 'colour-indistinct')).toBeUndefined()
  })
})

describe('the mono palette', () => {
  const table = parseTable(nominations)

  it('is blocked when nothing but lightness names the series', () => {
    const review = reviewChart(
      table,
      specFor(
        'line',
        { x: 'month', y: ['nominations'], series: 'region' },
        { palette: 'mono', directLabels: false },
      ),
    )
    expect(review.findings.find(f => f.id === 'mono-unlabelled')?.severity).toBe(
      'blocking',
    )
  })

  it('is fine once the series are labelled on the chart', () => {
    const review = reviewChart(
      table,
      specFor(
        'line',
        { x: 'month', y: ['nominations'], series: 'region' },
        { palette: 'mono', directLabels: true },
      ),
    )
    expect(review.findings.find(f => f.id === 'mono-unlabelled')).toBeUndefined()
    expect(review.cleared).toContain('Mono is carried by the labels, as it has to be')
  })

  it('is not also told its greys look alike — that is the point of it', () => {
    const review = reviewChart(
      table,
      specFor(
        'line',
        { x: 'month', y: ['nominations'], series: 'region' },
        { palette: 'mono', directLabels: true },
      ),
    )
    expect(review.findings.find(f => f.id === 'colour-indistinct')).toBeUndefined()
  })
})

describe('a scatter with more series than a scatter can carry', () => {
  const table = parseTable(manyCategories)
  const review = reviewChart(
    table,
    specFor('scatter', { x: 'month', y: ['entries'], series: 'category' }),
  )

  it('checks every pair, not just neighbours', () => {
    expect(review.colour.scope).toBe('all')
  })

  it('says so, and says what to do instead', () => {
    const found = review.findings.find(f => f.id === 'too-many-for-form')
    expect(found).toBeDefined()
    expect(found!.fixes.some(fix => fix.kind === 'keep-series')).toBe(true)
  })
})

describe('pale colours', () => {
  const table = parseTable(nominations)

  it('are allowed when the series are labelled on the chart', () => {
    const review = reviewChart(
      table,
      specFor(
        'line',
        { x: 'month', y: ['nominations'], series: 'region' },
        { palette: 'custom-pale', customPalettes: [{ id: 'custom-pale', label: 'Pale', colors: ['#1baf7a', '#eda100', '#e87ba4'], custom: true }], directLabels: true },
      ),
    )
    expect(review.findings.find(f => f.id === 'colour-pale')).toBeUndefined()
  })

  it('are reported when nothing else names the series', () => {
    const review = reviewChart(
      table,
      specFor(
        'line',
        { x: 'month', y: ['nominations'], series: 'region' },
        { palette: 'custom-pale', customPalettes: [{ id: 'custom-pale', label: 'Pale', colors: ['#1baf7a', '#eda100', '#e87ba4'], custom: true }], directLabels: false },
      ),
    )
    const found = review.findings.find(f => f.id === 'colour-pale')
    expect(found?.severity).toBe('check')
    expect(found?.detail).toMatch(/:1/)
  })
})

describe('what a chart could be split by', () => {
  it('offers the categorical columns that are not already the x axis', () => {
    const table = parseTable(nominations)
    const spec = specFor('line', { x: 'month', y: ['nominations'], series: 'region' })
    expect(facetCandidates(table, spec)).toEqual(['region'])
  })
})

describe('an empty chart', () => {
  it('is not criticised for having nothing in it', () => {
    const review = reviewChart(parseTable(''), defaultSpec())
    expect(review.findings).toHaveLength(0)
    expect(review.cleared).toHaveLength(0)
  })
})

describe('carrying out a fix', () => {
  const table = parseTable(manyCategories)
  const spec = specFor(
    'line',
    { x: 'month', y: ['entries'], series: 'category' },
    { palette: 'quiet' },
  )

  it('folds the tail into Other, keeping as many as the palette holds', () => {
    const review = reviewChart(table, spec)
    const fix = fixFor(review, 'colour-overflow', 1)!
    const fixed = applyChartFix(spec, fix)
    expect(fixed.chart.encodings.limitSeries).toBe(5)

    // And the chart that results has nothing left to report about colour.
    const after = reviewChart(table, fixed)
    expect(after.findings.find(f => f.id === 'colour-overflow')).toBeUndefined()
  })

  it('splits into panels when that is the fix taken', () => {
    const review = reviewChart(table, spec)
    const fixed = applyChartFix(spec, fixFor(review, 'colour-overflow', 0)!)
    expect(fixed.chart.facet.column).toBe('category')
  })

  it('leaves everything it was not asked to change', () => {
    const review = reviewChart(table, spec)
    const fixed = applyChartFix(spec, fixFor(review, 'colour-overflow', 1)!)
    expect(fixed.title).toBe(spec.title)
    expect(fixed.chart.type).toBe('line')
    expect(fixed.chart.style.palette).toBe('quiet')
  })

  it('turns labels on when that is what the relief rule needs', () => {
    const pale = specFor(
      'line',
      { x: 'month', y: ['nominations'], series: 'region' },
      {
        palette: 'custom-pale',
        customPalettes: [
          { id: 'custom-pale', label: 'Pale', colors: ['#1baf7a', '#eda100', '#e87ba4'], custom: true },
        ],
        directLabels: false,
      },
    )
    const review = reviewChart(parseTable(nominations), pale)
    const fixed = applyChartFix(pale, fixFor(review, 'colour-pale', 0)!)
    expect(fixed.chart.style.directLabels).toBe(true)
  })
})
