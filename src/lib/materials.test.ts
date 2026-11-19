import { describe, it, expect } from 'vitest'
import { materialList, strapsFor } from './materials'

const value = (r: ReturnType<typeof materialList>, label: string) => r.headline!.find((h) => h.label.includes(label))!.value

describe('strapsFor (within 3 ft of each end, every 10 ft between)', () => {
  it.each([
    [48, 1], // 4 ft: one strap covers both ends
    [72, 1], // 6 ft
    [120, 2], // 10 ft
    [192, 2], // 16 ft: 3' + 10' + 3'
    [193, 3],
    [1020, 9], // 85 ft
  ])('%d" run → %d straps', (run, straps) => {
    expect(strapsFor(run)).toBe(straps)
  })
})

describe('materialList', () => {
  const base = { run: 85 * 12, size: '3/4', terminations: 2, nineties: 2, wires: 0, waste: 0.1 }

  it('85 ft run with 10% waste: 10 sticks, 9 couplings, 2 connectors, 9 straps', () => {
    const r = materialList(base)
    expect(value(r, 'sticks')).toBe('10')
    expect(value(r, 'couplings')).toBe('9')
    expect(value(r, 'connectors')).toBe('2')
    expect(value(r, 'straps')).toBe('9')
  })

  it('no waste: exactly 3 sticks for 30 ft', () => {
    expect(value(materialList({ ...base, run: 360, waste: 0 }), 'sticks')).toBe('3')
  })

  it('adds wire with 1 ft makeup per box, rounded up to 5 ft', () => {
    // (85 + 2) ft × 1.1 = 95.7 → 100 ft each × 3 wires
    const r = materialList({ ...base, wires: 3 })
    expect(value(r, 'Wire')).toBe('300 ft')
  })

  it('warns over 360° of bends', () => {
    expect(materialList({ ...base, nineties: 4 }).warning).toBeUndefined()
    expect(materialList({ ...base, nineties: 5 }).warning).toMatch(/360/)
  })

  it('rejects a zero-length run', () => {
    expect(() => materialList({ ...base, run: 0 })).toThrow()
  })
})
