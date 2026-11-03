/**
 * Two live copies of the app can change one document in the same moment. This takes what each did since they last agreed
 * and keeps both: fields by name, lists of things with ids by id. A change on one side beats no change on the other. Where
 * both changed the very same value, the copy merging keeps its own, as it is the one saving now. An edit beats a removal,
 * so nothing somebody just worked on disappears.
 */
export interface MergeOptions {
  /** The id of an item in a list, for lists whose items are not `{ id }`. */
  idOf?: (item: unknown) => string | null
  /** Fields that belong to each copy (what is on screen here): never taken from the other. By path, as 'a.b'. */
  ownFields?: readonly string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)
const plainId = (item: unknown): string | null => (isRecord(item) && typeof item.id === 'string' ? item.id : null)

export function threeWayMerge<T>(base: T, local: T, remote: T, options: MergeOptions = {}): T {
  const idOf = options.idOf ?? plainId
  const own = new Set(options.ownFields ?? [])

  const mergeList = (b: unknown[], l: unknown[], r: unknown[], path: string): unknown[] => {
    const byId = (list: unknown[]) => new Map(list.map(item => [idOf(item)!, item]))
    const inBase = byId(b), inLocal = byId(l), inRemote = byId(r)
    const kept = (id: string): unknown => {
      const here = inLocal.get(id), there = inRemote.get(id), was = inBase.get(id)
      if (here !== undefined && there !== undefined) return merge(was, here, there, path)
      // On one side only. Added there, or taken away by the other: taken away only if this side did not change it since.
      const only = here ?? there
      return was !== undefined && same(was, only) ? undefined : only
    }
    const result: unknown[] = []
    for (const item of l) {
      const id = idOf(item)!
      const value = kept(id)
      if (value !== undefined) result.push(value)
    }
    // What the other copy has and this one does not goes after the item it came after there.
    r.forEach((item, index) => {
      const id = idOf(item)!
      if (inLocal.has(id)) return
      const value = kept(id)
      if (value === undefined) return
      const before = index > 0 ? idOf(r[index - 1]) : null
      const at = before === null ? 0 : result.findIndex(entry => idOf(entry) === before) + 1
      result.splice(at > 0 || before === null ? at : result.length, 0, value)
    })
    return result
  }

  const merge = (b: unknown, l: unknown, r: unknown, path: string): unknown => {
    if (own.has(path)) return l
    const holdsOwn = isRecord(l) && isRecord(r) && [...own].some(field => path === '' || field.startsWith(`${path}.`))
    if (!holdsOwn) {
      if (same(l, r) || same(b, r)) return l
      if (same(b, l)) return r
    }
    if (isRecord(l) && isRecord(r)) {
      const was = isRecord(b) ? b : {}
      const result: Record<string, unknown> = {}
      for (const key of new Set([...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(was[key], l[key], r[key], path ? `${path}.${key}` : key)
        if (value !== undefined) result[key] = value
      }
      return result
    }
    if (Array.isArray(l) && Array.isArray(r)) {
      const was = Array.isArray(b) ? b : []
      if ([...was, ...l, ...r].every(item => idOf(item) !== null)) return mergeList(was, l, r, path)
    }
    return l
  }
  return merge(base, local, remote, '') as T
}
