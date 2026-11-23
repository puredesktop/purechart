import type {
  AppOperationExposure,
  AppOperationRisk,
} from '@purescience/platform-ui/bridge/appFunctions'

export interface AtomicToolSchemaSpec {
  name: string
  exposure: AppOperationExposure
  category: string
  risk: AppOperationRisk
  requiresApproval: boolean
  releaseButton?: string
  deletesPermanently?: boolean
  riskWhen?: Record<string, 'write' | 'destructive' | 'external' | 'release'>
  requiresCapabilities?: Array<'vision'>
  description: string
  inputSchema: Record<string, unknown> & { type: 'object' }
}

/**
 * All 31 atomic PureChart tools with 3-tier exposure metadata:
 *   - "always" (7, ~23%): core read/create/open/propose/save/export verbs exposed directly in plugin.json
 *   - "extended" (24, ~77%): specialist spec, styling, sheet, annotation, and delete tools discoverable via
 *     discoverAppTools and callable via callExtendedReadTool / callExtendedTool with zero loss of functionality.
 */
export const PURECHART_ATOMIC_TOOL_SCHEMAS: readonly AtomicToolSchemaSpec[] = [
  {
    name: 'getChartContext',
    exposure: 'always',
    category: 'chart',
    risk: 'read',
    requiresApproval: false,
    description:
      'Call this first. Returns the current chart tab context: document path (a .chart package, a legacy .chart.json file, or null while unsaved), title, type, encodings, style, annotation count, and a data summary (columns with types, row count). Column names must be used exactly as returned here.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getChartData',
    exposure: 'always',
    category: 'data',
    risk: 'read',
    requiresApproval: false,
    description:
      'Return the current chart data columns (with inferred types) and the first rows, capped at 500. Call before choosing encodings or making data-dependent recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum rows to return, capped at 500.',
        },
      },
    },
  },
  {
    name: 'openChart',
    exposure: 'always',
    category: 'document',
    risk: 'read',
    requiresApproval: false,
    description:
      'Call getChartContext first to check the current chart tab before replacing it. Open a chart document (.chart package folder or legacy .chart.json file) or a CSV/TSV/JSON data file by absolute path in the current tab. Fails with a message when the path cannot be read.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'createChart',
    exposure: 'always',
    category: 'document',
    risk: 'destructive',
    requiresApproval: false,
    description:
      'Create a new unsaved chart in the current tab, optionally seeded with CSV, TSV, or JSON table text; encodings are suggested from the data. This replaces whatever the tab holds — say so when the tab has work. The chart becomes a .chart package draft on its first change; saveChart names the path.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
        },
        dataText: {
          type: 'string',
          description:
            'CSV, TSV, or JSON table text to use as inline chart data.',
        },
        format: {
          type: 'string',
          enum: ['csv', 'tsv', 'json'],
        },
        type: {
          type: 'string',
          enum: [
            'line',
            'area',
            'bar',
            'grouped-bar',
            'stacked-bar',
            'scatter',
            'connected-scatter',
            'lollipop',
            'slopegraph',
            'histogram',
            'horizontal-bar',
            'pie',
            'donut',
            'bubble',
          ],
        },
      },
    },
  },
  {
    name: 'proposeChart',
    exposure: 'always',
    category: 'proposal',
    risk: 'write',
    requiresApproval: false,
    description:
      'Preview a coordinated chart edit without modifying the document. Provide a patch and explain data/design choices. The user reviews the preview and applies or discards it in PureChart. Returns changes, validation notes and computed findings. A later proposal replaces the pending preview. Use captionFindingIds from the proposed findings to generate a data-grounded caption; free-form wording is marked for review. Applying is one undoable edit. Source data cannot be changed by this tool.',
    inputSchema: {
      type: 'object',
      properties: {
        patch: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
            },
            type: {
              type: 'string',
              enum: [
                'line',
                'area',
                'bar',
                'grouped-bar',
                'stacked-bar',
                'scatter',
                'connected-scatter',
                'lollipop',
                'slopegraph',
                'histogram',
                'horizontal-bar',
                'pie',
                'donut',
                'bubble',
              ],
            },
            x: {
              type: ['string', 'null'],
            },
            y: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            series: {
              type: ['string', 'null'],
            },
            size: {
              type: ['string', 'null'],
            },
            limitSeries: {
              type: 'number',
            },
            style: {
              type: 'object',
              properties: {
                rangeFrame: {
                  type: 'boolean',
                },
                grid: {
                  type: 'boolean',
                },
                directLabels: {
                  type: 'boolean',
                },
                rug: {
                  type: 'boolean',
                },
                palette: {
                  type: 'string',
                },
                strokeWidth: {
                  type: 'number',
                },
                pointRadius: {
                  type: 'number',
                },
              },
            },
            axes: {
              type: 'object',
              description:
                'axes configuration matching getChartSpec. Omitted fields at the patch level remain unchanged.',
            },
            facet: {
              type: 'object',
              description:
                'facet configuration matching getChartSpec. Omitted fields at the patch level remain unchanged.',
            },
            transform: {
              type: 'object',
              description:
                'transform configuration matching getChartSpec. Omitted fields at the patch level remain unchanged.',
            },
            presentation: {
              type: 'object',
              description:
                'presentation configuration matching getChartSpec. Omitted fields at the patch level remain unchanged.',
            },
            caption: {
              type: 'string',
            },
            annotations: {
              type: 'array',
              items: {
                type: 'object',
              },
              description:
                'Complete replacement annotation list; targets must exist in proposed plotted data.',
            },
          },
          additionalProperties: false,
        },
        explanation: {
          type: 'string',
        },
        captionFindingIds: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
      required: ['patch', 'explanation'],
      additionalProperties: false,
    },
  },
  {
    name: 'saveChart',
    exposure: 'always',
    category: 'document',
    risk: 'write',
    requiresApproval: false,
    description:
      'Save the open chart, creating its .chart package draft in PureDrafts when it has never been saved, and return the path.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'exportChart',
    exposure: 'always',
    category: 'export',
    risk: 'write',
    requiresApproval: false,
    description:
      "Render the chart to SVG or PNG. Renders from the spec, so it works whether or not the chart is on screen. Without a destination the file lands in the chart document's own assets/figures folder (a never-saved chart gets its draft package first). With one, it lands in that folder instead — how a figure is placed into a deck, a report or a manuscript rather than left where only this chart can find it. Give width/height for the size the page needs, and scale for print. The result names the path.",
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['svg', 'png'],
          description: 'Defaults to svg.',
        },
        destination: {
          type: 'string',
          description:
            "Absolute folder (or document package) to write into. Defaults to this chart's own assets/figures.",
        },
        width: {
          type: 'number',
          description: 'Drawing width in px. Defaults to the size on screen.',
        },
        height: {
          type: 'number',
          description: 'Drawing height in px.',
        },
        scale: {
          type: 'number',
          description: 'PNG only. Pixels per unit: 3 for print. Defaults to 1.',
        },
        transparent: {
          type: 'boolean',
          description:
            'Leave the ground unpainted, for a figure on a coloured page.',
        },
        palette: {
          type: 'string',
          enum: ['source', 'monochrome'],
          description:
            'The chart’s own colours (default), or one ink for a print edition. The figure remembers which.',
        },
      },
    },
  },
  // --- Extended specialist tools (24) ---
  {
    name: 'getChartSpec',
    exposure: 'extended',
    category: 'chart',
    risk: 'read',
    requiresApproval: false,
    description:
      'Return the current PureChart spec with the inline data text elided (only its format and size are reported). Use getChartData for the rows.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'listCharts',
    exposure: 'extended',
    category: 'sheet',
    risk: 'read',
    requiresApproval: false,
    description:
      'Every chart on this sheet, with its id, name, form, encodings, caption and how many Second look findings it has. A document holds several readings of one table, so "the chart" is ambiguous until you know which — call this before acting on one, and pass the id. The data and the palette belong to the sheet; everything else belongs to a chart.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'suggestChartForms',
    exposure: 'extended',
    category: 'design',
    risk: 'read',
    requiresApproval: false,
    description:
      "Return the chart forms this table can honestly support, best first, each with the job it does ('How each region moved'), the encodings that make it work, and — for the ones it cannot support — the reason. Call this before setChartType: the table decides which forms are available, and a form it does not support will draw something misleading rather than fail. Apply one with chooseChartForm.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'reviewChart',
    exposure: 'extended',
    category: 'audit',
    risk: 'read',
    requiresApproval: false,
    description:
      'Measure the drawing and report what is wrong with it, located: pairs of series ordinary or colour-deficient vision cannot separate (OKLab distance under simulated protanopia and deuteranopia), colours too pale for the surface, series past what the palette can name, bars that do not start at zero, labels that collide. Call it after any change to type, encodings, palette or series count, and fix what it names with applyChartFix — you cannot tell by looking at the spec whether the colours work.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'describeChart',
    exposure: 'extended',
    category: 'audit',
    risk: 'read',
    requiresApproval: false,
    description:
      'What the chart says, as arithmetic over the drawn series — the steepest rise, how many steps go down, whether the order ever changes — each with the working behind it, plus the spoken description a screen reader is handed. Quote these for a caption instead of reading a trend off the shape of the lines; they cannot describe a chart other than the one drawn.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'setChartTitle',
    exposure: 'extended',
    category: 'spec',
    risk: 'write',
    requiresApproval: false,
    description:
      'Set the current chart title. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'setChartType',
    exposure: 'extended',
    category: 'spec',
    risk: 'write',
    requiresApproval: false,
    description:
      'Set the current chart type. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list. Pie and donut show one measure as shares of a whole (x names the slices; small slices past the palette fold into Other). horizontal-bar is a bar chart turned over so long category names read in full. bubble is a scatter whose area shows a third numeric column (encodings size); switching to bubble picks a size column when none is set.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'line',
            'area',
            'bar',
            'grouped-bar',
            'stacked-bar',
            'scatter',
            'connected-scatter',
            'lollipop',
            'slopegraph',
            'histogram',
            'horizontal-bar',
            'pie',
            'donut',
            'bubble',
          ],
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'setChartEncodings',
    exposure: 'extended',
    category: 'spec',
    risk: 'write',
    requiresApproval: false,
    description:
      'Set the x axis column, y measure columns, and/or the series grouping column. Any field left out is unchanged; pass null for x or series to clear it, and [] for y to clear the measures. Column names must exist in getChartData. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.',
    inputSchema: {
      type: 'object',
      properties: {
        x: {
          type: 'string',
          description:
            'Column for the x axis. Omit to keep the current one; null clears it.',
        },
        y: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Numeric columns to plot; each becomes a series. Omit to keep the current measures.',
        },
        series: {
          type: 'string',
          description:
            'Column whose values split the first y measure into series. Omit to keep the current setting; null clears it.',
        },
        size: {
          type: 'string',
          description:
            "Bubble charts: the numeric column each bubble's AREA shows. Omit to keep; null clears it.",
        },
        limitSeries: {
          type: 'number',
          description:
            'Keep only the largest N series and fold the rest into Other. 0 keeps all series.',
        },
      },
    },
  },
  {
    name: 'setChartPalette',
    exposure: 'extended',
    category: 'style',
    risk: 'write',
    requiresApproval: false,
    description:
      'Set the current chart color palette, or create and select a custom palette from hex colors. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.',
    inputSchema: {
      type: 'object',
      properties: {
        palette: {
          type: 'string',
          description:
            'Built-in palette id (quiet, science, meadow, ember, mono) or custom palette id.',
        },
        label: {
          type: 'string',
          description:
            'Label for a new custom palette when colors are provided.',
        },
        colors: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Custom #RRGGBB colors to create and select.',
        },
      },
    },
  },
  {
    name: 'setChartStyle',
    exposure: 'extended',
    category: 'style',
    risk: 'write',
    requiresApproval: false,
    description:
      'Set style options: rangeFrame (axes span only the data), grid (faint gridlines), directLabels (series labelled at line end), rug (marginal ticks at each point), strokeWidth (>0), pointRadius (>=0). Fields left out are unchanged. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.',
    inputSchema: {
      type: 'object',
      properties: {
        rangeFrame: {
          type: 'boolean',
        },
        grid: {
          type: 'boolean',
        },
        directLabels: {
          type: 'boolean',
        },
        rug: {
          type: 'boolean',
        },
        strokeWidth: {
          type: 'number',
        },
        pointRadius: {
          type: 'number',
        },
      },
    },
  },
  {
    name: 'updateChart',
    exposure: 'extended',
    category: 'spec',
    risk: 'write',
    requiresApproval: false,
    description:
      'Update several chart properties at once: title, type, encodings (x, y, series) and style. Fields left out are unchanged — sending only type never touches the encodings. For a single change prefer the focused set* tools. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
        },
        type: {
          type: 'string',
          enum: [
            'line',
            'area',
            'bar',
            'grouped-bar',
            'stacked-bar',
            'scatter',
            'connected-scatter',
            'lollipop',
            'slopegraph',
            'histogram',
            'horizontal-bar',
            'pie',
            'donut',
            'bubble',
          ],
        },
        x: {
          type: 'string',
        },
        y: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        series: {
          type: 'string',
        },
        style: {
          type: 'object',
          properties: {
            rangeFrame: {
              type: 'boolean',
            },
            grid: {
              type: 'boolean',
            },
            directLabels: {
              type: 'boolean',
            },
            rug: {
              type: 'boolean',
            },
            palette: {
              type: 'string',
            },
            strokeWidth: {
              type: 'number',
            },
            pointRadius: {
              type: 'number',
            },
          },
        },
        size: {
          type: 'string',
          description:
            "Bubble charts: the numeric column each bubble's area shows.",
        },
        limitSeries: {
          type: 'number',
          description:
            'Keep only the largest N series and fold the rest into Other. 0 keeps all series.',
        },
      },
    },
  },
  {
    name: 'chooseChartForm',
    exposure: 'extended',
    category: 'design',
    risk: 'write',
    requiresApproval: false,
    description:
      "Apply one of suggestChartForms' candidates by its index. It ADDS a chart to the sheet and focuses it, because a document holds several readings of one table and replacing the one in front of you throws away work nobody asked to lose; the new chart is named after the job it does. Pass replace: true to change the focused chart instead. Call suggestChartForms first — the indexes are its order. Refuses a form this table cannot support, and says why.",
    inputSchema: {
      type: 'object',
      properties: {
        form: {
          type: 'number',
          description: "The candidate's index in the suggestChartForms list.",
        },
        replace: {
          type: 'boolean',
          description:
            'Change the focused chart instead of adding one. Defaults to false.',
        },
      },
      required: ['form'],
    },
  },
  {
    name: 'applyChartFix',
    exposure: 'extended',
    category: 'audit',
    risk: 'write',
    requiresApproval: false,
    description:
      'Carry out one of the fixes reviewChart offered, then report what is left. Name the finding by its id and the fix by its index within that finding (default 0). This closes the loop: draw, review, fix, review.',
    inputSchema: {
      type: 'object',
      properties: {
        finding: {
          type: 'string',
          description: "The finding's id, exactly as reviewChart reported it.",
        },
        fix: {
          type: 'number',
          description:
            "Which of that finding's fixes, by index. Defaults to the first.",
        },
      },
      required: ['finding'],
    },
  },
  {
    name: 'facetChart',
    exposure: 'extended',
    category: 'layout',
    risk: 'write',
    requiresApproval: false,
    description:
      'Split the chart into one panel per value of a column, all on one shared y scale. This is the honest answer to more series than the palette can keep apart, and it gets clearer as the categories multiply. Pass no column to go back to one chart. Refuses a column with fewer than two values. Replies with the panel count and the first 24 facet values (valuesTruncated and moreValues say how many were left out).',
    inputSchema: {
      type: 'object',
      properties: {
        column: {
          type: 'string',
          description:
            'The categorical column to split by. Omit or pass an empty string to stop faceting.',
        },
        columns: {
          type: 'number',
          description: 'Panels per row. 0 lets the grid choose.',
        },
      },
    },
  },
  {
    name: 'setChartAxis',
    exposure: 'extended',
    category: 'axes',
    risk: 'write',
    requiresApproval: false,
    description:
      "Name an axis and say how its numbers read. An axis labelled with a bare column name carries that ambiguity into every document the figure is placed in — 'rating' is out of what? Fields left out are unchanged; pass an empty string to clear one.",
    inputSchema: {
      type: 'object',
      properties: {
        axis: {
          type: 'string',
          enum: ['x', 'y'],
          description: 'Which axis.',
        },
        name: {
          type: 'string',
          description:
            'What it is called. Empty string falls back to the column name.',
        },
        unit: {
          type: 'string',
          description: 'minutes, NZ$, % — shown once, not on every tick.',
        },
        format: {
          type: 'string',
          enum: ['plain', 'grouped', 'percent', 'compact'],
          description: 'grouped: 1,240. compact: 1.2k.',
        },
      },
      required: ['axis'],
    },
  },
  {
    name: 'setChartTrendline',
    exposure: 'extended',
    category: 'analysis',
    risk: 'write',
    requiresApproval: false,
    description:
      "Fit a trendline through each series of the current chart (the same edit as the Trendline control) and reply with each fit's equation and R², or why it could not be drawn. kind: linear (straight line), exponential (needs every value above zero), polynomial (degree 2 or 3), or none to remove it. Allowed on line, area, scatter, bubble, connected-scatter, bar, grouped-bar and lollipop charts. Categories are fitted by their position along the axis, dates by time. Quote the R² when you mention the trend: a line that explains little of the variation must not be described as a trend.",
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['none', 'linear', 'exponential', 'polynomial'],
        },
        degree: {
          type: 'number',
          enum: [2, 3],
          description: 'Polynomial degree; ignored for other kinds.',
        },
      },
      required: ['kind'],
    },
  },
  {
    name: 'setChartCaption',
    exposure: 'extended',
    category: 'caption',
    risk: 'write',
    requiresApproval: false,
    description:
      'Write the sentence under the chart. Call describeChart first and say what its findings say: the arithmetic is what makes a caption true, and you are what makes it worth reading and what can say WHY something happened, which no amount of arithmetic can. What you must not do is describe a shape the numbers do not have — the result returns the findings again so a wrong claim can be caught in the same turn it was made. An empty string clears it. The caption travels with the figure into every document that carries it.',
    inputSchema: {
      type: 'object',
      properties: {
        caption: {
          type: 'string',
          description: 'The sentence. Empty clears it.',
        },
      },
      required: ['caption'],
    },
  },
  {
    name: 'focusChart',
    exposure: 'extended',
    category: 'sheet',
    risk: 'write',
    requiresApproval: false,
    description:
      "Work on one of the sheet's charts, by the id listCharts reports. Pass nothing to step back to the sheet itself. Every other tool acts on the focused chart, so focus before editing.",
    inputSchema: {
      type: 'object',
      properties: {
        chart: {
          type: 'string',
          description: "The chart's id. Omit to show the whole sheet.",
        },
      },
    },
  },
  {
    name: 'duplicateChart',
    exposure: 'extended',
    category: 'sheet',
    risk: 'write',
    requiresApproval: false,
    description:
      'Copy a chart and put the copy beside it, then focus the copy. The honest way to try a variation: change one thing on the copy and both readings survive.',
    inputSchema: {
      type: 'object',
      properties: {
        chart: {
          type: 'string',
          description: "The chart's id, from listCharts.",
        },
      },
      required: ['chart'],
    },
  },
  {
    name: 'removeChart',
    exposure: 'extended',
    category: 'sheet',
    risk: 'destructive',
    requiresApproval: true,
    description:
      "Take a chart off the sheet. Only at the user's explicit direction — a chart they made is work, and the sheet is where it lives. The sheet always keeps at least one chart.",
    inputSchema: {
      type: 'object',
      properties: {
        chart: {
          type: 'string',
          description: "The chart's id, from listCharts.",
        },
      },
      required: ['chart'],
    },
  },
  {
    name: 'replaceChartData',
    exposure: 'extended',
    category: 'data',
    risk: 'destructive',
    requiresApproval: false,
    description:
      "Replace the current chart's inline data with CSV, TSV, or JSON table text, keeping the spec (title, type, style, annotations). Encodings are re-suggested when resetChart is true, the current x column is unset, or any referenced encoding column disappears from the new data.",
    inputSchema: {
      type: 'object',
      properties: {
        dataText: {
          type: 'string',
        },
        format: {
          type: 'string',
          enum: ['csv', 'tsv', 'json'],
        },
        resetChart: {
          type: 'boolean',
          description: 'When true, re-suggest encodings from the new data.',
        },
      },
      required: ['dataText'],
    },
  },
  {
    name: 'addChartAnnotation',
    exposure: 'extended',
    category: 'annotations',
    risk: 'write',
    requiresApproval: false,
    description:
      "Append a saved annotation to the chart. A point annotation calls out one data point: { text, target: { kind: 'point', seriesKey, xLabel, value } } where seriesKey is the y column name (or the series value when a series column is set), xLabel is the x value as text exactly as getChartData shows it, and value is the y value. A range annotation shades a span: { text, target: { kind: 'range', x: { from, to }, y: { from, to }, summary: { count, min, max, average, change } } } with x.from/x.to as x labels and y in data units — read getChartData to compute the summary yourself. Both forms are stored as data, so they land on the same points at any size. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.",
    inputSchema: {
      type: 'object',
      properties: {
        annotation: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The label drawn beside the point.',
            },
            target: {
              type: 'object',
              properties: {
                kind: {
                  type: 'string',
                  enum: ['point', 'range'],
                },
                seriesKey: {
                  type: 'string',
                  description: 'point: the series name.',
                },
                xLabel: {
                  type: 'string',
                  description:
                    'point: the x label exactly as getChartData shows it.',
                },
                value: {
                  type: 'number',
                  description: 'point: the y value.',
                },
                x: {
                  type: 'object',
                  description:
                    'range: x labels of the first and last point in the span.',
                  properties: {
                    from: {
                      type: 'string',
                    },
                    to: {
                      type: 'string',
                    },
                  },
                  required: ['from', 'to'],
                },
                y: {
                  type: 'object',
                  description: 'range: y extent in data units.',
                  properties: {
                    from: {
                      type: 'number',
                    },
                    to: {
                      type: 'number',
                    },
                  },
                  required: ['from', 'to'],
                },
                summary: {
                  type: 'object',
                  description: 'range: figures for the points in the span.',
                  properties: {
                    count: {
                      type: 'number',
                    },
                    min: {
                      type: 'number',
                    },
                    max: {
                      type: 'number',
                    },
                    average: {
                      type: 'number',
                    },
                    change: {
                      type: 'number',
                    },
                  },
                  required: ['count', 'min', 'max', 'average', 'change'],
                },
              },
              required: ['kind'],
            },
          },
          required: ['text', 'target'],
        },
      },
      required: ['annotation'],
    },
  },
  {
    name: 'clearChartAnnotations',
    exposure: 'extended',
    category: 'annotations',
    risk: 'destructive',
    requiresApproval: false,
    description:
      'Remove all annotations from the current chart. Replies with a compact summary of the chart after the edit (title, type, encodings, style, annotation count, row and column counts); call getChartContext for the column list.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'deleteChartDocument',
    exposure: 'extended',
    category: 'document',
    risk: 'destructive',
    requiresApproval: true,
    description:
      "Call getChartContext first to check which chart is open. Delete a chart document by absolute path: a .chart package folder or a legacy .chart.json file. Only at the user's explicit direction.",
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path ending in .chart or .chart.json.',
        },
      },
      required: ['path'],
    },
  },
] as const
