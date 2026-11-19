import { describe, it, expect } from 'vitest'
import { stubUp, backToBack, kick, threePointSaddle, fourPointSaddle, rollingOffset } from './bends'

describe('stubUp', () => {
  it('subtracts the take-up: 14" stub on 1/2" EMT (5" take-up) → mark at 9"', () => {
    const r = stubUp(14, '1/2')
    expect(r.marks[0].at).toBe(9)
    expect(r.warning).toBeUndefined()
  })

  it('uses the right take-up for each bender', () => {
    expect(stubUp(20, '3/4').marks[0].at).toBe(14)
    expect(stubUp(20, '1').marks[0].at).toBe(12)
  })

  it('warns when the stub is shorter than the take-up', () => {
    const r = stubUp(4, '1/2')
    expect(r.marks).toHaveLength(0)
    expect(r.warning).toMatch(/too short/)
  })

  it('rejects unknown benders', () => {
    expect(() => stubUp(10, '2')).toThrow()
  })
})

describe('backToBack', () => {
  it('first mark is a stub-up; second is the out-to-out distance from the back of the first 90', () => {
    const r = backToBack(10, 36, '1/2')
    expect(r.marks[0]).toMatchObject({ at: 5, fromEnd: true })
    expect(r.marks[1]).toMatchObject({ at: 36, fromEnd: false })
  })
})

describe('kick', () => {
  it('30° kick of 4": 8" of pipe after the bend', () => {
    const r = kick(4, 30)
    expect(r.stats[0].value).toBe('8"')
    expect(r.stats[1].value).toBe('6-15/16"') // 4 ÷ tan 30° = 6.928
  })
})

describe('threePointSaddle', () => {
  it('45° saddle over a 2" pipe: outer marks 5" from center, 3/8" shrink', () => {
    const r = threePointSaddle(2, '45', 30)
    expect(r.marks.map((m) => m.at)).toEqual([25.375, 30.375, 35.375])
  })

  it('60° saddle uses 2× spacing and 1/4" shrink per inch', () => {
    const r = threePointSaddle(4, '60', 40)
    expect(r.marks.map((m) => m.at)).toEqual([33, 41, 49])
  })

  it('gives spacing without marks when no distance is entered', () => {
    const r = threePointSaddle(2, '45')
    expect(r.marks).toHaveLength(0)
    expect(r.stats[0].value).toBe('5"')
  })

  it('warns when the first mark falls off the pipe', () => {
    expect(threePointSaddle(6, '45', 5).warning).toBeDefined()
  })
})

describe('fourPointSaddle', () => {
  it('4" high, 10" wide box, 48" away, 30° bends', () => {
    // between bends = 8, shrink = 1 (1/4" × 4)
    const r = fourPointSaddle(4, 10, 48, 30)
    // toBeCloseTo, not toEqual: trig gives values like 8.000000000000002
    ;[41, 49, 59, 67].forEach((expected, i) => expect(r.marks[i].at).toBeCloseTo(expected))
    expect(r.warning).toBeUndefined()
  })
})

describe('rollingOffset', () => {
  it('uses the true offset from a 3-4-5 triangle', () => {
    const r = rollingOffset(3, 4, 30, 48)
    expect(r.stats[0].value).toBe('5"')
    // 5" true offset at 30°: between = 10, shrink = 1.25 → marks 39.25 and 49.25
    expect(r.marks[0].at).toBeCloseTo(39.25)
    expect(r.marks[1].at).toBeCloseTo(49.25)
  })

  it('works without a distance (no marks yet)', () => {
    expect(rollingOffset(6, 8, 45).marks).toHaveLength(0)
  })
})
