import { describe, it, expect } from 'vitest'
import { parseLength, formatLength } from './measure'

describe('parseLength', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['5-3/8', 5.375],
    ['5 3/8', 5.375],
    ['3/8', 0.375],
    ["7'", 84],
    ["7'5", 89],
    [`7' 5-3/8"`, 89.375],
    ['7ft 5in', 89],
    [' 4" ', 4],
  ])('parses %s as %d inches', (input, expected) => {
    expect(parseLength(input)).toBeCloseTo(expected)
  })

  it.each(['', 'abc', '5/0', '5--', "'"])('rejects %j', (input) => {
    expect(parseLength(input)).toBeNull()
  })
})

describe('formatLength', () => {
  it.each([
    [5.375, '5-3/8"'],
    [0.375, '3/8"'],
    [12, `1' 0"`],
    [89.375, `7' 5-3/8"`],
    [6, '6"'],
    [5.99, '6"'], // rounds up cleanly instead of showing 5-16/16"
    [-2.5, '-2-1/2"'],
  ])('formats %d as %s', (input, expected) => {
    expect(formatLength(input)).toBe(expected)
  })

  it('round-trips with parseLength', () => {
    expect(parseLength(formatLength(89.375))).toBeCloseTo(89.375)
  })
})
