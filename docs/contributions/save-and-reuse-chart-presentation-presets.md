# Extend saved styles with axis presets

**Large · Open contribution** · `save-and-reuse-chart-presentation-presets`

## What the user gets

Extend the existing reusable style library with optional axis formatting and compatible axis bounds. Preview the affected settings before applying a preset to another chart, and keep data/field mappings unchanged. Migrate old style entries without losing them.

## Where to start

- [src/components/PresentationPanel.tsx](../../src/components/PresentationPanel.tsx) — start with the app-owned UI/state at this path. At source revision `da85b1e36e30`, inspect line 90: `<p>Styles store colors, marks, grid, labels, and legend placement. Saving an existing name replaces that style. Applying is undoable; deleting a saved style leaves charts`.
- [App guide](../app-guide.md) — open the view in which this change belongs.
- [Development guide](../development.md) — prepare the shared dependencies and run this app inside PureDesktop.

The source location is a navigation hint, not a patch prescription. Read the enclosing component and its existing handlers, then follow their state/command calls. If the behavior is already partly implemented, improve the missing visible part rather than adding a duplicate control. Do not edit generated output or move app behavior into the desktop shell.

## Implementation outline

1. Reproduce the current behavior in the surface above using the fixture below. Identify the existing state and the handler that owns the action.
2. Extend the existing reusable style library with optional axis formatting and compatible axis bounds. Preview the affected settings before applying a preset to another chart, and keep data/field mappings unchanged. Migrate old style entries without losing them.
3. Keep existing document identities, formats, persistence and undo behavior. Derive displayed counts, labels and previews from the same data used by the action; do not keep a second editable copy of that data.
4. Keep controls labelled and keyboard reachable. Handle empty, long-text and unavailable-data states inline. For asynchronous work, show success only after completion and retain the input on failure.

## Demonstrate it

**Setup:** Use a disposable chart with 10 rows, category/value columns, a blank cell and a long category name. Keep the original chart as a comparison.

**Primary check:** Save a style with percentage axes, load it in another compatible chart and preview/apply it. Existing style entries still load, incompatible bounds are explained, and Undo restores the previous chart settings.

**Expected visible result:** Extend the existing reusable style library with optional axis formatting and compatible axis bounds. Preview the affected settings before applying a preset to another chart, and keep data/field mappings unchanged. Migrate old style entries without losing them.

**Regression check:** Repeat with an empty value or selection and in a narrow window. The previous document stays intact, existing controls remain reachable, and the user can undo/cancel where the existing workflow supports it. Verify in light and dark themes. For a display-only change, confirm that opening the view does not write to the document.

## Verification and submission

Follow [development setup](../development.md) first. Run `npm run typecheck`; run a focused existing test or add one for changed state/validation logic. Run `npm run build` for a production compilation check. For UI-only work, include before/after screenshots and the exact manual steps above; do not claim tests you did not run.

Build and test locally before deciding whether to submit through Factory’s existing website review process. Nothing in this brief authorizes automatic publication, sending messages, issuing invoices, uploading files, or merging. All contributed code follows this repository’s license. Choose a public name, nickname or anonymous credit at submission.
