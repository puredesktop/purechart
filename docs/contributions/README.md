# purechart contribution roadmap

[View roadmap issues](https://github.com/puredesktop/purechart/issues?q=is%3Aissue%20label%3Aroadmap)

Build something you can see and try in the app. The first five items are **good first contributions**: bounded changes with a concrete demonstration. Choose a feature below, fix a bug, or propose your own improvement.

## Scope

Keep editable tables, chart specifications, existing chart forms and proposal review; refine the current data-to-chart workflow.

Size describes scope, not a promised completion time: **Small** = one focused interface change; **Medium** = coordinated interface/state work; **Large** = a feature across several flows, storage or export paths. All items are proposals, not claims that existing features are absent. Check the current code and extend what is there. Maintainers review code and tests before merging. Attribution is your choice.

## Good first contributions

1. **[Preview the exported image size.](https://github.com/puredesktop/purechart/issues/2)** Show the final PNG width and height after applying the export scale, rather than requiring users to multiply the settings themselves.
   <!-- contribution: {"id": "export-pixel-dimensions", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/export-pixel-dimensions.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/export-pixel-dimensions.md)

2. **[Preview axis number formats.](https://github.com/puredesktop/purechart/issues/3)** Provide examples beside existing axis number-format controls for percentages, currency and plain numbers without changing source values.
   <!-- contribution: {"id": "axis-unit-hints", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/axis-unit-hints.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/axis-unit-hints.md)

3. **[See how many rows a filter keeps.](https://github.com/puredesktop/purechart/issues/4)** Show the number of rows remaining after the current calculations and filters so an unexpectedly empty chart is easier to diagnose.
   <!-- contribution: {"id": "filter-result-count", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/filter-result-count.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/filter-result-count.md)

4. **[Recognise reference lines by value.](https://github.com/puredesktop/purechart/issues/5)** Show the axis and formatted value beside each reference-line entry so users can distinguish similar annotations before removing one.
   <!-- contribution: {"id": "reference-line-edit-feedback", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/reference-line-edit-feedback.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/reference-line-edit-feedback.md)

5. **[Understand which data belongs in each chart field.](https://github.com/puredesktop/purechart/issues/6)** Add a short role description to each field selector, such as category, measure or series, tailored to the current chart form.
   <!-- contribution: {"id": "field-mapping-descriptions", "size": "small", "goodFirstIssue": true, "guide": "docs/contributions/field-mapping-descriptions.md"} -->
   [Small · Good first contribution · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/field-mapping-descriptions.md)

## More improvements

6. **[Understand imported column types.](https://github.com/puredesktop/purechart/issues/7)** Show the inferred type beside each imported column and explain which example values caused a numeric or date column to be treated as text.
   <!-- contribution: {"id": "column-type-explanations", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/column-type-explanations.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/column-type-explanations.md)

7. **[Find the bad cell in an import.](https://github.com/puredesktop/purechart/issues/8)** Include the row and column in CSV or JSON import errors so users can correct the source without guessing.
   <!-- contribution: {"id": "import-row-error-locations", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/import-row-error-locations.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/import-row-error-locations.md)

8. **[See how much data an import preview represents.](https://github.com/puredesktop/purechart/issues/9)** Show total rows and previewed rows separately in the import panel, making truncated previews explicit before applying the data.
   <!-- contribution: {"id": "import-preview-row-counts", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/import-preview-row-counts.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/import-preview-row-counts.md)

9. **[Understand blanks and zeroes in a chart.](https://github.com/puredesktop/purechart/issues/10)** Explain how blank cells and zero values are treated by the selected chart form, without silently converting one into the other.
   <!-- contribution: {"id": "blank-versus-zero-guidance", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/blank-versus-zero-guidance.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/blank-versus-zero-guidance.md)

10. **[Keep chart mappings when a column is renamed.](https://github.com/puredesktop/purechart/issues/11)** When columns are renamed through the editor, retain mappings by their stable identifiers and visibly flag only mappings that can no longer resolve.
   <!-- contribution: {"id": "preserve-valid-mappings", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/preserve-valid-mappings.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/preserve-valid-mappings.md)

11. **[Fix a missing chart field.](https://github.com/puredesktop/purechart/issues/12)** Name the missing field and the control that needs attention when a chart cannot render, instead of showing a generic empty canvas.
   <!-- contribution: {"id": "clear-missing-field-errors", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/clear-missing-field-errors.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/clear-missing-field-errors.md)

12. **[Correct a calculation without retyping it.](https://github.com/puredesktop/purechart/issues/13)** Place malformed calculation feedback next to the input that caused it and retain the user's expression for correction.
   <!-- contribution: {"id": "calculation-input-feedback", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/calculation-input-feedback.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/calculation-input-feedback.md)

13. **[Find crowded category labels.](https://github.com/puredesktop/purechart/issues/14)** Warn when category labels are likely to overlap at the current chart width and link to the existing label presentation controls.
   <!-- contribution: {"id": "long-category-label-preview", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/long-category-label-preview.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/long-category-label-preview.md)

14. **[Read every legend entry.](https://github.com/puredesktop/purechart/issues/15)** Keep a long legend within the chart or panel bounds and make every series label accessible without truncating the exported data.
   <!-- contribution: {"id": "legend-overflow-handling", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/legend-overflow-handling.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/legend-overflow-handling.md)

15. **[Correct an empty annotation label.](https://github.com/puredesktop/purechart/issues/16)** Reject blank annotation labels with a nearby message while preserving the entered position and styling fields.
   <!-- contribution: {"id": "annotation-empty-text-validation", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/annotation-empty-text-validation.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/annotation-empty-text-validation.md)

16. **[Name a reusable style without accidental replacement.](https://github.com/puredesktop/purechart/issues/17)** Trim style names and explain duplicate or blank names in the existing saved-style controls before replacing anything.
   <!-- contribution: {"id": "style-name-validation", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/style-name-validation.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/style-name-validation.md)

17. **[See exactly what a chart proposal changes.](https://github.com/puredesktop/purechart/issues/18)** List the affected fields, filters and presentation settings alongside the existing proposed-chart preview so small changes are easier to review.
   <!-- contribution: {"id": "proposal-change-summary", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/proposal-change-summary.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/proposal-change-summary.md)

18. **[Understand why a proposal needs refreshing.](https://github.com/puredesktop/purechart/issues/19)** Explain which document change made a proposal stale and provide a clear route to discard it and request a fresh proposal.
   <!-- contribution: {"id": "stale-proposal-explanation", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/stale-proposal-explanation.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/stale-proposal-explanation.md)

19. **[Check the export filename.](https://github.com/puredesktop/purechart/issues/20)** Show the sanitized output filename before saving and keep the chart title unchanged when filename characters need replacement.
   <!-- contribution: {"id": "export-filename-preview", "size": "small", "goodFirstIssue": false, "guide": "docs/contributions/export-filename-preview.md"} -->
   [Small · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/export-filename-preview.md)

20. **[Find the document behind a tracked figure.](https://github.com/puredesktop/purechart/issues/21)** Display each tracked figure's document name and relative path in the redraw panel so users can identify where an updated chart will go.
   <!-- contribution: {"id": "redraw-target-context", "size": "medium", "goodFirstIssue": false, "guide": "docs/contributions/redraw-target-context.md"} -->
   [Medium · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/redraw-target-context.md)

21. **[Extend saved styles with axis presets.](https://github.com/puredesktop/purechart/issues/22)** Extend the existing reusable style library with optional axis formatting and compatible axis bounds. Preview the affected settings before applying a preset to another chart, and keep data/field mappings unchanged. Migrate old style entries without losing them.
   <!-- contribution: {"id": "save-and-reuse-chart-presentation-presets", "size": "large", "goodFirstIssue": false, "guide": "docs/contributions/save-and-reuse-chart-presentation-presets.md"} -->
   [Large · Implementation brief](https://github.com/puredesktop/purechart/blob/main/docs/contributions/save-and-reuse-chart-presentation-presets.md)

## References

- [App guide](https://github.com/puredesktop/purechart/blob/main/docs/app-guide.md)
- [Development guide](https://github.com/puredesktop/purechart/blob/main/docs/development.md)
- [Contributing](https://github.com/puredesktop/purechart/blob/main/CONTRIBUTING.md)
