/**
 * Markup for the suite's agent activity layer: the refs an agent tool call names when it touches this item, so the
 * layer can mark it on screen. Refs are space-separated, so a value holding whitespace cannot be one and is left out.
 */
export function agentRefs(
  refs: ReadonlyArray<string | null | undefined | false>,
  label?: string | null,
): { 'data-agent-ref': string; 'data-agent-label'?: string } {
  const tag = refs.filter((ref): ref is string => typeof ref === 'string' && ref !== '' && !/\s/.test(ref)).join(' ')
  return label ? { 'data-agent-ref': tag, 'data-agent-label': label } : { 'data-agent-ref': tag }
}

/** A chart on the sheet, as focusChart / duplicateChart / removeChart name it and listCharts lists it. */
export function chartRefs(id: string, title?: string | null): ReturnType<typeof agentRefs> {
  return agentRefs([id, `chart:${id}`], title || undefined)
}

/** A data column, keyed only (a bare column name would also match a chart type or a title), as setChartEncodings (x, y, series), facetChart (column) and updateChart name it. */
export function columnRefs(name: string): ReturnType<typeof agentRefs> {
  return agentRefs(/\s/.test(name) ? [] : [`x:${name}`, `y:${name}`, `series:${name}`, `column:${name}`], name)
}
