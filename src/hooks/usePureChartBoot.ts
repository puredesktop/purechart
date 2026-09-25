import { useCallback, useEffect, useState } from 'react'
import {
  fetchCatalogManifest,
  fetchChartSettings,
  fetchShellPreferences,
} from '../bridge/platformBridge'
import type { PureChartBootState } from '../types'

interface UsePureChartBootResult {
  boot: PureChartBootState | null
  bootError: Error | null
  booting: boolean
  reloadBoot: () => void
}

export function usePureChartBoot(ready: boolean): UsePureChartBootResult {
  const [boot, setBoot] = useState<PureChartBootState | null>(null)
  const [bootError, setBootError] = useState<Error | null>(null)
  const [booting, setBooting] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const reloadBoot = useCallback(() => {
    setReloadToken(current => current + 1)
  }, [])

  useEffect(() => {
    if (!ready) return

    let cancelled = false

    async function load(): Promise<void> {
      setBooting(true)
      setBootError(null)
      try {
        const [prefs, appSettings, manifest] = await Promise.all([
          fetchShellPreferences(),
          fetchChartSettings(),
          fetchCatalogManifest(),
        ])
        if (cancelled) return
        setBoot({ prefs, appSettings, manifest })
      } catch (error) {
        if (cancelled) return
        setBoot(null)
        setBootError(error instanceof Error ? error : new Error(String(error)))
      } finally {
        if (!cancelled) setBooting(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [ready, reloadToken])

  return { boot, bootError, booting, reloadBoot }
}
