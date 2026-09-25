import { updateCollectionAsset } from '@purescience/platform-ui/bridge/assets'
import { bridge } from '@purescience/platform-ui/bridge/client'
import { getPlatformPreferences } from '@purescience/platform-ui/bridge/preferences'
import { toggleAgentDrawer } from '@purescience/platform-ui/bridge/workspace'
import { PLATFORM_BRIDGE_METHODS } from '@purescience/platform-ui/bridge/methods'
import { CHART_APP_SLUG } from '../constants'
import type {
  ChartAppSettings,
  PlatformAppSettingsUpdateRequest,
  PlatformShellManifest,
  ShellPreferences,
} from '../types'

export { bridge }

const STANDALONE_SETTINGS_KEY = 'purescience:purechart:settings'
const STANDALONE_MANIFEST: PlatformShellManifest = {
  apps: [
    {
      slug: CHART_APP_SLUG,
      name: 'PureChart',
      navigationLabel: 'Chart',
    },
  ],
}

export function isStandaloneDevMode(): boolean {
  return import.meta.env.DEV && window.parent === window
}

function readStandaloneJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStandaloneJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}

export async function fetchShellPreferences(): Promise<ShellPreferences> {
  if (isStandaloneDevMode()) {
    return { workingDirectory: '', theme: 'light' }
  }

  return getPlatformPreferences() as Promise<ShellPreferences>
}

export async function fetchChartSettings(): Promise<ChartAppSettings> {
  if (isStandaloneDevMode()) {
    return readStandaloneJson<ChartAppSettings>(STANDALONE_SETTINGS_KEY, {})
  }

  return bridge.call<ChartAppSettings>(
    PLATFORM_BRIDGE_METHODS.SETTINGS_APP_GET,
    [CHART_APP_SLUG],
  )
}

export async function updateChartSettings(
  patch: Partial<ChartAppSettings>,
): Promise<ChartAppSettings> {
  if (isStandaloneDevMode()) {
    const nextSettings = {
      ...readStandaloneJson<ChartAppSettings>(STANDALONE_SETTINGS_KEY, {}),
      ...patch,
    }
    writeStandaloneJson(STANDALONE_SETTINGS_KEY, nextSettings)
    return nextSettings
  }

  const request: PlatformAppSettingsUpdateRequest = {
    appSlug: CHART_APP_SLUG,
    patch,
  }
  return bridge.call<ChartAppSettings>(
    PLATFORM_BRIDGE_METHODS.SETTINGS_APP_UPDATE,
    [request],
  )
}

export async function fetchCatalogManifest(): Promise<PlatformShellManifest> {
  if (isStandaloneDevMode()) return STANDALONE_MANIFEST

  return bridge.call<PlatformShellManifest>(
    PLATFORM_BRIDGE_METHODS.CATALOG_MANIFEST,
  )
}

export async function readTextFile(path: string): Promise<string> {
  return bridge.call<string>(PLATFORM_BRIDGE_METHODS.FS_READ, [path])
}

export async function writeTextFile(
  path: string,
  content: string,
): Promise<void> {
  await bridge.call(PLATFORM_BRIDGE_METHODS.FS_WRITE, [path, content])
}

/** Delete a file, or a whole package folder when `recursive` is set. */
export async function deleteFile(
  path: string,
  recursive = false,
): Promise<void> {
  await bridge.call(PLATFORM_BRIDGE_METHODS.FS_DELETE, [{ path, recursive }])
}

export async function writeBinaryFile(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  await bridge.call(PLATFORM_BRIDGE_METHODS.FS_WRITE_BINARY, [
    { path, base64: btoa(binary) },
  ])
}

export async function updateAssetMetadata(input: {
  collectionPath: string
  relativePath: string
  label?: string
  caption?: string
  description?: string
  sourceDocumentPath?: string
  sourceAppSlug?: string
}): Promise<void> {
  if (isStandaloneDevMode()) return
  await updateCollectionAsset(input)
}


// ---- Platform operations ledger ---------------------------------------------
// Suite-wide record of user/agent interactions in two lanes ('user'|'agent'),
// stored by the shell and rendered live by the PureAssistant tab. Building
// rule (see agents.md "Operations ledger"): record every meaningful user or
// agent interaction this app performs, and when you find legacy activity/feed
// code duplicating this, tag it `DEPRECATED(operations-ledger)` for cleanup.
import {
  listPlatformOperations as listPlatformOperationsBridge,
  onPlatformOperationRecorded as onPlatformOperationRecordedBridge,
  recordPlatformOperation as recordPlatformOperationBridge,
} from '@purescience/platform-ui/bridge/operations'
import type {
  PlatformOperation,
  PlatformOperationInput,
  PlatformOperationsListQuery,
  PlatformOperationsListResult,
} from '@purescience/platform-ui/bridge/operations'

export type {
  PlatformOperation,
  PlatformOperationInput,
  PlatformOperationsListQuery,
  PlatformOperationsListResult,
}

function operationsBridgeAvailable(): boolean {
  return !(import.meta.env.DEV && window.parent === window)
}

/** Record one interaction into the ledger (the shell pins appSlug to this app). */
export async function recordOperation(
  input: PlatformOperationInput,
): Promise<PlatformOperation | null> {
  if (!operationsBridgeAvailable()) return null
  return recordPlatformOperationBridge(input)
}

/** List recorded operations, newest first. */
export async function listOperations(
  query?: PlatformOperationsListQuery,
): Promise<PlatformOperationsListResult> {
  if (!operationsBridgeAvailable()) return { operations: [] }
  return listPlatformOperationsBridge(query)
}

/** Subscribe to live ledger appends. Returns unsubscribe. */
export function onOperationRecorded(
  listener: (operation: PlatformOperation) => void,
): () => void {
  if (!operationsBridgeAvailable()) return () => undefined
  return onPlatformOperationRecordedBridge(listener)
}

/**
 * Open the assistant drawer.
 *
 * The app never calls a model. When a chart needs something only judgement
 * can give — a caption that says why, not just what — it hands the work to
 * the drawer, which reads the chart through describeChart and writes back
 * through setChartCaption. Nothing about the chart changes here.
 */
export async function openAssistantDrawer(): Promise<void> {
  try {
    await toggleAgentDrawer({ open: true })
  } catch {
    // The drawer is the shell's; standalone dev has none, and a chart that
    // cannot reach it is not a chart in trouble.
  }
}
