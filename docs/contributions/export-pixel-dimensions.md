# Preview the exported image size

**Small · Good first contribution** · `export-pixel-dimensions`

## What the user gets

Show the final PNG width and height after applying the export scale, rather than requiring users to multiply the settings themselves.

## Where to start

- [src/components/ExportPanel.tsx](../../src/components/ExportPanel.tsx) — start with the app-owned UI/state at this path. At source revision `da85b1e36e30`, inspect line 18: `const pixels = settings.width * settings.height * settings.scale ** 2`.
- [App guide](../app-guide.md) — open the view in which this change belongs.
- [Development guide](../development.md) — prepare the shared dependencies and run this app inside PureDesktop.

The source location is a navigation hint, not a patch prescription. Read the enclosing component and its existing handlers, then follow their state/command calls. If the behavior is already partly implemented, improve the missing visible part rather than adding a duplicate control. Do not edit generated output or move app behavior into the desktop shell.

## Implementation outline

1. Reproduce the current behavior in the surface above using the fixture below. Identify the existing state and the handler that owns the action.
2. Show the final PNG width and height after applying the export scale, rather than requiring users to multiply the settings themselves.
3. Keep existing document identities, formats, persistence and undo behavior. Derive displayed counts, labels and previews from the same data used by the action; do not keep a second editable copy of that data.
4. Keep controls labelled and keyboard reachable. Handle empty, long-text and unavailable-data states inline. For asynchronous work, show success only after completion and retain the input on failure.

## Demonstrate it

**Setup:** Use a disposable chart with 10 rows, category/value columns, a blank cell and a long category name. Keep the original chart as a comparison.

**Primary check:** Set width 800, height 600 and scale 2: the export panel shows 1600 × 1200 pixels before export.

**Expected visible result:** Show the final PNG width and height after applying the export scale, rather than requiring users to multiply the settings themselves.

**Regression check:** Repeat with an empty value or selection and in a narrow window. The previous document stays intact, existing controls remain reachable, and the user can undo/cancel where the existing workflow supports it. Verify in light and dark themes. For a display-only change, confirm that opening the view does not write to the document.

## Verification and submission

Follow [development setup](../development.md) first. Run `npm run typecheck`; run a focused existing test or add one for changed state/validation logic. Run `npm run build` for a production compilation check. For UI-only work, include before/after screenshots and the exact manual steps above; do not claim tests you did not run.

Build and test locally before deciding whether to submit through Factory’s existing website review process. Nothing in this brief authorizes automatic publication, sending messages, issuing invoices, uploading files, or merging. All contributed code follows this repository’s license. Choose a public name, nickname or anonymous credit at submission.
