# Platform requirements

PureChart runs inside the Pure Suite workspace and uses its local `packages/ui` and `packages/bridge` dependencies.

This implementation requires:

- `@purescience/platform-bridge/components/AppFrame`, including shared Appearance settings (Glass/White).
- `useDocumentLifecycle` support for `suggestedTitle: string | (() => string)`. The getter must be evaluated at draft creation, so an immediate assistant create/save uses the current document title before React rerenders.

The live-title lifecycle implementation and regression test are in the parent workspace's `packages/ui/src/bridge/react/useDocumentLifecycle.tsx` and `useDocumentLifecycle.test.tsx`. They are outside this submodule and must travel with the parent workspace integration. Publishing this submodule does not publish those parent-repository changes or advance the parent's recorded submodule commit.

Verification in `completion-audit.md` was performed with those platform changes present.
