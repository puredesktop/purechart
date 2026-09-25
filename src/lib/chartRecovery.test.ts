import { beforeEach, expect, it } from 'vitest'
import { readRecoveries, recoveryMatches, removeRecovery, writeRecovery } from './chartRecovery'
import { emptySheet, serializeSheet } from './chartSheet'
beforeEach(() => localStorage.clear())
it('retains full sheets independently from saved files and ignores corrupt entries', () => {
  const entry = { id: 'tab-a', path: '/original.chart', updatedAt: 123, sheet: emptySheet('Work') }
  writeRecovery(localStorage, entry)
  localStorage.setItem('purechart:recovery:bad', 'not JSON')
  expect(readRecoveries(localStorage)).toEqual([entry])
  expect(recoveryMatches(entry, serializeSheet(entry.sheet))).toBe(true)
  expect(recoveryMatches(entry, serializeSheet(emptySheet('Older save')))).toBe(false)
  removeRecovery(localStorage, entry.id)
  expect(readRecoveries(localStorage)).toEqual([])
})
it('does not overwrite another tab recovery', () => {
  writeRecovery(localStorage, { id: 'a', path: null, updatedAt: 10, sheet: emptySheet('A') })
  writeRecovery(localStorage, { id: 'b', path: null, updatedAt: 20, sheet: emptySheet('B') })
  expect(readRecoveries(localStorage).map(entry => entry.sheet.title)).toEqual(['B', 'A'])
  removeRecovery(localStorage, 'a')
  expect(readRecoveries(localStorage).map(entry => entry.sheet.title)).toEqual(['B'])
})

it('filters held and pending owners and the current window from recovery candidates', async () => {
  const { availableRecoveries, recoveryLockName } = await import('./chartRecovery')
  for (const id of ['live', 'mounting', 'self', 'crashed']) writeRecovery(localStorage, { id, path: null, updatedAt: 10, sheet: emptySheet(id) })
  const locks = { query: async () => ({ held: [{ name: recoveryLockName('live') }], pending: [{ name: recoveryLockName('mounting') }] }) } as unknown as LockManager
  expect((await availableRecoveries(localStorage, locks, 'self')).map(entry => entry.id)).toEqual(['crashed'])
  await expect(availableRecoveries(localStorage, undefined, 'self')).rejects.toThrow('Web Locks')
})
