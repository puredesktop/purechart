export interface SampleDataset {
  id: string
  label: string
  description: string
  csv: string
}

export const SAMPLE_DATASETS: readonly SampleDataset[] = [
  {
    id: 'regional-rainfall',
    label: 'Regional rainfall',
    description: 'Monthly time series across three regions',
    csv: [
      'month,region,rainfall_mm',
      '2026-01,North,92',
      '2026-02,North,84',
      '2026-03,North,108',
      '2026-04,North,126',
      '2026-05,North,141',
      '2026-06,North,158',
      '2026-01,Central,68',
      '2026-02,Central,61',
      '2026-03,Central,74',
      '2026-04,Central,89',
      '2026-05,Central,96',
      '2026-06,Central,112',
      '2026-01,South,115',
      '2026-02,South,109',
      '2026-03,South,122',
      '2026-04,South,134',
      '2026-05,South,148',
      '2026-06,South,164',
    ].join('\n'),
  },
  {
    id: 'renewable-share',
    label: 'Renewable energy',
    description: 'Category comparison by country',
    csv: [
      'country,renewable_pct',
      'Iceland,99',
      'Norway,98',
      'New Zealand,87',
      'Brazil,85',
      'Canada,68',
      'Sweden,66',
      'Denmark,64',
    ].join('\n'),
  },
  {
    id: 'city-mobility',
    label: 'City transit & emissions',
    description: 'Three numeric measures for scatter or bubble',
    csv: [
      'city,transit_share,co2_per_capita,population_m',
      'Zurich,63,3.8,1.4',
      'Tokyo,57,4.9,14.0',
      'Vienna,54,4.4,2.0',
      'Amsterdam,49,5.1,1.2',
      'Toronto,34,8.6,6.4',
      'Austin,14,13.2,2.4',
      'Phoenix,9,14.8,5.0',
    ].join('\n'),
  },
]
