import { useChartRecovery } from './hooks/useChartRecovery'
import { InlineBanner } from '@purescience/platform-ui/components/common/feedback/InlineBanner'
import { useWorkspaceDocumentBinding } from './hooks/useWorkspaceDocumentBinding'
import { chartSnapshotHtml } from './lib/chartSnapshot'
import { readTextFile } from './bridge/platformBridge'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppFrame } from '@purescience/platform-bridge/components/AppFrame'
import { EmptyState } from '@purescience/platform-ui/components/common/feedback/EmptyState'
import { usePlatformBridge } from '@purescience/platform-ui/bridge/react/usePlatformBridge'
import { usePlatformViewportResource } from '@purescience/platform-ui/bridge/react/usePlatformViewportResource'
import { useDocumentLifecycle } from '@purescience/platform-ui/bridge/react/useDocumentLifecycle'
import { useDocumentHotkeys } from '@purescience/platform-ui/bridge/react/useDocumentHotkeys'
import {
  DocumentHeaderActions,
  DocumentSwitcher,
} from '@purescience/platform-ui/components/common/documents'
import { isStandaloneDevMode } from './bridge/platformBridge'
import { ChartWorkspace } from './components/ChartWorkspace'
import {
  AUTOSAVE_DELAY_MS,
  CHART_APP_SLUG,
  CHART_FILE_SUFFIX,
  CHART_PACKAGE_SUFFIX,
} from './constants'
import { usePureChartBoot } from './hooks/usePureChartBoot'
import { useChartSession } from './hooks/useChartSession'
import { usePureChartAgentTools } from './hooks/usePureChartAgentTools'
import { defaultSpec } from './lib/chartSpec'
import {
  emptySheet,
  migrateSheet,
  serializeSheet,
  sheetPackageFiles,
  specForChart,
} from './lib/chartSheet'
import { EMPTY_TABLE } from './lib/dataParse'
import type { ChartAppSettings, ResourceOpenEvent } from './types'

const DEFAULT_CHART_TITLE = 'Untitled chart'

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path
}

export function App(): React.ReactElement {
  const { error: bridgeError, ready, meta } = usePlatformBridge()
  const standaloneDev = isStandaloneDevMode()
  const bootReady = ready || standaloneDev
  const { boot, bootError } = usePureChartBoot(bootReady)
  const { resource: viewportResource, clearResource } =
    usePlatformViewportResource(ready && !standaloneDev, meta)

  if (bridgeError && !standaloneDev) {
    return (
      <AppFrame>
        <EmptyState
          tone="error"
          title="Bridge unavailable"
          message={bridgeError.message}
        />
      </AppFrame>
    )
  }

  if (!bootReady || !boot) {
    const message = bootError
      ? bootError.message
      : ready
      ? 'Loading chart settings and catalog…'
      : 'Waiting for PureScience shell bridge…'

    return (
      <AppFrame>
        <EmptyState
          tone={bootError ? 'error' : 'neutral'}
          title={bootError ? 'Boot failed' : 'pure chart'}
          message={message}
        />
      </AppFrame>
    )
  }

  return (
    <ChartDocumentApp
      ready={ready}
      appSettings={boot.appSettings}
      viewportResource={viewportResource}
      onViewportResourceHandled={clearResource}
    />
  )
}

interface ChartDocumentAppProps {
  ready: boolean
  appSettings: ChartAppSettings
  viewportResource: ResourceOpenEvent | null
  onViewportResourceHandled: () => void
}

function ChartDocumentApp({
  ready,
  appSettings,
  viewportResource,
  onViewportResourceHandled,
}: ChartDocumentAppProps): React.ReactElement {
  const beforeOpenRef = useRef<() => Promise<void>>(async () => {})
  const session = useChartSession({
    beforeOpen: () => beforeOpenRef.current(),
    ready,
    appSettings,
    resource: viewportResource,
    onResourceHandled: onViewportResourceHandled,
  })
  const recovery = useChartRecovery()
  const [savePending, setSavePending] = useState(false)
  const workspaceBinding = useWorkspaceDocumentBinding(session.documentPath)
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // ---- Unified document lifecycle -----------------------------------------
  // One chart is one `.chart` package (manifest + chart.json); new charts are
  // created as packages. A legacy `.chart.json` file opened from disk stays a
  // single file. `boundSheetRef` holds the sheet belonging to the bound
  // document and only advances while that binding is unchanged — so switching
  // documents can flush the OLD spec to the OLD path before adopting the new.
  const boundPathRef = useRef<string | null>(null)
  // The whole document, not one chart of it: adding a chart has to reach disk.
  const boundSheetRef = useRef(session.sheet)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  // The rendered chart: the export buttons and the exportChart tool
  // serialize this one element, so both produce the same file.
  const svgRef = useRef<SVGSVGElement>(null)

  const lifecycle = useDocumentLifecycle({
    appSlug: CHART_APP_SLUG,
    suffix: CHART_PACKAGE_SUFFIX,
    kind: 'package',
    suggestedTitle: () => sessionRef.current.liveSheet().title,
    debounceMs: AUTOSAVE_DELAY_MS,
    onSaved: files => {
      const data = files.find(file => file.name === 'chart.json' || file.name === null)
      if (data && typeof data.content === 'string') {
        recovery.saved(data.content)
        if (data.content === serializeSheet(sessionRef.current.liveSheet())) {
          setSavePending(false)
          sessionRef.current.acknowledgeSave()
        }
      }
    },
    // An agent tool result or another app rewrote the open document on
    // disk. Reload unless the user has unsaved hand edits.
    onExternalChange: ({ path, dirty }) => {
      if (dirty || path !== sessionRef.current.documentPath) return
      void sessionRef.current.openChartPath(path, { externalChange: true })
    },
    serialize: () => {
      const bound = boundPathRef.current
      // Legacy flat `.chart.json` files opened from disk stay single files.
      if (bound && bound.endsWith(CHART_FILE_SUFFIX)) {
        return [{ name: null, content: serializeSheet(boundSheetRef.current) }]
      }
      return sheetPackageFiles(boundSheetRef.current)
    },
  })
  const lifecycleRef = useRef(lifecycle)
  const bindingChainRef = useRef<Promise<void>>(Promise.resolve())
  // Explicit saves and React effects share one binding transaction. Read the
  // live path after the outgoing write: a newer open may have superseded it.
  const synchronizeBinding = useCallback((): Promise<void> => {
    const work = async () => {
      if (sessionRef.current.liveDocumentPath() === boundPathRef.current) return
      const lifecycle = lifecycleRef.current
      await lifecycle.flush({ throwOnError: true })
      const target = sessionRef.current.liveDocumentPath()
      if (target === boundPathRef.current) return
      const incomingSheet = sessionRef.current.liveSheet()
      boundPathRef.current = target
      boundSheetRef.current = incomingSheet
      if (target) lifecycle.adopt(target, { title: incomingSheet.title })
      else lifecycle.reset()
      if (!target && (incomingSheet.data.inline?.text?.trim() || incomingSheet.data.mode === 'reference')) {
        recovery.capture(incomingSheet, target)
        setSavePending(true)
        lifecycle.markDirty()
      }
    }
    const next = bindingChainRef.current.then(work, work)
    bindingChainRef.current = next.catch(() => undefined)
    return next
  }, [])
  beforeOpenRef.current = async () => {
    await synchronizeBinding()
    const current = sessionRef.current.liveSheet()
    const path = sessionRef.current.liveDocumentPath()
    if (path === boundPathRef.current && current !== boundSheetRef.current) {
      boundSheetRef.current = current
      if (current.data.inline?.text?.trim() || current.data.mode === 'reference') {
        recovery.capture(current, path)
        setSavePending(true)
        lifecycleRef.current.markDirty()
      }
    }
    await lifecycleRef.current.flush({ throwOnError: true })
  }
  useEffect(() => {
    lifecycleRef.current = lifecycle
  }, [lifecycle])

  useEffect(() => {
    const target = session.documentPath
    if (boundPathRef.current === target) return
    const previousPath = boundPathRef.current
    const previousSheet = boundSheetRef.current
    void synchronizeBinding().catch(error => {
      if (sessionRef.current.liveDocumentPath() !== target) return
      sessionRef.current.applySheet(previousSheet)
      sessionRef.current.applyChartSpec(sessionRef.current.liveSpec(), {
        documentPath: previousPath,
        status: `Could not save the outgoing chart: ${error instanceof Error ? error.message : String(error)}. Current chart kept.`,
      })
    })
  }, [session.documentPath, synchronizeBinding])

  // Lifecycle-owned path changes (lazy draft creation, promote, rename) flow
  // back into the session so agent tools and exports see where the doc lives.
  useEffect(() => {
    const path = lifecycle.doc.path
    if (!path || boundPathRef.current === path) return
    boundPathRef.current = path
    sessionRef.current.bindDocumentPath(path)
  }, [lifecycle.doc.path])

  // Every meaningful change to the bound chart marks the document dirty —
  // the first one lazily creates the durable draft in PureDrafts.
  useEffect(() => {
    if (session.documentPath !== boundPathRef.current) return
    const sheet = session.sheet
    // Loading from disk is not an edit. Re-saving it broadcasts another
    // content change and makes two windows reload/save each other forever.
    if (session.isLoadedSheet(sheet)) {
      boundSheetRef.current = sheet
      setSavePending(false)
      return
    }
    const meaningful =
      Boolean(sheet.data.inline?.text?.trim()) || sheet.data.mode === 'reference'
    if (!meaningful) return
    boundSheetRef.current = sheet
    recovery.capture(sheet, session.documentPath)
    setSavePending(true)
    lifecycleRef.current.markDirty()
  }, [session.sheet, session.documentPath])

  // Explicit save (⌘S, agent saveChart with no path): make sure a draft
  // exists, then flush the debounced autosave immediately.
  const saveDocument = useCallback(async (): Promise<string | null> => {
    await beforeOpenRef.current()
    const lifecycle = lifecycleRef.current
    if (sessionRef.current.liveDocumentPath() === boundPathRef.current) {
      boundSheetRef.current = sessionRef.current.liveSheet()
    }
    const path = await lifecycle.ensureDraft()
    if (!path) return null
    await lifecycle.flush({ throwOnError: true })
    return path
  }, [])

  // Deleting the bound document must detach the lifecycle first so a queued
  // autosave cannot resurrect the deleted file.
  const deleteChartDocument = useCallback(async (path: string) => {
    if (boundPathRef.current === path) lifecycleRef.current.reset()
    await sessionRef.current.deleteChartDocument(path)
  }, [])

  usePureChartAgentTools(ready, session, {
    saveDocument,
    deleteChartDocument,
    getChartSvg: () => svgRef.current,
  })

  const createNewChart = useCallback(async () => {
    setSwitcherOpen(false)
    try { await sessionRef.current.createDocument(defaultSpec(), EMPTY_TABLE) }
    catch (error) { sessionRef.current.reportSaveFailure(error) }
  }, [])

  // The chart title inside the app is the naming surface: committing it on a
  // package (draft or filed) renames the folder, so the tab, the switcher
  // and the title never disagree.
  // Legacy `.chart.json` files keep their name (rename would fight the
  // compound suffix), so title edits there just persist into the spec.
  const commitTitle = useCallback((title: string) => {
    const lifecycle = lifecycleRef.current
    const trimmed = title.trim() || DEFAULT_CHART_TITLE
    const boundIsLegacyFile = Boolean(
      boundPathRef.current?.endsWith(CHART_FILE_SUFFIX),
    )
    if (
      lifecycle.doc.status !== 'none' &&
      !boundIsLegacyFile &&
      trimmed !== lifecycle.doc.title
    ) {
      void lifecycle.rename(trimmed)
    }
  }, [])

  useDocumentHotkeys({
    onSave: () => void saveDocument().catch(() => undefined),
    onNew: createNewChart,
    onOpen: () => setSwitcherOpen(true),
  })
  // ---- end document lifecycle ----------------------------------------------

  // Switcher snapshots: the first numeric series as a mini chart.
  const loadChartPreview = useCallback(
    async (item: {
      path: string
      kind: 'package' | 'file'
    }): Promise<{ kind: 'html'; html: string; title?: string } | null> => {
      try {
        const source =
          item.kind === 'package'
            ? `${item.path.replace(/\/+$/, '')}/chart.json`
            : item.path
        if (item.kind === 'file' && !/\.chart\.json$/i.test(item.path)) {
          return null
        }
        const sheet = migrateSheet(JSON.parse(await readTextFile(source)))
        const html = chartSnapshotHtml(specForChart(sheet, null))
        return html ? { kind: 'html', html, title: sheet.title } : null
      } catch {
        return null
      }
    },
    [],
  )

  return (
    <AppFrame
      headerDocumentName={
        session.spec.title?.trim() || (lifecycle.doc.path ? fileNameFromPath(lifecycle.doc.path) : undefined)
      }
      headerActions={
        <DocumentHeaderActions
          lifecycle={lifecycle}
          title={session.spec.title || DEFAULT_CHART_TITLE}
          onOpenSwitcher={() => setSwitcherOpen(true)}
        />
      }
    >
      {workspaceBinding.error ? <div role="alert">{workspaceBinding.error} <button onClick={workspaceBinding.retry}>Retry tab binding</button></div> : null}
      {recovery.error && <InlineBanner variant="danger">{recovery.error}</InlineBanner>}
      {recovery.entries.length > 0 && <details style={{ padding: '8px 16px', flexShrink: 0 }}>
        <summary>Recover interrupted work ({recovery.entries.length})</summary>
        {recovery.entries.map(entry => <div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8 }}>
          <span>{entry.sheet.title} · {new Date(entry.updatedAt).toLocaleString()}</span>
          <button onClick={async () => {
            try { await beforeOpenRef.current() }
            catch (error) { sessionRef.current.reportSaveFailure(error); return }
            await recovery.recover(entry.id, recovered => {
            session.applySheet(recovered)
            session.applyChartSpec(specForChart(recovered, recovered.focusedId), { documentPath: null, status: 'Recovered into a new draft; the original file is unchanged.' })
            session.resetHistory()
            })
          }}>Recover as new draft</button>
          <button onClick={() => recovery.discard(entry.id)}>Discard recovery</button>
        </div>)}
      </details>}
      <ChartWorkspace
        saveStatus={lifecycle.doc.error ? `Save failed: ${lifecycle.doc.error}` : lifecycle.doc.saving ? 'Saving…' : savePending ? 'Unsaved changes' : lifecycle.doc.path ? 'Saved' : 'New document'}
        onRetrySave={lifecycle.doc.error ? () => { void saveDocument().catch(() => undefined) } : undefined}
        session={session}
        svgRef={svgRef}
        onCommitTitle={commitTitle}
      />
      <DocumentSwitcher
        appSlug={CHART_APP_SLUG}
        suffixes={[CHART_PACKAGE_SUFFIX, CHART_FILE_SUFFIX]}
        variant="modal"
        loadPreview={loadChartPreview}
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        onOpenDocument={path => {
          setSwitcherOpen(false)
          void session.openChartPath(path)
        }}
        onCreateNew={createNewChart}
        newLabel="New chart"
        title="Open a chart"
        itemNoun="chart"
      />
    </AppFrame>
  )
}
