import { expect, it } from 'vitest'
import { wrapNotice } from './chartNotice'

it('wraps words and splits tokens that exceed the available width', () => {
  expect(wrapNotice('  one   two three ', 7 * 6.6)).toEqual(['one two', 'three'])
  expect(wrapNotice('abcdefghij end', 4 * 6.6)).toEqual(['abcd', 'efgh', 'ij', 'end'])
  expect(wrapNotice('', 100)).toEqual([])
  expect(wrapNotice('abc', 0)).toEqual(['a', 'b', 'c'])
})
