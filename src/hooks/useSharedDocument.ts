import { useCallback, useEffect, useRef } from 'react'
import {
  useDocumentLifecycle,
  type DocumentLifecycle,
  type UseDocumentLifecycleOptions,
} from '@purescience/platform-ui/bridge/react/useDocumentLifecycle'

export interface SharedDocumentOptions<T> extends Omit<UseDocumentLifecycleOptions, 'revision' | 'onExternalChange'> {
  /** The file in the package that holds the document, and the document as it reads from there. */
  contentFile: string
  parse: (text: string) => T
  /** Reads a whole text file; the bridge's, in the app. */
  read: (path: string) => Promise<string>
  /** Whether saves can be conditional: a loose single file has no package for the shell to look in. */
  conditional?: (path: string) => boolean
  /** What this copy has on screen now. */
  live: () => T
  /** Puts the merge of this copy's work and the other's on screen. It is then saved. */
  showMerged: (document: T) => void
  /** Three-way: what the two last agreed on, this copy's, the other's. */
  merge: (base: T, local: T, remote: T) => T
  /** The document changed on disk and this copy has nothing unsaved: load it as usual. */
  reload: (path: string) => void
}

const REVISION_FIELD = 'revision'
/** The same content has the same revision, so saving what is already there changes nothing on disk. */
function contentHash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
const stamped = (content: string): { text: string; revision: string } => {
  const { [REVISION_FIELD]: _gone, ...rest } = JSON.parse(content) as Record<string, unknown>
  const revision = contentHash(JSON.stringify(rest))
  return { text: `${JSON.stringify({ ...rest, [REVISION_FIELD]: revision }, null, 2)}\n`, revision }
}
const revisionIn = (text: string): string | null => {
  const value = (JSON.parse(text) as Record<string, unknown>)[REVISION_FIELD]
  return typeof value === 'string' ? value : null
}

/**
 * useDocumentLifecycle for an app that can run as two live copies over one document (a tab, and one held inside a page).
 *
 * Saves are conditional on the revision this copy last saw, so a stale copy can never write over the other's work unseen.
 * When the other copy saves first, this one takes what it did and merges it in: at once if this copy has unsaved work when
 * it hears of the change, and otherwise on the save the shell refused. A copy with nothing unsaved simply reloads.
 */
export function useSharedDocument<T>(options: SharedDocumentOptions<T>): DocumentLifecycle {
  const latest = useRef(options)
  latest.current = options
  const lifecycleRef = useRef<DocumentLifecycle | null>(null)
  /** What this copy and the file last agreed on, and that file's revision. */
  const agreed = useRef<{ path: string; document: T; revision: string | null } | null>(null)
  const writing = useRef<{ revision: string; content: string } | null>(null)
  const turns = useRef<Promise<unknown>>(Promise.resolve())

  const contentPath = (path: string) => `${path.replace(/\/+$/, '')}/${latest.current.contentFile}`
  const isConditional = (path: string | null) => Boolean(path) && (latest.current.conditional?.(path!) ?? true)

  const lookAtDisk = useCallback(async (path: string) => {
    const text = await latest.current.read(contentPath(path))
    return { path, document: latest.current.parse(text), revision: revisionIn(text) }
  }, [])

  /** One at a time: a merge runs on what the last merge left. */
  const inTurn = useCallback((work: () => Promise<void>): Promise<void> => {
    const next = turns.current.then(work, work)
    turns.current = next.catch(() => undefined)
    return next
  }, [])

  const takeInTheOtherCopy = useCallback((path: string): Promise<void> => inTurn(async () => {
    const seen = await lookAtDisk(path)
    const before = agreed.current?.path === path ? agreed.current.document : seen.document
    const merged = latest.current.merge(before, latest.current.live(), seen.document)
    agreed.current = seen
    latest.current.showMerged(merged)
    lifecycleRef.current?.markDirty()
  }).catch(error => console.error('Could not take in the other copy of this document', error)), [inTurn, lookAtDisk])

  const lifecycle = useDocumentLifecycle({
    ...options,
    serialize: () => {
      const files = latest.current.serialize()
      const file = files.find(entry => entry.name === latest.current.contentFile)
      if (!file || typeof file.content !== 'string') {
        writing.current = null
        return files
      }
      const { text, revision } = stamped(file.content)
      writing.current = { revision, content: file.content }
      return files.map(entry => (entry === file ? { ...entry, content: text } : entry))
    },
    revision: () => {
      const path = lifecycleRef.current?.doc.path ?? null
      return isConditional(path) && agreed.current?.path === path
        ? { file: latest.current.contentFile, field: REVISION_FIELD, expected: agreed.current!.revision }
        : (undefined as never)
    },
    onSaved: files => {
      const done = writing.current
      const path = lifecycleRef.current?.doc.path ?? agreed.current?.path
      if (done && path) agreed.current = { path, document: latest.current.parse(done.content), revision: done.revision }
      latest.current.onSaved?.(files.map(file =>
        done && file.name === latest.current.contentFile ? { ...file, content: done.content } : file))
    },
    onExternalChange: ({ path, dirty }) => {
      if (dirty) {
        void takeInTheOtherCopy(path)
        return
      }
      void inTurn(async () => {
        agreed.current = await lookAtDisk(path)
        latest.current.reload(path)
      }).catch(() => undefined) // mid-write or gone: the next change event says so again
    },
  })
  lifecycleRef.current = lifecycle

  // Binding to a document: what is on disk now is what this copy starts from.
  const path = lifecycle.doc.path
  useEffect(() => {
    if (!path || !isConditional(path) || agreed.current?.path === path) return
    let current = true
    void lookAtDisk(path).then(seen => { if (current && agreed.current?.path !== path) agreed.current = seen }).catch(() => undefined)
    return () => { current = false }
  }, [path, lookAtDisk])

  // The shell refused the save: the other copy saved first. Merge, and the merge saves.
  const refused = /Save conflict/i.test(lifecycle.doc.error ?? '') && !lifecycle.doc.saving
  useEffect(() => {
    if (refused && path) void takeInTheOtherCopy(path)
  }, [refused, path, takeInTheOtherCopy])

  return lifecycle
}
