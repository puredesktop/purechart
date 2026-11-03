/**
 * Two live copies over one package, as the shell keeps them: the real document lifecycle and the real conditional write
 * rule (a save names the revision it last saw, and is refused if the file has moved on), and a change is told to every
 * copy but the one that made it. Every call takes a turn of the event loop.
 */
export const fakeShell = {
  files: new Map<string, string>(),
  listeners: new Set<{ copy: string | null; listen: (change: { kind: string; path: string }) => void }>(),
  writer: null as string | null,
  mounting: null as string | null,
  writes: 0,
  reset() { this.files.clear(); this.listeners.clear(); this.writer = null; this.mounting = null; this.writes = 0 },
}
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

export const fakeDocumentsModule = {
  autosavePlatformDocument: async (request: { path: string; files: { name: string | null; content: string }[]; revision?: { file: string; field: string; expected: string | null } }) => {
    const writer = fakeShell.writer
    await tick()
    if (request.revision) {
      const text = fakeShell.files.get(`${request.path}/${request.revision.file}`)
      const actual = text ? (JSON.parse(text) as Record<string, unknown>)[request.revision.field] ?? null : null
      if (actual !== request.revision.expected) throw new Error('Save conflict: this document changed in another window.')
    }
    for (const file of request.files) fakeShell.files.set(`${request.path}/${file.name}`, file.content)
    fakeShell.writes++
    for (const listener of fakeShell.listeners) if (listener.copy !== writer) listener.listen({ kind: 'content', path: request.path })
    return { savedAt: new Date().toISOString() }
  },
  createPlatformDraft: async () => ({ path: '/Drafts/new' }),
  duplicatePlatformDocument: async () => ({ path: '/Drafts/copy' }),
  onPlatformDocumentsChanged: (listen: (change: { kind: string; path: string }) => void) => {
    const entry = { copy: fakeShell.mounting, listen }
    fakeShell.listeners.add(entry)
    return () => { fakeShell.listeners.delete(entry) }
  },
  promotePlatformDocument: async (request: { path: string }) => ({ path: request.path }),
  renamePlatformDocument: async (request: { path: string }) => ({ path: request.path }),
  touchPlatformRecentDocument: async () => undefined,
}
export const fakeWorkspaceModule = { updateCurrentWorkspaceTab: async () => ({ updated: true }) }
export const fakeClientModule = { bridge: { call: async () => undefined, onEvent: () => () => undefined } }
