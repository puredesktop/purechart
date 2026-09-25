import type { ResourceOpenEvent } from '@purescience/platform-ui/bridge/types'

export type { ResourceOpenEvent }

export interface ChartAppSettings {
  /** Most recently opened chart/data files, newest first. */
  recentPaths?: string[]
}

export interface ShellPreferences {
  workingDirectory: string
  theme: 'light' | 'dark'
}

export interface PlatformShellManifest {
  apps: Array<{
    slug: string
    name: string
    navigationLabel?: string
  }>
}

export interface PlatformAppSettingsUpdateRequest {
  appSlug: string
  patch: Record<string, unknown>
}

export interface PureChartBootState {
  prefs: ShellPreferences
  appSettings: ChartAppSettings
  manifest: PlatformShellManifest
}
