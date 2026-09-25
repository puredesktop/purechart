# PureChart code review — 2026-09-10

Baseline: own remote main ce23e3d888b06568852bc31e4b0b95807d4f4d77, fetched and matched before review.

Source of truth: suite docs/README.md, app source, public bridge and document lifecycle contracts. Scope is PureChart only.

## Fixed

- Reject non-document JSON and unsupported schema versions before binding a chart path; previously these normalized to blank/current-version charts and risked overwriting source on edit.
- Keep __proto__ column values in CSV and JSON. CSV could throw during inference; JSON silently lost values.
- Ignore quoted separators when detecting delimiters.
- Keep unparseable date-like strings on a categorical axis.
- Prevent inherited object keys such as constructor from becoming chart types.
- Normalize nonfinite/negative drawing sizes to supported defaults.

## Verification

Focused src/lib/codeReview.test.ts: 11 passed (10 failed before fixes; valid round-trip case already passed). App typecheck passed. No full suite or new Electron interaction run.

## Coverage and remaining work

Read parsing, document specification, geometry, interaction/export/path/snapshot helpers, bridge, session and boot hooks, App lifecycle and drawer tool domain logic; inspected handler and component interaction paths. This is not a claim that every source or styling line was exhaustively audited.

Further issues to address in app-only slices:

- Duplicate CSV headers still collapse values; rejecting them needs a recoverable paste editor state so an intermediate invalid header does not block typing.
- Malformed JSON pasted into the live editor falls back to delimited parsing. Separate draft text from accepted data before enforcing strict parsing.
- Large geometry arrays use spread into Math.min/max, which can exceed engine argument limits.
- Numeric/date line ordering and missing-value gap semantics need explicit product rules; connected scatter must retain observation order.
- Parallel drawer mutations can read a stale React snapshot before the next render; serialize tool mutations and await committed state.
- Deleting the active document resets the lifecycle before disk removal; a failed delete needs lifecycle restoration.
- Transient chart selections reset only with the explicit reset token; document/data switches should clear stale pinned points.
- Preview charts are summaries, with fewer chart types and no full x-axis fidelity.

No shell code changed. No mission completion or rendered export fidelity claim is made by these narrow checks.
