# purechart roadmap

## Scope

Keep editable tables, chart specifications, existing chart forms and proposal review; refine the current data-to-chart workflow.

These are proposed, incremental improvements, not a release schedule or a list of missing core features. Keep each change small and preserve existing file formats, user data and app workflows.

## Improvements

1. **Column type explanations.** Show the inferred type beside each imported column and explain which example values caused a numeric or date column to be treated as text.

2. **Import row error locations.** Include the row and column in CSV or JSON import errors so users can correct the source without guessing.

3. **Import preview row counts.** Show total rows and previewed rows separately in the import panel, making truncated previews explicit before applying the data.

4. **Blank versus zero guidance.** Explain how blank cells and zero values are treated by the selected chart form, without silently converting one into the other.

5. **Field mapping descriptions.** Add a short role description to each field selector, such as category, measure or series, tailored to the current chart form.

6. **Preserve valid mappings.** When columns are renamed through the editor, retain mappings by their stable identifiers and visibly flag only mappings that can no longer resolve.

7. **Clear missing-field errors.** Name the missing field and the control that needs attention when a chart cannot render, instead of showing a generic empty canvas.

8. **Filter result count.** Show the number of rows remaining after the current calculations and filters so an unexpectedly empty chart is easier to diagnose.

9. **Calculation input feedback.** Place malformed calculation feedback next to the input that caused it and retain the user's expression for correction.

10. **Axis unit hints.** Provide examples beside existing axis number-format controls for percentages, currency and plain numbers without changing source values.

11. **Long category label preview.** Warn when category labels are likely to overlap at the current chart width and link to the existing label presentation controls.

12. **Legend overflow handling.** Keep a long legend within the chart or panel bounds and make every series label accessible without truncating the exported data.

13. **Reference-line edit feedback.** Show the axis and formatted value beside each reference-line entry so users can distinguish similar annotations before removing one.

14. **Annotation empty-text validation.** Reject blank annotation labels with a nearby message while preserving the entered position and styling fields.

15. **Style name validation.** Trim style names and explain duplicate or blank names in the existing saved-style controls before replacing anything.

16. **Proposal change summary.** List the affected fields, filters and presentation settings alongside the existing proposed-chart preview so small changes are easier to review.

17. **Stale proposal explanation.** Explain which document change made a proposal stale and provide a clear route to discard it and request a fresh proposal.

18. **Export pixel dimensions.** Show the final PNG width and height after applying the export scale, rather than requiring users to multiply the settings themselves.

19. **Export filename preview.** Show the sanitized output filename before saving and keep the chart title unchanged when filename characters need replacement.

20. **Redraw target context.** Display each tracked figure's document name and relative path in the redraw panel so users can identify where an updated chart will go.

## References

- [App guide](docs/app-guide.md)
- [Development guide](docs/development.md)
- [Current implementation](src/components/ChartWorkspace.tsx)
