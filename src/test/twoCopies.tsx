import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useRef, useState, type RefObject } from 'react'
import { useSharedDocument } from '../hooks/useSharedDocument'
import type { DocumentLifecycle } from '@purescience/platform-ui/bridge/react/useDocumentLifecycle'
import { fakeShell } from './fakeShell'

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

export interface Copy<T> {
  name: string
  /** What is on screen in this copy. */
  document: () => T
  /** Change it, as a person or an agent does. */
  edit: (change: (document: T) => T) => Promise<void>
  /** The same, without waiting: for two copies changing it in one moment (see `together`). */
  change: (change: (document: T) => T) => void
  /** Wait until nothing is left to save. */
  settled: () => Promise<void>
  lifecycle: () => DocumentLifecycle
}

export interface TwoCopiesConfig<T> {
  contentFile: string
  files: (document: T) => { name: string | null; content: string }[]
  parse: (text: string) => T
  merge: (base: T, local: T, remote: T) => T
}

const PATH = '/Documents/shared.package'

export async function openTwoCopies<T>(initial: T, config: TwoCopiesConfig<T>) {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  fakeShell.reset()
  for (const file of config.files(initial)) fakeShell.files.set(`${PATH}/${file.name}`, file.content)
  const roots: Root[] = []

  const mount = async (name: string): Promise<Copy<T>> => {
    const live = { current: config.parse(fakeShell.files.get(`${PATH}/${config.contentFile}`)!) }
    const handle = { current: null as DocumentLifecycle | null }
    const setShown = { current: (_: T) => {} }
    const Host = ({ into }: { into: RefObject<DocumentLifecycle | null> }) => {
      const [, show] = useState(0)
      setShown.current = next => { live.current = next; show(n => n + 1) }
      const bound = useRef(false)
      const lifecycle = useSharedDocument<T>({
        appSlug: 'test',
        suffix: '.package',
        kind: 'package',
        debounceMs: 1,
        contentFile: config.contentFile,
        parse: config.parse,
        read: async path => {
          await tick()
          const text = fakeShell.files.get(path)
          if (text === undefined) throw new Error(`No file ${path}`)
          return text
        },
        live: () => live.current,
        showMerged: document => setShown.current(document),
        merge: config.merge,
        reload: () => setShown.current(config.parse(fakeShell.files.get(`${PATH}/${config.contentFile}`)!)),
        serialize: () => { fakeShell.writer = name; return config.files(live.current) as never },
      })
      if (!bound.current) { bound.current = true; queueMicrotask(() => lifecycle.adopt(PATH)) }
      into.current = lifecycle
      return null
    }
    const node = document.createElement('div')
    const root = createRoot(node)
    roots.push(root)
    fakeShell.mounting = name
    await act(async () => { root.render(<Host into={handle} />) })
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
    const settle = async () => {
      for (let round = 0, quiet = 0; round < 200 && quiet < 8; round++) {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 2)) })
        quiet = handle.current?.doc.saving ? 0 : quiet + 1
      }
    }
    return {
      name,
      document: () => live.current,
      edit: async change => {
        await act(async () => {
          setShown.current(change(live.current))
          handle.current!.markDirty()
        })
      },
      change: change => {
        setShown.current(change(live.current))
        handle.current!.markDirty()
      },
      settled: settle,
      lifecycle: () => handle.current!,
    }
  }
  const a = await mount('a'), b = await mount('b')
  const settled = async () => { await a.settled(); await b.settled(); await a.settled(); await b.settled() }
  return {
    a, b, settled,
    /** Both change it in the same moment, before either has heard of the other. */
    together: async (fromA: (document: T) => T, fromB: (document: T) => T) => {
      await act(async () => { a.change(fromA); b.change(fromB) })
    },
    onDisk: () => config.parse(fakeShell.files.get(`${PATH}/${config.contentFile}`)!),
    /** Copies that disagree with the file after everything settled. */
    close: async () => { await act(async () => { for (const root of roots) root.unmount() }) },
  }
}
