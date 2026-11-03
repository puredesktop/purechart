import { useDocumentLifecycle, type DocumentLifecycle, type UseDocumentLifecycleOptions } from '@purescience/platform-ui/bridge/react/useDocumentLifecycle'

export interface SharedDocumentOptions<T> extends Omit<UseDocumentLifecycleOptions, 'revision' | 'onExternalChange'> {
  contentFile: string
  parse: (text: string) => T
  read: (path: string) => Promise<string>
  conditional?: (path: string) => boolean
  live: () => T
  showMerged: (document: T) => void
  merge: (base: T, local: T, remote: T) => T
  reload: (path: string) => void
}

/** The document lifecycle as the app uses it today: reload when clean, ignore a change when dirty, write without a condition. */
export function useSharedDocument<T>(options: SharedDocumentOptions<T>): DocumentLifecycle {
  return useDocumentLifecycle({
    ...options,
    onExternalChange: ({ path, dirty }) => { if (!dirty) options.reload(path) },
  })
}
