import { describe, expect, it } from 'vitest'
import {
  assetExportPathForChart,
  chartPackageContentPath,
  chartTitleFromPath,
  dataFormatFromPath,
  isChartDocumentPath,
  isChartPackagePath,
} from './chartPaths'

describe('chartPaths', () => {
  it('detects legacy chart documents by the .chart.json suffix', () => {
    expect(isChartDocumentPath('/tmp/sales.chart.json')).toBe(true)
    expect(isChartDocumentPath('/tmp/sales.csv')).toBe(false)
    expect(isChartDocumentPath('/tmp/data.json')).toBe(false)
  })

  it('detects .chart package folders and their content file', () => {
    expect(isChartPackagePath('/tmp/sales.chart')).toBe(true)
    expect(isChartPackagePath('/tmp/sales.chart/')).toBe(true)
    expect(isChartPackagePath('/tmp/sales.chart.json')).toBe(false)
    expect(isChartPackagePath('/tmp/sales.csv')).toBe(false)
    expect(chartPackageContentPath('/tmp/sales.chart')).toBe(
      '/tmp/sales.chart/chart.json',
    )
    expect(chartPackageContentPath('/tmp/sales.chart/')).toBe(
      '/tmp/sales.chart/chart.json',
    )
  })

  it('derives a clean title from a package folder name', () => {
    expect(chartTitleFromPath('/tmp/2024 sales.chart')).toBe('2024 sales')
  })

  it('exports into the package assets dir for a .chart package', () => {
    expect(
      assetExportPathForChart('/tmp/2024 sales.chart', 'Revenue', 'svg'),
    ).toEqual({
      collectionPath: '/tmp/2024 sales.chart',
      relativePath: 'assets/figures/revenue.svg',
      absolutePath: '/tmp/2024 sales.chart/assets/figures/revenue.svg',
    })
  })

  it('detects data format from extension', () => {
    expect(dataFormatFromPath('/tmp/a.csv')).toBe('csv')
    expect(dataFormatFromPath('/tmp/a.TSV')).toBe('tsv')
    expect(dataFormatFromPath('/tmp/a.json')).toBe('json')
    expect(dataFormatFromPath('/tmp/a.png')).toBeNull()
  })

  it('derives a clean title, dropping the multi-part extension', () => {
    expect(chartTitleFromPath('/tmp/2024 sales.chart.json')).toBe('2024 sales')
    expect(chartTitleFromPath('/tmp/revenue.csv')).toBe('revenue')
  })

  it('builds asset-library export paths for cross-app chart reuse', () => {
    expect(
      assetExportPathForChart(
        '/tmp/study.manuscript/Figure 1.chart.json',
        'Growth rate by cohort',
        'svg',
      ),
    ).toEqual({
      collectionPath: '/tmp/study.manuscript',
      relativePath: 'assets/figures/growth-rate-by-cohort.svg',
      absolutePath:
        '/tmp/study.manuscript/assets/figures/growth-rate-by-cohort.svg',
    })
  })
})
