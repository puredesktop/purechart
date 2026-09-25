# PureChart reliability and capability implementation

## Completion status

The planned implementation is complete. See `completion-audit.md` for requirement-by-requirement evidence and verification boundaries. Final checks: 279 app tests, typecheck, production build, shared lifecycle tests/typecheck, and expanded actual desktop tool workflow all pass. Changes are in the working tree; no release or merge performed.

The increment notes below are chronological history. Their “remaining” lists describe the state at that increment and are superseded by the completion audit.

## Latest verification — recovery handoff and facet consistency

- Desktop failure/reload testing exposed a populated recovered draft that never started autosave: its dirty effect ran before the asynchronous document binding completed. App.tsx now resumes dirty tracking after binding, using the live incoming sheet to include edits made during the outgoing write. Disk writes remain owned by the shared document lifecycle.
- `scripts/verify-desktop-recovery.mjs` now waits for the recovered draft's own filename and Saved state. It passed after a real permission-denied write and iframe reload: pending edits were saved to `/Users/developer/Pure/Drafts/PureChart QA recovery 1790143111525 — recovered.chart/chart.json`, and the original retained its last-good content. This verifies renderer reload recovery, not an operating-system crash.
- Focused session/recovery suite: 20 tests passed; typecheck and production build passed. Build retains the existing large-bundle advisory.
- Facet selection now shares series colors, grouped-bar slots and globally selected/folded series across panels. Filtered percentages retain source-row provenance and are calculated once across panels; zero-total and negative-source percentages return errors. Prior focused geometry/transform/render verification: 75 tests and browser facet checks passed.
- Still required: actual shell assistant proposal dispatch, same-turn create/open/save binding audit, narrow desktop layout/glass verification, and final requirement-by-requirement completion audit. The full required scope below remains active.

Source of truth: this checklist, the current source, and executable tests. Preserve existing chart packages, legacy documents, glass settings and shared document lifecycle. Changes belong to PureChart unless a generic platform defect is proven.

## Required scope

- [x] Desktop import → create multiple charts → edit → save → close → reopen → export regression coverage; malformed/missing/large data, failed saves, rapid switches, render parity.
- [x] Undo/redo: shared data, chart creation/removal, mapping, styling, annotations; grouped typing/dragging; assistant transactions; accessible toolbar and shortcuts.
- [x] Recovery: accurate save states, crash recovery, preserve last good document.
- [x] Data workspace: editable cells, column names/types, row insertion/deletion, rectangular paste, import preview, invalid-value feedback, shared-data impact, virtualization.
- [x] Calculations: source-preserving filters/sorts/grouping; sum/average/count/percent; missing/duplicate policy; visible calculations/exclusions; provenance to rows.
- [x] Design/export: bounds/scales/units/formats, legend positioning, reference lines, annotation editing, explicit error columns, reusable styles, dimension/resolution previews and publishing presets.
- [x] Assistant proposals: preview/explanation, same validated commands as UI, annotation/caption checks, one undo transaction, accurate persistence/export failures.

## Current increment

Document history at the session mutation boundary. Retain shared lifecycle ownership of disk writes. Verify with session tests for complete sheet/data restoration, redo invalidation, navigation exclusion, typing grouping, and document boundaries. Recovery and all later items remain pending until implemented and verified.

## Implemented increment — 2026-09-22

- Session history stores whole-sheet + materialized-table snapshots, excludes chart navigation, groups chart/document title edits, captions and numerical style changes; toolbar Undo/Redo and Cmd/Ctrl-Z/Shift-Z outside text editing. New/open document boundaries reset history. Assistant mutations through applyChartSpec now enter history. Full assistant proposals/transaction grouping and axis-edit grouping remain pending.
- Editable virtualized source grid: cells, unique column renaming with all-chart mapping repair, add/remove rows and columns, rectangular paste that grows rows, invalid-operation rejection, Escape cancellation. Raw CSV identifiers and quoted values survive editing. Explicit column types and invalid-value diagnostics remain pending.
- File imports now stage text and show a five-row preview before Apply. Shared-data impact is explained. Data editor and source text still need a unified large-data workspace; full large-data performance coverage remains pending.
- Local recovery entries are separate from original document files; user restores into a new draft. Saved matching snapshots clear automatically; quota failures surface. Footer shows pending/saving/failed/saved with retry. Browser reload recovery verified. Multi-window live-entry filtering and failure/recovery desktop lifecycle integration need further coverage.
- Save-as now serializes the live sheet, including edits made in the same event turn. Added mocked save/reopen multi-chart and failed-write tests.

Evidence: full suite passed 204 tests before two additional persistence tests; subsequent focused session/recovery suite covers these additions. Typecheck and production build passed before final persistence regression refinements; repeat build for release. Browser automation verified cell edit/undo/redo, rename, row insertion, reload recovery, and Escape cancellation. No claim of completion for the overall goal: calculations, typed data, design/export controls, assistant proposals, and full desktop integration gates remain.

## Typed data and calculations increment — 2026-09-22

- Persisted explicit Auto/Text/Number/Date types; typed invalid cells keep source text and display diagnostics while materializing as missing. CSV/JSON raw values, leading-zero identifiers, renamed types and empty one-column rows covered by tests. Migration, session reopen and snapshot parsing preserve types.
- Calculation engine derives values without changing source data. Supports per-chart filters, source/value sorting, group-by-X/series/facet sum/mean/count-numeric/percentage, omit/zero policies, invalid filter-column and negative-percentage errors. Duplicate bars require aggregation. Both geometry and facets use derived values, so exports share calculations.
- Calculation panel explains active choices/excluded rows, offers filters and paged output/source-row inspection. Column renames repair filter/sort references. Malformed JSON, duplicate headers and excess CSV cells are rejected rather than silently reinterpreted or dropped.
- Fixed inferred axes: increasing numeric measurements no longer become temporal axes just because they increase; numeric axis inference requires an appropriate header.
- Browser checks passed: average grouped values and provenance, explicit type changes, invalid-value highlighting and undo. A 50,000-row file imported, previewed and opened the virtualized table with fewer than 40 mounted body rows in 655ms on the test machine. A separate Playwright giant-text fill timed out; file import was measured successfully, large direct clipboard paste remains to verify.
- Full automated suite after inference fix: 218 tests; typecheck/build gates rerun. Source-preserving transformations verified against geometry; additional faceted percentage/parity and sort semantics still need audit before marking calculation phase complete.

Next: advanced axis/legend/reference/error-bar/annotation controls, reusable styles and export presets/previews; assistant proposal commands and transactional review UI; persistent desktop workflow automation and remaining recovery/multiwindow/save-failure gates. Keep the complete Required scope above active.

## Design and publishing increment — 2026-09-22

- Persisted optional axis min/max/log scale and presentation configuration. Numeric formats now actually format geometry ticks (the preexisting format fields were not rendered). Explicit bounds are exact; invalid/inverted/log/category configurations return actionable empty-state errors.
- Added movable/hideable legends, numeric reference lines, explicit absolute error-bound columns with validation, annotation label editing/removal, and reusable named visual styles. Renaming/deleting error columns repairs presentation mappings. Axis field typing joins history groups.
- Added Export panel with report/slides/print presets, custom dimensions/PNG scale, transparency and a preview at requested dimensions. The same canonical renderer powers preview and both exports; invalid renders are refused. Captions are wrapped/escaped and included in SVG/PNG; insufficient caption space is reported.
- Tests cover exact/log bounds, error interval geometry/domain, reference and legend SVG, persisted presentation, invalid intervals/aggregated uncertainty, numeric formatting and captions. Full suite: 223 tests; typecheck/build pass. Browser verified bounds, bottom legend, reference creation, slide preset, SVG and PNG downloads with no runtime exceptions. Inspected the resulting 1600×900 PNG.
- Remaining presentation audit: narrow settings layout, all facet combinations, error overlay legibility, export dimension validation through agent tools, saved style lifecycle and annotation-target validation. Assistant proposals/transactions and full desktop lifecycle workflow remain required. Do not mark the overall goal complete based on these focused tests.

## Rendering/export audit increment — 2026-09-22

- Error intervals now follow the actual derived row through series collection, filtering and sorting. Removed per-point row searches that assigned identical coordinates the first row's uncertainty and scaled quadratically. Series folded into Other reject error bounds instead of inventing combined uncertainty.
- Intervals draw above marks within the series' zoom/opacity group. Bar value labels sit above the upper interval so text does not cross the interval. Standalone browser render checked at 960×600; two intervals rendered without errors, inspected `/tmp/purechart-error-intervals.png` (before final label offset refinement).
- Central export dimension/scale/pixel validation rejects invalid and oversized renders/raster allocations. Agent arguments reject nonnumeric/nonfinite input rather than silently using defaults, and PNG allocation is checked before creating an unsaved source document. Invalid dimensions now return an explicit render error instead of silently resizing.
- Evidence: 54 focused geometry/facet/render/export tests and 10 new agent export tests passed; typecheck and build passed before final label-only refinement; focused presentation suite rerun after it. Agent tests cover invalid parameters before save, failed source-document creation, failed file export and successful requested output options.
- Remaining: assistant proposal preview/apply workflow; actual desktop lifecycle regression/failure/multiwindow coverage; facet/large-paste/style lifecycle and annotation audits from earlier increments. Overall requirements remain unchecked until comprehensively verified.

## Assistant proposal increment — 2026-09-22

- Added `proposeChart` to manifest, runtime catalog and handler wiring. It builds a validated candidate over the focused chart's existing data and creates pending session state; proposing never writes the chart or saves a file. Runtime agent sheet reads now use the live reference, matching spec/table reads.
- Review card displays explanation, changed properties, SVG preview, calculation policy/exclusions, computed findings and review notes. Apply uses the existing manual `applyChartSpec` mutation boundary once; Undo/Redo restores the whole edit. Discard does not modify the chart. Changed focus/spec/table rejects stale application; successful document opens/new-document history resets clear pending proposals. Same-turn repeated apply is rejected.
- Proposal validation rejects invalid mappings, unrenderable charts, unknown fields, nonfinite numbers and settings that migration would silently discard or clamp. Source data cannot be replaced by this workflow. Computed finding IDs can produce exact grounded captions; free-form claims remain explicitly unverified for human review. Faceted proposals currently offer no computed caption findings.
- Annotation validation is shared with direct assistant annotation creation: targets must match plotted data; range summaries must match count/min/max/average/change. Free-form annotation wording is flagged for review and is not claimed to be semantically verified.
- Evidence: full suite 252 tests passed, typecheck/build passed. New tests cover pending state without mutation, multi-field apply and complete undo/redo, stale/same-turn/double application, document boundaries, caption grounding, invalid targets/statistics/settings, manifest/runtime parity and direct annotation validation.
- Repeatable standalone browser check: `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/verify-proposals.mjs` with the PureChart Vite server running. Verified 380px layout with no horizontal overflow, preview/apply/undo/stale guard/discard; screenshot `/tmp/purechart-proposal-review.png`. This fixture uses real session and proposal components in an isolated browser; it does not prove shell dispatch or actual desktop persistence.
- Remaining before overall completion: shell agent dispatch for the new manifest tool; full desktop import/edit/save/close/reopen/export/failure lifecycle regression; multiwindow recovery exclusion; large direct paste; facet parity/layout and saved-style lifecycle audits. Review all earlier unchecked requirements against actual evidence, not just this increment.

## Multi-window recovery and desktop lifecycle increment — 2026-09-22

- Recovery ownership uses browser Web Locks, released on window close/crash without relying on throttled heartbeats. Candidate lists exclude held/pending owners and refresh on storage/focus/periodic checks. Recover/Discard acquire an available lock and re-read the entry before acting, preventing races against an active window. Unsupported lock environments report inability to check ownership rather than offering unsafe cross-window actions. Confirmed `navigator.locks` and secure context in the actual desktop iframe.
- Recover writes the new draft's local backup successfully before applying/removing the original entry. Quota failure preserves the original recovery. Three-window browser integration verifies live exclusion, action-time refusal, closing-owner release, quota preservation, successful new-draft restoration and exclusion of that live restored draft.
- Fixed lifecycle `suggestedTitle` to use the sheet/document title, not the selected chart title. Actual desktop testing found that naming a document before importing otherwise created an Untitled folder.
- Repeatable actual Electron workflow now lives in `scripts/verify-desktop-lifecycle.mjs`: `QA_DRAFTS_DIR='/Users/developer/Pure/Drafts' node scripts/verify-desktop-lifecycle.mjs` (desktop dev shell CDP9336, PureChart open). Creates a uniquely named QA document, imports CSV via file input, creates two charts, edits title/type/measures, waits for save, reads actual chart.json, exports and checks SVG/PNG dimensions, closes app, reopens from switcher, asserts mappings/types and exact saved document equality, then reopens the starting document. Passed with artifact `/Users/developer/Pure/Drafts/PureChart QA 1790141124431.chart`; screenshot `/tmp/purechart-desktop-reopened.png`. Manual precursor QA document also retained at `/Users/developer/Pure/Drafts/PureChart QA lifecycle 2026-09-22.chart`.
- Evidence: 17 focused recovery/session tests, typecheck/build pass; `scripts/verify-recovery.mjs` passes with real browser locks and shared storage. Desktop workflow passed including the naming correction.
- Visual inspection exposed remaining clipping of marks/direct labels at automatic domain edges (e.g. the maximum north point). Fix and verify this before declaring preview/export polish complete. Other outstanding work: actual desktop failed-save/recovery paths and rapid-switch failures; shell assistant proposal dispatch; large direct paste; faceted layout/parity and reusable style lifecycle audits. Existing successful lifecycle test covers normal saves, not failure scenarios.

## Edge labels and faceted comparison audit — 2026-09-22

- Moved direct labels outside the mark clip. Endpoint marks receive enough clipping allowance at normal zoom; zoomed marks remain constrained. Direct labels wrap within reserved figure space with word breaks, wide-glyph allowance, a full-text SVG title, and bounded display length. Labels outside explicitly cropped data domains are omitted. Nine browser size/label cases (320×240 through 1200×800) assert actual text bounds and whole endpoint circles with `scripts/verify-edge-labels.mjs`; screenshot `/tmp/purechart-edge-labels.png`.
- Facet geometry now reserves the main heading and each panel heading rather than overflowing the bottom of the figure. A small export reports that more room is needed; compact previews use compact plot geometry. The main title is drawn once. Endpoint values respect configured numeric formatting.
- Facets use shared continuous X domains, category positions and histogram bins, so missing coverage in one group does not change how the same value is placed. Faceted bars retain a zero baseline (previous shared positive domain could erase the smallest bar). Panel ordering now uses its displayed final value rather than its maximum.
- Browser integration `scripts/verify-facets.mjs` checks line/bar/histogram four-panel exports including captions for text overflow, and visual inspection of `/tmp/purechart-facet-layout.png` confirms readable panel layout. New tests cover dimensions/headings, shared X positions, bar baseline, shared bins and final-value ordering.
- Evidence: full suite 260 tests; typecheck/build passed; both new browser checks pass. Current remaining audit work includes desktop failure/recovery/rapid-switch paths, shell proposal dispatch, large direct paste, reusable-style lifecycle, facet percentages/provenance and multi-series color consistency. Keep the complete required scope active.

## Reusable styles and large clipboard audit — 2026-09-22

- Extracted style storage/application to `src/lib/chartStyles.ts`. Stored fields now use existing style and presentation validators, including legend position. Named replacement/delete read the latest library first; storage events refresh other windows. Unreadable libraries and quota failures report errors rather than silently replacing the library. Added named deletion controls; applied styles remain in charts after deleting the preset.
- Style application uses the live spec/table and the existing single history mutation. Data, axes, calculations, references and annotations are retained. Browser `scripts/verify-styles.mjs` verifies save/apply/one-step undo/delete and preservation of data/axis limits; unit tests cover replacement/reload, corrupt entries, fresh reads and storage failure.
- Large native text insertion stalled the isolated Chrome renderer (stopped its confirmed live test process after ~96 seconds). DataPanel now handles clipboard payloads ≥20,000 characters with one controlled-buffer update, preserving selection replacement and the explicit Apply boundary. Small paste retains native editing behavior.
- `scripts/verify-large-paste.mjs` passed with 50,000 rows: bulk source paste plus Apply/table opening 4,465ms, rectangular 50,000-row grid paste 1,299ms on this machine, fewer than 40 mounted table rows, and one Undo restores original values. It dispatches genuine ClipboardEvent payloads to the application handlers without modifying the OS clipboard; it is not a hardware keyboard/OS clipboard integration test.
- Evidence: 19 focused data/style/session tests, typecheck/build pass; style and large-paste browser checks pass. A DataPanel regression test verifies large selected-text replacement, preserved prefix/suffix, preview row count and no data mutation before Apply.
- Remaining high-priority gates: actual desktop failed-save/retry/outgoing-switch/recovery scenarios; shell assistant proposal dispatch; facet percentages/provenance/multi-series color consistency; final requirement-by-requirement audit. All prior composite requirements remain authoritative.

## Desktop save failures and transition guard — 2026-09-22

- Added `scripts/verify-desktop-failure.mjs`. It creates its own uniquely named QA package, stores a last-good snapshot, temporarily makes only that package read-only, edits through the desktop UI, verifies a real EACCES save failure and unchanged disk file, attempts New, verifies the pending chart and Undo/Redo remain, restores permissions in `finally`, clicks Retry, and checks the saved contents. Latest successful artifact: `/Users/developer/Pure/Drafts/PureChart QA save failure 1790142535696.chart`.
- This actual desktop test exposed a footer defect: long filesystem errors put Retry outside the viewport. Footer now reserves button space and truncates the status text with a full-text tooltip. Successful saves clear stale outgoing-save status rather than continuing to show failure after success.
- New/Open now await a lifecycle-owned outgoing save before changing session data/history. The session's optional beforeOpen guard also covers shell-delivered resources and direct assistant opens. New document creation is a shared guarded method used by UI and assistant createChart; it clears the old sheet only after success. Recovery also flushes current work before replacing the view. Explicit save synchronizes the current live sheet and flushes pending edits first.
- Tests cover failed guard preserving the sheet and Undo history, overlapping requests waiting on the guard, and new-document reset after success only. Real desktop failure test passed including Undo/Redo after blocked New and retry/error clearing. Permissions restored for all injected faults.
- Evidence: full suite 268 tests and typecheck pass; production build passes. A development hot-refresh frame went blank after hook signature changes; reloading the already-saved QA iframe restored it with no runtime error, then the failure workflow passed from the fresh mount. Normal desktop lifecycle script rerun after the transition changes.
- Remaining: actual shell proposal dispatch, desktop crash-to-recovery restoration, facet percentage/provenance/multi-series-color audit, and final requirement-by-requirement verification. Include same-turn agent create/open/save and lifecycle binding edge cases in that audit; current guard tests do not by themselves prove every cross-layer timing case.

## Desktop appearance and data-rail width check

- Verified the actual gear → Appearance → Background menu exposes Glass and White. Both selections survive iframe reload through the real desktop settings bridge. Restored the pre-test White preference afterward.
- Narrow inspection exposed a real DataPanel issue: shared MetaText's no-wrap styling clipped source instructions, and the import controls could overrun their row. App-local DataPanel styles now wrap explanatory metadata and allow the action row to wrap, while the source editor retains monospace text.
- Added `scripts/verify-desktop-appearance.mjs`: toggles both backgrounds, reloads to verify persistence, checks instructions/page bounds at desktop 1280px and narrow 800px widths, captures screenshots, restores prior appearance and clears device emulation. Passed; visually inspected `/tmp/purechart-glass-800.png` for readable instructions and opaque chart paper.
- Typecheck and focused DataPanel test pass. This checks the data rail and sheet, not every editing/export control at narrow widths. Those controls, actual shell assistant dispatch and same-turn binding remain audit items.

## Live export destination audit

- Found mixed-time export inputs: the canonical renderer read the live chart, while destination/title/asset metadata came from a previous React render. SVG and PNG now capture a consistent live spec/table/path snapshot at invocation and retain it through asynchronous clipboard/raster/file operations.
- Session document-path changes now synchronously update a live ref. Assistant context reads that live path via a getter, matching its existing live spec/table/sheet getters.
- Added a retained-callback regression: change document path and chart title, then export before React rerenders; assert actual binary-write destination and SVG title both belong to the latest chart. Focused session + agent-export tests: 28 passed. Typecheck and production build pass.
- Actual desktop import/multiple-chart/edit/save/SVG/PNG/close/reopen workflow passes again (`/Users/developer/Pure/Drafts/PureChart QA 1790143419264.chart`).
- This resolves export input consistency only. App.tsx still needs the separate same-turn create/open/save lifecycle-binding audit; do not interpret the new live path getter as proving that coordination. Actual shell proposal dispatch and remaining narrow controls also remain required.

## Coordinated bindings and desktop assistant delivery

- App document switches and explicit saves now share a serialized binding operation. It flushes the bound outgoing sheet before reading the latest live incoming path/sheet, then adopts or resets the lifecycle. This removes the stale-render path dependency from immediate create/save. Save acknowledgment compares the live sheet.
- The shared document lifecycle accepts an optional live suggested-title getter, evaluated when a draft is created. Existing string callers remain supported. PureChart uses its live document title. The generic lifecycle test verifies title changes before rerender; all five focused lifecycle tests and the shared UI typecheck pass.
- Added `scripts/verify-desktop-tools.mjs`: real shell Router.request → registered viewport event → app agent handler → completion bridge, with synthetic tool-record lookup/completion persistence only. No model request or assistant conversation mutation. Creates/saves a QA chart and verifies the prior file remains byte-for-byte unchanged, proposes without changing disk, applies through the UI, saves, then undoes the proposal with one Undo and checks disk again. Passed with `/Users/developer/Pure/Drafts/PureChart QA tools 1790143653408.chart/chart.json`. This proves renderer dispatch/bridge behavior, not model/backend generation of tool records.
- That test found populated agent-created charts were not selected, so follow-up proposals failed. New populated documents now focus their first chart; blank UI documents retain their initial sheet workflow.
- Full app suite: 273 tests pass; app typecheck/build pass. Real desktop failed-save/outgoing-switch/retry and failure/reload/recovery scripts pass after the binding change. Recovery artifact: `/Users/developer/Pure/Drafts/PureChart QA recovery 1790143684831 — recovered.chart/chart.json`.
- Remaining audit: remaining editor/export controls at narrow width, raw-data open behavior across multi-chart documents, strict same-event App integration coverage, and final requirement matrix. Preserve all requirements until verified.

## Import boundary and editor rail audit

- Opening raw CSV/TSV/JSON through the document-open route now creates a fresh named sheet with one selected chart and an appropriate suggested form. Previously it updated a chart inside the outgoing sheet, carrying unrelated charts and the old document name into the new draft. The legacy file-object route now also respects the outgoing save guard and resets its document history.
- Session regressions verify a two-chart source sheet remains unchanged, raw categorical data opens as a new selected bar chart, and malformed JSON preserves the current document/path/history. All 20 session tests and typecheck pass.
- Extended actual desktop tool test to open a newly written QA CSV and immediately save it: resulting package has the correct imported name/data/one bar chart, while its predecessor is byte-for-byte unchanged. Passed with `/Users/developer/Pure/Drafts/PureChart QA import 1790143871840.chart`.
- Extended `verify-desktop-appearance.mjs` to require a populated selected chart and inspect Chart/Style/Review/Export sidebar widths at 1280px and 800px, including scrolling to lower controls. Passed. Visually inspected populated Style and Export screens: readable controls, opaque paper, visible preview/export buttons. An earlier exploratory screenshot showed a development HMR-empty session; it was discarded as evidence and the saved QA document was reloaded before these checks.
- Remaining: strict same-event App integration test and final requirement-by-requirement audit, including shared-data replacement effects across multiple existing charts. Do not check the overall scope complete solely from these increment checks.

## Shared-data impact and completion audit

- Added `chartDataImpact` and an import-preview warning naming every chart with missing plot/facet/filter/sort/error-bound columns. It only explains dependencies; it does not silently rewrite calculations. The preview explains that the current chart may receive a suggested mapping and other charts/calculations can need remapping. Undo remains the whole-sheet recovery action.
- Added dependency tests and a multi-chart session regression: replacement shares the new data, and one Undo restores all chart mappings, calculations and old values; Redo reapplies the replacement. Focused checks and typecheck pass. Actual desktop preview identifies removed region/value columns and Discard preserves source.
- Created `docs/completion-audit.md` to map original requirements to concrete evidence and explicitly list remaining verification. The full goal is not yet marked complete.


## Final integration audit

- `src/App.test.tsx` renders the actual App/session/shared-lifecycle stack with file transport and chrome mocked. In a single deferred React commit it creates and saves a second document, then opens and saves the first through retained callbacks; both file contents and names remain correct. This closes the immediate-transition check.
- Extended desktop tool verifier forces an actual permission-denied agent save (no success payload), restores permissions and saves successfully. It also double-clicks the real canvas hit target, edits/removes an annotation through Style, undoes removal and checks actual saved JSON at every step. Import dependency warning and Discard are repeatable checks in that verifier.
- Pointer source audit confirms brushing/zooming uses transient local state; dragging does not flood document history. Annotation commit invokes the session once. Existing typing/style groups and whole-sheet history tests cover persisted changes.
- Final run: 279 tests across 30 files, app typecheck/build and diff whitespace check pass. Desktop tool script passes all its assertions. Completion evidence and honest testing limits are consolidated in `completion-audit.md`.
