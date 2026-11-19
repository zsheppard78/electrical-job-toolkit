import { describe, it, expect } from 'vitest'
import { boxFill, conduitFill, fillLimit, usableAmpacity, voltageDrop, voltageDropFor } from './electrical'

describe('conduitFill', () => {
  it('uses 53% / 31% / 40% fill limits by wire count', () => {
    expect(fillLimit(1)).toBe(0.53)
    expect(fillLimit(2)).toBe(0.31)
    expect(fillLimit(3)).toBe(0.4)
    expect(fillLimit(20)).toBe(0.4)
  })

  it('three #12 THHN fit in 1/2" EMT', () => {
    expect(conduitFill({ '12': 3 }).headline![0].value).toBe('1/2"')
  })

  it('flags an overfilled pipe and suggests the right size', () => {
    // 9 × #12 + 3 × #10 = 0.1830 sq in; 1/2" allows 0.1216, 3/4" allows 0.2132
    const r = conduitFill({ '12': 9, '10': 3 }, '1/2')
    expect(r.headline![0].value).toBe('3/4"')
    expect(r.headline![1].good).toBe(false)
    expect(r.warning).toMatch(/Too full/)
  })

  it('four 4/0 need 2" EMT', () => {
    expect(conduitFill({ '4/0': 4 }).headline![0].value).toBe('2"')
  })

  it('requires at least one wire', () => {
    expect(() => conduitFill({})).toThrow()
  })
})

describe('voltageDrop', () => {
  const base = { amps: 16, feet: 150, volts: 120, phase: 1 as const, material: 'cu' as const, continuous: false }

  it('matches the hand formula: 2 × 12.9 × 16 × 150 ÷ 6530 = 9.48 V on #12', () => {
    expect(voltageDropFor('12', base).volts).toBeCloseTo(9.48, 2)
  })

  it('recommends the bigger of the ampacity size and the voltage-drop size', () => {
    const r = voltageDrop(base)
    expect(r.headline![0].value).toBe('#6 Cu') // #12 is fine for amps, but 150 ft needs #6 for 3%
  })

  it('short runs are sized by ampacity', () => {
    expect(voltageDrop({ ...base, feet: 20 }).headline![0].value).toBe('#12 Cu')
  })

  it('continuous loads are sized at 125%', () => {
    // 24 A × 1.25 = 30 A → #10 copper
    expect(voltageDrop({ ...base, amps: 24, feet: 10, continuous: true }).headline![0].value).toBe('#10 Cu')
  })

  it('applies 240.4(D) small-conductor limits', () => {
    expect(usableAmpacity('14', 'cu')).toBe(15)
    expect(usableAmpacity('12', 'cu')).toBe(20)
    expect(usableAmpacity('8', 'cu')).toBe(50)
    expect(usableAmpacity('14', 'al')).toBeUndefined()
  })

  it('three-phase uses √3 instead of 2', () => {
    const one = voltageDropFor('8', { ...base, phase: 1 }).volts
    const three = voltageDropFor('8', { ...base, phase: 3 }).volts
    expect(three / one).toBeCloseTo(Math.sqrt(3) / 2)
  })

  it('warns when your chosen wire drops too much', () => {
    expect(voltageDrop({ ...base, chosen: '12' }).warning).toMatch(/over the 3%/)
  })
})

describe('boxFill', () => {
  it('switch box: 6 × #12, grounds, 1 device = 20.25 cu in', () => {
    const r = boxFill({ counts: { '12': 6 }, devices: 1, clamps: false, grounds: true, fixtureStuds: 0, boxId: 'dev-2.5' })
    expect(r.headline![0].value).toBe('20.25 cu in')
    expect(r.headline![1].good).toBe(false) // 12.5 cu in box is too small
  })

  it('mixed sizes: devices, clamps and grounds use the largest wire', () => {
    // 4×#14 (8) + 2×#12 (4.5) + ground 2.25 + clamps 2.25 + 2 devices (9) = 26
    const r = boxFill({ counts: { '14': 4, '12': 2 }, devices: 2, clamps: true, grounds: true, fixtureStuds: 0, boxId: '4sq-2.125' })
    expect(r.headline![0].value).toBe('26 cu in')
    expect(r.headline![1].good).toBe(true)
  })

  it('a marked ring adds volume', () => {
    const r = boxFill({ counts: { '12': 6 }, devices: 1, clamps: false, grounds: true, fixtureStuds: 0, boxId: '4sq-1.5', extraVolume: 3.5 })
    expect(r.headline![1].value).toContain('24.5')
  })
})
