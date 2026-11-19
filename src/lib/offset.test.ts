import { describe, it, expect } from 'vitest'
import { calculateOffset, offsetChart } from './offset'

describe('offsetChart', () => {
  it('lists every common angle with chart and exact multipliers', () => {
    const rows = offsetChart()
    expect(rows.map((r) => r.angle)).toEqual([10, 22.5, 30, 45, 60])
    const row45 = rows.find((r) => r.angle === 45)!
    expect(row45.chartMultiplier).toBe(1.4)
    expect(row45.exactMultiplier).toBeCloseTo(1.414, 3)
    expect(row45.distanceBetweenBends).toBeUndefined()
  })

  it('works out between-bends and shrink for a given depth', () => {
    const row30 = offsetChart(6).find((r) => r.angle === 30)!
    expect(row30.distanceBetweenBends).toBeCloseTo(12)
    expect(row30.totalShrink).toBeCloseTo(1.5)
  })
})

describe('calculateOffset', () => {
  it('30° offset: multiplier is 2, so a 6" offset has 12" between bends', () => {
    const r = calculateOffset({ depth: 6, angle: 30 })
    expect(r.multiplier).toBeCloseTo(2)
    expect(r.distanceBetweenBends).toBeCloseTo(12)
    expect(r.totalShrink).toBeCloseTo(1.5) // 1/4" per inch × 6"
    expect(r.shrinkSource).toBe('field chart')
  })

  it('45° offset uses multiplier ≈ 1.414 and 3/8" shrink per inch', () => {
    const r = calculateOffset({ depth: 4, angle: 45 })
    expect(r.multiplier).toBeCloseTo(1.414, 3)
    expect(r.totalShrink).toBeCloseTo(1.5)
  })

  it('10° offset multiplier is ≈ 5.76', () => {
    expect(calculateOffset({ depth: 2, angle: 10 }).multiplier).toBeCloseTo(5.759, 3)
  })

  it('falls back to trig for angles not on the chart', () => {
    const r = calculateOffset({ depth: 10, angle: 15 })
    expect(r.shrinkSource).toBe('trig')
    expect(r.shrinkPerInch).toBeCloseTo(Math.tan((7.5 * Math.PI) / 180))
  })

  it('places marks when bending toward an obstacle', () => {
    // 6" offset at 30°, obstacle 48" from the end of the pipe
    const r = calculateOffset({ depth: 6, angle: 30, distanceToObstacle: 48 })
    expect(r.marks?.second).toBeCloseTo(49.5) // 48 + 1.5 shrink
    expect(r.marks?.first).toBeCloseTo(37.5) // 49.5 − 12
  })

  it('includes mark steps only when a distance is given', () => {
    expect(calculateOffset({ depth: 6, angle: 30 }).steps).toHaveLength(3)
    expect(calculateOffset({ depth: 6, angle: 30, distanceToObstacle: 48 }).steps).toHaveLength(5)
  })

  it('rejects bad input', () => {
    expect(() => calculateOffset({ depth: 0, angle: 30 })).toThrow()
    expect(() => calculateOffset({ depth: 6, angle: 90 })).toThrow()
    expect(() => calculateOffset({ depth: 6, angle: -5 })).toThrow()
  })
})
