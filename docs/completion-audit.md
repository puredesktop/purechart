# PureChart completion audit

The required scope is `reliability-roadmap.md`. The implementation is complete against the planned scope. Evidence and verification boundaries are recorded below. This is a working-tree completion, not a release or merge.

| Requirement | Current evidence | Assessment |
| --- | --- | --- |
| Persistent Glass/White setting; readable paper | `verify-desktop-appearance.mjs`: real settings bridge, reload, desktop/narrow editor rails; screenshots inspected | Verified |
| Import, multiple charts, edit, save, close/reopen, SVG/PNG | `verify-desktop-lifecycle.mjs`: actual package reads, exact reopen equality, export dimensions | Verified |
| Failed writes, Retry, outgoing-switch protection | `verify-desktop-failure.mjs`: own QA package permissions, unchanged last-good content, blocked New, history, successful retry | Verified |
| Recovery protects original and restores new draft | `verify-desktop-recovery.mjs`: real failed write, renderer reload, recovered package content, original unchanged; `verify-recovery.mjs`: ownership locks and quota failure | Verified for renderer interruption and storage failure; no OS crash injected |
| Rapid document changes and immediate agent create/open/save | Session supersession/guard tests; serialized App binding; `verify-desktop-tools.mjs` create/save and raw-open/save preserve predecessor; live-title lifecycle regression | `App.test.tsx` also exercises real session + lifecycle + App coordination with deferred React commits and retained callbacks; file transport is mocked. Verified |
| Undo/redo for document edits and assistant proposals | Whole-sheet history tests, shared-data replacement restoration, one-step proposal Undo in desktop script, title/style grouping | Verified. Canvas drag/zoom/brush selection is transient React state; it does not write history on movement. Committing a point/range annotation calls one session mutation. Typing/numeric style changes group in history; desktop annotation edit/remove/Undo verified |
| Editable large data workspace and import preview | Data editing/parser tests, desktop workflow, 50k paste/file checks, virtual rows; missing-column impact helper and desktop preflight/Discard check | Verified, including repeatable pre-Apply dependency warning and Discard in `verify-desktop-tools.mjs` |
| Source-preserving calculations, missing/duplicate rules, source-row inspection | Transform/facet/review tests; browser calculations check recorded in roadmap; filter percentages and global facet consistency tests | Verified |
| Axes/scales/formats/units, legends, references, uncertainty, annotations, styles | Presentation/layout/render tests, browser style lifecycle, validated annotation targets, edge-label/facet browser checks | Verified, including canvas double-click creation, label edit on blur, removal and Undo with actual saved-file checks in the desktop tool script |
| Matching preview/export, dimensions and resolution presets | Canonical renderer, export validation tests, desktop PNG/SVG reads, browser preview inspection | Verified |
| Reviewable assistant edits with validation and one undo | Proposal/session tests and `verify-desktop-tools.mjs` through real router/viewport/handler/completion | Verified renderer dispatch; backend tool records are fixtures |
| Truthful assistant save/export failures | Agent export tests; save handler throws on null/rejection; actual desktop persistence failure tests | Verified: desktop tool script forces EACCES on its QA package, asserts error content with no saved result and unchanged data, restores permissions and verifies successful save |

Final gates: all 279 app tests (30 files), app typecheck and production build passed. Shared lifecycle tests (5) and UI typecheck passed after its live-title change. `git diff --check` passes. The final desktop tool run passed save errors/retry, create/save isolation, pending proposal/application/one Undo, annotation creation/edit/remove/Undo, raw CSV open/save isolation, and import-impact/Discard. Final tool QA document: `/Users/developer/Pure/Drafts/PureChart QA tools 1790144309830.chart/chart.json`.

Verification boundaries: recovery simulates renderer loss via reload, not power loss; large-paste verification dispatches clipboard events rather than changing the OS clipboard; desktop assistant tests use the real shell router/bridge/handlers with synthetic tool records, not a live model. These limits do not change the implemented features. Build emits a bundle-size advisory (~891 kB uncompressed); it succeeds.

Changes remain uncommitted and the QA documents are retained. No release, deployment or merge was requested or performed.
