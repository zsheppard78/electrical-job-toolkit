import { describe, it, expect } from 'vitest'
import { evaluateTape } from './tape'

describe('evaluateTape', () => {
  it.each([
    [`7' 5-3/8" - 2' 11-3/4"`, 53.625], // 4' 5-5/8"
    [`10' / 2`, 60],
    [`14-1/2 x 3`, 43.5],
    [`5 - 3/8`, 4.625], // spaces = subtraction
    [`5-3/8`, 5.375], // no spaces = five and three-eighths
    [`3' + 4' 6" + 11-1/4`, 101.25],
    [`2 - 5`, -3],
  ])('%s = %d inches', (expr, expected) => {
    expect(evaluateTape(expr).inches).toBeCloseTo(expected)
  })

  it.each(['', 'abc', `10' / 0`, `4' x 2'`, '5 +'])('rejects %j', (expr) => {
    expect(() => evaluateTape(expr)).toThrow()
  })
})
