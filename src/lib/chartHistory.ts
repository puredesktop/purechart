/** Immutable snapshots retain structural sharing with the document. */
export class ChartHistory<T> {
  private past: T[] = []
  private future: T[] = []
  private group: string | undefined
  private changedAt = 0
  constructor(private readonly limit = 100) {}
  get canUndo(): boolean { return this.past.length > 0 }
  get canRedo(): boolean { return this.future.length > 0 }
  record(previous: T, group?: string, now = Date.now()): void {
    if (!group || group !== this.group || now - this.changedAt > 700) {
      this.past.push(previous)
      if (this.past.length > this.limit) this.past.shift()
    }
    this.group = group
    this.changedAt = now
    this.future = []
  }
  undo(current: T): T | undefined {
    if (!this.canUndo) return undefined
    this.future.push(current)
    this.group = undefined
    return this.past.pop()
  }
  redo(current: T): T | undefined {
    if (!this.canRedo) return undefined
    this.past.push(current)
    this.group = undefined
    return this.future.pop()
  }
  reset(): void {
    this.past = []
    this.future = []
    this.group = undefined
  }
}
