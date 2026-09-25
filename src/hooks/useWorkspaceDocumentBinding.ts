import { useEffect, useRef, useState } from 'react'
import { updateCurrentWorkspaceTab } from '@purescience/platform-ui/bridge/workspace'

/** Package aliases share one workspace identity. Never normalize through symlinks. */
export function canonicalDocumentPath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+$/, '').replace(/(\.chart)\/chart\.json$/, '$1')
}

/** Only call with the successfully loaded document, never a requested open. */
export function useWorkspaceDocumentBinding(path: string | null) {
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const tail = useRef<Promise<unknown>>(Promise.resolve())
  const canonical = path ? canonicalDocumentPath(path) : null
  useEffect(() => {
    let current = true
    setError(null)
    if (!canonical || !canonical.startsWith('/')) return
    // Serialize host updates so an older slow request cannot win over a newer open.
    const publish = async () => {
      if (!current) return
      const result = await updateCurrentWorkspaceTab({ resource: { path: canonical } })
      if (!result.updated) throw new Error('The workspace tab could not be bound to this document.')
    }
    const next = tail.current.then(publish, publish)
    tail.current = next.catch(() => undefined)
    void next.catch(cause => {
      if (current) setError(`Document is open, but restart restoration is not confirmed: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
    return () => { current = false }
  }, [canonical, attempt])
  return { error, retry: () => setAttempt(value => value + 1) }
}
