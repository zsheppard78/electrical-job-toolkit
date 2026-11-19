import type { ToolResult } from './bends'

/**
 * Electrical calculators: conduit fill, voltage drop / wire size, box fill.
 *
 * The numbers below are standard NEC table values (we store numbers and cite
 * the table, never the code text). Always check against the code book your
 * jobs are inspected under.
 */

// ---------------------------------------------------------------------------
// Wire data
// ---------------------------------------------------------------------------

export const WIRE_SIZES = ['14', '12', '10', '8', '6', '4', '3', '2', '1', '1/0', '2/0', '3/0', '4/0'] as const
export type WireSize = (typeof WIRE_SIZES)[number]

export const sizeLabel = (s: string) => (s.includes('/') ? `${s}` : `#${s}`)

/** NEC Ch. 9 Table 5: THHN/THWN-2 approximate area, square inches. */
const THHN_AREA: Record<WireSize, number> = {
  '14': 0.0097, '12': 0.0133, '10': 0.0211, '8': 0.0366, '6': 0.0507, '4': 0.0824, '3': 0.0973,
  '2': 0.1158, '1': 0.1562, '1/0': 0.1855, '2/0': 0.2223, '3/0': 0.2679, '4/0': 0.3237,
}

/** NEC Ch. 9 Table 8: conductor area in circular mils. */
const CIRCULAR_MILS: Record<WireSize, number> = {
  '14': 4110, '12': 6530, '10': 10380, '8': 16510, '6': 26240, '4': 41740, '3': 52620,
  '2': 66360, '1': 83690, '1/0': 105600, '2/0': 133100, '3/0': 167800, '4/0': 211600,
}

/** NEC Table 310.16, 75°C column (most terminations are rated 75°C). */
const AMPACITY_75C: Record<'cu' | 'al', Partial<Record<WireSize, number>>> = {
  cu: { '14': 20, '12': 25, '10': 35, '8': 50, '6': 65, '4': 85, '3': 100, '2': 115, '1': 130, '1/0': 150, '2/0': 175, '3/0': 200, '4/0': 230 },
  al: { '12': 20, '10': 30, '8': 40, '6': 50, '4': 65, '3': 75, '2': 90, '1': 100, '1/0': 120, '2/0': 135, '3/0': 155, '4/0': 180 },
}

/** NEC 240.4(D): small-conductor breaker limits that cap the usable ampacity. */
const SMALL_CONDUCTOR_LIMIT: Record<'cu' | 'al', Partial<Record<WireSize, number>>> = {
  cu: { '14': 15, '12': 20, '10': 30 },
  al: { '12': 15, '10': 25 },
}

export function usableAmpacity(size: WireSize, material: 'cu' | 'al'): number | undefined {
  const table = AMPACITY_75C[material][size]
  if (table === undefined) return undefined
  return Math.min(table, SMALL_CONDUCTOR_LIMIT[material][size] ?? Infinity)
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

// ---------------------------------------------------------------------------
// Conduit fill
// ---------------------------------------------------------------------------

export const EMT_SIZES = ['1/2', '3/4', '1', '1-1/4', '1-1/2', '2', '2-1/2', '3', '3-1/2', '4'] as const
export type EmtSize = (typeof EMT_SIZES)[number]

/** NEC Ch. 9 Table 4: EMT total internal area (100%), square inches. */
const EMT_AREA: Record<EmtSize, number> = {
  '1/2': 0.304, '3/4': 0.533, '1': 0.864, '1-1/4': 1.496, '1-1/2': 2.036,
  '2': 3.356, '2-1/2': 5.858, '3': 8.846, '3-1/2': 11.545, '4': 14.753,
}

/** NEC Ch. 9 Table 1: 1 wire 53%, 2 wires 31%, 3 or more 40%. */
export function fillLimit(wireCount: number) {
  return wireCount === 1 ? 0.53 : wireCount === 2 ? 0.31 : 0.4
}

export function conduitFill(counts: Partial<Record<WireSize, number>>, chosen?: EmtSize): ToolResult {
  const entries = WIRE_SIZES.filter((s) => (counts[s] ?? 0) > 0).map((s) => ({ size: s, count: counts[s]!, area: THHN_AREA[s] }))
  const wireCount = entries.reduce((n, e) => n + e.count, 0)
  if (wireCount === 0) throw new Error('Add at least one wire')

  const wireArea = entries.reduce((sum, e) => sum + e.count * e.area, 0)
  const limit = fillLimit(wireCount)
  const smallest = EMT_SIZES.find((s) => wireArea <= EMT_AREA[s] * limit)

  const steps = [
    ...entries.map((e) => ({
      title: `${e.count} × ${sizeLabel(e.size)} THHN`,
      detail: `${e.count} × ${e.area} sq in = ${(e.count * e.area).toFixed(4)} sq in (NEC Ch. 9 Table 5)`,
    })),
    { title: 'Total wire area', detail: `${wireArea.toFixed(4)} sq in` },
    {
      title: 'Fill limit',
      detail: `${wireCount} wire${wireCount === 1 ? '' : 's'} → max ${limit * 100}% of the pipe (NEC Ch. 9 Table 1)`,
    },
  ]

  if (!smallest) {
    return {
      marks: [],
      headline: [{ label: 'Smallest EMT', value: 'Over 4"', good: false }],
      stats: [{ label: 'Wire area', value: `${wireArea.toFixed(3)} sq in` }],
      howToBend: [],
      steps,
      warning: 'These wires need more than 4" EMT. Split them into more than one pipe.',
    }
  }

  steps.push({
    title: 'Smallest EMT that fits',
    detail: `${smallest}" EMT: ${EMT_AREA[smallest]} sq in × ${limit * 100}% = ${(EMT_AREA[smallest] * limit).toFixed(3)} sq in allowed ≥ ${wireArea.toFixed(3)} sq in`,
  })

  const headline: NonNullable<ToolResult['headline']> = [{ label: 'Smallest EMT that works', value: `${smallest}"`, good: true }]
  const stats = [
    { label: 'Wires', value: String(wireCount) },
    { label: 'Wire area', value: `${wireArea.toFixed(3)} sq in` },
  ]
  let warning: string | undefined

  if (chosen) {
    const fill = wireArea / EMT_AREA[chosen]
    const ok = fill <= limit
    headline.push({ label: `${chosen}" EMT is`, value: `${pct(fill)} full`, good: ok })
    stats.push({ label: `Allowed in ${chosen}"`, value: `${limit * 100}%` })
    steps.push({
      title: `Your ${chosen}" EMT`,
      detail: `${wireArea.toFixed(4)} ÷ ${EMT_AREA[chosen]} = ${pct(fill)} → ${ok ? 'OK' : `over the ${limit * 100}% limit`}`,
    })
    if (!ok) warning = `Too full: ${chosen}" EMT is ${pct(fill)} full. Max is ${limit * 100}%. Go up to ${smallest}".`
  }

  return {
    marks: [],
    headline,
    stats,
    howToBend: [
      'Assumes THHN/THWN-2 wire in EMT. Count insulated grounds as wires.',
      'Even when it\'s legal, a pipe near the limit is a hard pull, especially with lots of bends. Going up a size is cheap insurance.',
      'Short nipples (24" or less) are allowed 60% fill.',
    ],
    notesTitle: 'Good to know',
    steps,
    warning,
  }
}

// ---------------------------------------------------------------------------
// Voltage drop / wire size
// ---------------------------------------------------------------------------

/** K = resistance of a 1 circular-mil-foot conductor (ohms). */
const K = { cu: 12.9, al: 21.2 } as const

export interface VoltageDropInput {
  amps: number
  /** One-way distance from panel to load, in feet */
  feet: number
  volts: number
  phase: 1 | 3
  material: 'cu' | 'al'
  /** Continuous load (3+ hours): wire must be sized at 125% */
  continuous: boolean
  /** Wire size the user plans to use (optional) */
  chosen?: WireSize
  /** Allowed voltage drop, e.g. 0.03 */
  maxDrop?: number
}

export function voltageDropFor(size: WireSize, i: VoltageDropInput) {
  const factor = i.phase === 1 ? 2 : Math.sqrt(3)
  const volts = (factor * K[i.material] * i.amps * i.feet) / CIRCULAR_MILS[size]
  return { volts, percent: volts / i.volts }
}

export function voltageDrop(i: VoltageDropInput): ToolResult {
  if (!(i.amps > 0)) throw new Error('Amps must be greater than 0')
  if (!(i.feet > 0)) throw new Error('Distance must be greater than 0')
  const maxDrop = i.maxDrop ?? 0.03
  const sizes = WIRE_SIZES.filter((s) => usableAmpacity(s, i.material) !== undefined)

  const neededAmps = i.continuous ? i.amps * 1.25 : i.amps
  const forAmpacity = sizes.find((s) => usableAmpacity(s, i.material)! >= neededAmps)
  const forDrop = sizes.find((s) => voltageDropFor(s, i).percent <= maxDrop)
  const mat = i.material === 'cu' ? 'copper' : 'aluminum'

  const factorText = i.phase === 1 ? '2' : '1.732'
  const steps = [
    {
      title: 'Formula',
      detail: `VD = ${factorText} × K × amps × feet ÷ circular mils. K = ${K[i.material]} for ${mat}. (${i.phase === 1 ? 'Single-phase uses 2' : 'Three-phase uses √3 = 1.732'}.)`,
    },
    {
      title: 'Ampacity needed',
      detail: i.continuous
        ? `Continuous load: ${i.amps} A × 125% = ${neededAmps} A (NEC 210.19)`
        : `${i.amps} A (not continuous)`,
    },
  ]

  if (forAmpacity) {
    steps.push({ title: 'Smallest wire for the amps', detail: `${sizeLabel(forAmpacity)} ${mat}: ${usableAmpacity(forAmpacity, i.material)} A at 75°C (NEC 310.16, 240.4(D))` })
  }
  if (forDrop) {
    const d = voltageDropFor(forDrop, i)
    steps.push({
      title: `Smallest wire for ${maxDrop * 100}% drop`,
      detail: `${sizeLabel(forDrop)}: ${factorText} × ${K[i.material]} × ${i.amps} × ${i.feet} ÷ ${CIRCULAR_MILS[forDrop].toLocaleString()} = ${d.volts.toFixed(2)} V (${pct(d.percent)} of ${i.volts} V)`,
    })
  }

  if (!forAmpacity || !forDrop) {
    return {
      marks: [],
      headline: [{ label: 'Recommended wire', value: 'Over 4/0', good: false }],
      stats: [],
      howToBend: [],
      steps,
      warning: 'This needs bigger than 4/0 (or parallel runs). Talk to your foreman.',
    }
  }

  // Use whichever requirement needs the bigger wire.
  const recommended = WIRE_SIZES.indexOf(forDrop) > WIRE_SIZES.indexOf(forAmpacity) ? forDrop : forAmpacity
  const recDrop = voltageDropFor(recommended, i)
  steps.push({
    title: 'Pick the bigger of the two',
    detail: `Amps need ${sizeLabel(forAmpacity)}, voltage drop needs ${sizeLabel(forDrop)} → use ${sizeLabel(recommended)}`,
  })

  const headline: NonNullable<ToolResult['headline']> = [
    { label: 'Recommended wire', value: `${sizeLabel(recommended)} ${i.material === 'cu' ? 'Cu' : 'Al'}`, good: true },
  ]
  const stats = [
    { label: 'Voltage drop', value: `${recDrop.volts.toFixed(2)} V` },
    { label: 'Percent drop', value: pct(recDrop.percent) },
    { label: 'Sized for amps', value: sizeLabel(forAmpacity) },
    { label: 'Sized for drop', value: sizeLabel(forDrop) },
  ]

  let warning: string | undefined
  if (i.chosen) {
    const amp = usableAmpacity(i.chosen, i.material)
    const d = voltageDropFor(i.chosen, i)
    const ampOk = amp !== undefined && amp >= neededAmps
    const dropOk = d.percent <= maxDrop
    headline.push({ label: `Your ${sizeLabel(i.chosen)} drops`, value: `${d.volts.toFixed(2)} V (${pct(d.percent)})`, good: ampOk && dropOk })
    if (amp === undefined) warning = `${sizeLabel(i.chosen)} ${mat} isn't used for branch circuits.`
    else if (!ampOk) warning = `${sizeLabel(i.chosen)} ${mat} is only good for ${amp} A. You need ${neededAmps} A.`
    else if (!dropOk) warning = `${sizeLabel(i.chosen)} drops ${pct(d.percent)}, over the ${maxDrop * 100}% target. Go up to ${sizeLabel(recommended)}.`
  }

  return {
    marks: [],
    headline,
    stats,
    howToBend: [
      'Uses the 75°C column, 3 or fewer current-carrying wires, normal temperatures. More wires in a pipe or a hot location means derating.',
      'The 3% branch / 5% total voltage-drop numbers are NEC recommendations (informational notes), not hard rules. Specs often require them.',
      'Distance is one way, from the panel to the load.',
    ],
    notesTitle: 'Good to know',
    steps,
    warning,
  }
}

// ---------------------------------------------------------------------------
// Box fill
// ---------------------------------------------------------------------------

export const BOX_SIZES = [
  { id: '4sq-1.5', label: '4" sq × 1-1/2"', volume: 21.0 },
  { id: '4sq-2.125', label: '4" sq × 2-1/8"', volume: 30.3 },
  { id: '411sq-1.5', label: '4-11/16" sq × 1-1/2"', volume: 29.5 },
  { id: '411sq-2.125', label: '4-11/16" sq × 2-1/8"', volume: 42.0 },
  { id: '4oct-1.5', label: '4" oct × 1-1/2"', volume: 15.5 },
  { id: '4oct-2.125', label: '4" oct × 2-1/8"', volume: 21.5 },
  { id: 'dev-2.5', label: '3×2×2-1/2" device', volume: 12.5 },
  { id: 'dev-3.5', label: '3×2×3-1/2" device', volume: 18.0 },
  { id: 'handy', label: '4×2-1/8×1-7/8" handy', volume: 13.0 },
] as const

/** NEC Table 314.16(B): cubic inches per conductor. */
const VOLUME_PER_CONDUCTOR: Partial<Record<WireSize, number>> = {
  '14': 2.0, '12': 2.25, '10': 2.5, '8': 3.0, '6': 5.0,
}
export const BOX_WIRE_SIZES = ['14', '12', '10', '8', '6'] as const

export interface BoxFillInput {
  /** Insulated conductors entering the box (not counting grounds), by size */
  counts: Partial<Record<WireSize, number>>
  devices: number
  clamps: boolean
  grounds: boolean
  fixtureStuds: number
  boxId?: string
  /** Extra marked volume, e.g. a plaster ring */
  extraVolume?: number
}

export function boxFill(i: BoxFillInput): ToolResult {
  const sizes = BOX_WIRE_SIZES.filter((s) => (i.counts[s] ?? 0) > 0)
  if (sizes.length === 0) throw new Error('Add at least one wire')
  const largest = sizes[sizes.length - 1] // sizes run small → big
  const largestVol = VOLUME_PER_CONDUCTOR[largest]!

  const lines: { title: string; detail: string; volume: number }[] = sizes.map((s) => {
    const n = i.counts[s]!
    const v = VOLUME_PER_CONDUCTOR[s]!
    return { title: `${n} × ${sizeLabel(s)} wires`, detail: `${n} × ${v} cu in`, volume: n * v }
  })
  if (i.grounds) lines.push({ title: 'Grounds (all together count as 1)', detail: `1 × ${largestVol} cu in`, volume: largestVol })
  if (i.clamps) lines.push({ title: 'Internal clamps (all together count as 1)', detail: `1 × ${largestVol} cu in`, volume: largestVol })
  if (i.devices > 0)
    lines.push({ title: `${i.devices} device${i.devices > 1 ? 's' : ''} (each counts as 2)`, detail: `${i.devices} × 2 × ${largestVol} cu in`, volume: i.devices * 2 * largestVol })
  if (i.fixtureStuds > 0)
    lines.push({ title: `${i.fixtureStuds} fixture stud/hickey (each counts as 1)`, detail: `${i.fixtureStuds} × ${largestVol} cu in`, volume: i.fixtureStuds * largestVol })

  const required = lines.reduce((sum, l) => sum + l.volume, 0)
  const smallestBox = [...BOX_SIZES].sort((a, b) => a.volume - b.volume).find((b) => b.volume >= required)

  const steps = [
    ...lines.map((l) => ({ title: l.title, detail: `${l.detail} = ${l.volume} cu in` })),
    { title: 'Total needed', detail: `${required} cu in (NEC 314.16(B)). Devices, clamps, grounds and studs use the largest wire size, ${sizeLabel(largest)}.` },
  ]

  const headline: NonNullable<ToolResult['headline']> = [{ label: 'Box volume needed', value: `${required} cu in`, good: true }]
  let warning: string | undefined

  if (i.boxId) {
    const box = BOX_SIZES.find((b) => b.id === i.boxId)
    if (box) {
      const total = box.volume + (i.extraVolume ?? 0)
      const ok = total >= required
      headline.push({ label: box.label + (i.extraVolume ? ` + ${i.extraVolume} ring` : ''), value: `${total} cu in ${ok ? '✓' : '✗'}`, good: ok })
      steps.push({ title: 'Your box', detail: `${box.volume}${i.extraVolume ? ` + ${i.extraVolume}` : ''} = ${total} cu in ${ok ? '≥' : '<'} ${required} needed` })
      if (!ok) warning = `Too small: needs ${required} cu in, box has ${total}. ${smallestBox ? `Try a ${smallestBox.label}, or add a ring.` : 'Add a deep ring or go bigger.'}`
    }
  }

  return {
    marks: [],
    headline,
    stats: [
      { label: 'Largest wire', value: sizeLabel(largest) },
      { label: 'Smallest standard box', value: smallestBox ? smallestBox.label : 'None listed' },
    ],
    howToBend: [
      'Pigtails that start and end inside the box don\'t count.',
      'A wire that passes through without a splice counts once.',
      'Plaster/mud rings and extension rings marked with a volume add to the box.',
    ],
    notesTitle: 'Good to know',
    steps,
    warning,
  }
}
