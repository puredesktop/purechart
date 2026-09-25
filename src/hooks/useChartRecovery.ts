import { useCallback, useEffect, useRef, useState } from 'react'
import { readRecoveries, recoveryMatches, removeRecovery, writeRecovery, recoveryLockName, availableRecoveries, type RecoveryEntry } from '../lib/chartRecovery'
import type { ChartSheet } from '../lib/chartSheet'

export function useChartRecovery() {
  const id = useRef(crypto.randomUUID())
  const latest = useRef<RecoveryEntry | null>(null)
  const [entries, setEntries] = useState<RecoveryEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const refreshGeneration = useRef(0)
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current
    try {
      const next = await availableRecoveries(localStorage, navigator.locks, id.current)
      if (generation === refreshGeneration.current) setEntries(next)
    } catch {
      if (generation === refreshGeneration.current) setError('Recovery copies could not be checked. Keep unsaved work open and retry in the desktop app.')
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    let release: (() => void) | undefined
    // A browser-owned lock survives timer throttling and releases on a crash or
    // closed window. Other tabs can distinguish interrupted work from live work.
    if (navigator.locks) {
      void navigator.locks.request(recoveryLockName(id.current), { signal: controller.signal }, async () => {
        await new Promise<void>(resolve => { release = resolve; void refresh() })
      }).catch(failure => {
        if (failure?.name !== 'AbortError') setError('Could not register this window for recovery. Keep unsaved work open until it saves.')
      })
    } else void refresh()
    const update = () => { void refresh() }
    window.addEventListener('storage', update)
    window.addEventListener('focus', update)
    const timer = window.setInterval(update, 5000)
    return () => {
      controller.abort()
      release?.()
      refreshGeneration.current++
      window.clearInterval(timer)
      window.removeEventListener('storage', update)
      window.removeEventListener('focus', update)
    }
  }, [refresh])
  const capture = useCallback((sheet: ChartSheet, path: string | null): boolean => {
    const entry = { id: id.current, sheet, path, updatedAt: Date.now() }
    latest.current = entry
    try { writeRecovery(localStorage, entry); setError(null); return true }
    catch { setError('Local recovery could not be stored. Keep this window open until the document saves successfully.'); return false }
  }, [])
  const saved = useCallback((content: string) => {
    if (!latest.current || !recoveryMatches(latest.current, content)) return
    try { removeRecovery(localStorage, id.current); latest.current = null; setError(null) }
    catch { setError('The saved document is safe, but its local recovery copy could not be cleared.') }
  }, [])
  const claim = useCallback(async (entryId: string, consume: (entry: RecoveryEntry) => boolean) => {
    try {
      if (!navigator.locks) throw new Error('This browser cannot check other open windows. Reopen PureChart in the desktop app to recover this copy.')
      await navigator.locks.request(recoveryLockName(entryId), { ifAvailable: true }, lock => {
        if (!lock) throw new Error('This recovery belongs to another open window. Continue editing there.')
        const entry = readRecoveries(localStorage).find(item => item.id === entryId)
        if (!entry) throw new Error('This recovery is no longer available.')
        if (consume(entry)) {
          removeRecovery(localStorage, entryId)
          setEntries(current => current.filter(item => item.id !== entryId))
        }
      })
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    void refresh()
  }, [refresh])
  const discard = useCallback((entryId: string) => claim(entryId, () => true), [claim])
  const recover = useCallback((entryId: string, apply: (sheet: ChartSheet) => void) => claim(entryId, entry => {
    const recovered = { ...entry.sheet, title: `${entry.sheet.title} — recovered` }
    if (!capture(recovered, null)) return false
    apply(recovered)
    return true
  }), [capture, claim])
  return { entries, error, capture, saved, discard, recover }
}
