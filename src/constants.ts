/** Must match `plugin.json` `app.slug`. */
export const CHART_APP_SLUG = 'chart'

/** Canonical chart document: a `.chart` package folder (created for new
 * charts). Holds a manifest and the spec content file. */
export const CHART_PACKAGE_SUFFIX = '.chart'

/** The chart spec file inside a `.chart` package. */
export const CHART_PACKAGE_CONTENT_FILE = 'chart.json'

/** Legacy single-file chart format — still opened, never created anew. */
export const CHART_FILE_SUFFIX = '.chart.json'

/** Debounced autosave delay for the chart spec (matches PureWriter cadence). */
export const AUTOSAVE_DELAY_MS = 600
