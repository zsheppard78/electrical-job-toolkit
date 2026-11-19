import type { ToolResult } from './bends'
import { formatLength } from './measure'

/**
 * Material takeoff for one EMT run: how much to pull off the truck.
 *
 *  - Sticks:     10' sticks, plus waste
 *  - Couplings:  one between every two sticks
 *  - Connectors: one at every box / termination
 *  - Straps:     within 3' of every termination and every 10' between (NEC 358.30)
 *  - Wire:       run length + makeup at each end, per conductor
 *  - Bends:      more than 360° between pull points needs a pull box (NEC 358.26)
 */

export interface MaterialInput {
  /** Run length in inches */
  run: number
  /** EMT trade size, e.g. "3/4" */
  size: string
  /** Boxes / terminations the run connects to */
  terminations: number
  /** Number of 90° bends (or equivalent) */
  nineties: number
  /** Conductors being pulled (0 = skip wire) */
  wires: number
  /** Extra for waste, e.g. 0.1 = 10% */
  waste: number
}

const STICK = 120 // 10 ft in inches
const STRAP_FROM_END = 36 // within 3 ft of a termination
const STRAP_SPACING = 120 // at least every 10 ft
const MAKEUP_PER_END = 12 // 1 ft of wire at each box

export function strapsFor(run: number): number {
  if (run <= 2 * STRAP_FROM_END) return 1 // one strap can be within 3' of both ends
  return Math.ceil((run - 2 * STRAP_FROM_END) / STRAP_SPACING) + 1
}

export function materialList(i: MaterialInput): ToolResult {
  if (!(i.run > 0)) throw new Error('Run length must be greater than 0')
  if (i.terminations < 1) throw new Error('A run needs at least one termination')

  const pipe = i.run * (1 + i.waste)
  const sticks = Math.ceil(pipe / STICK)
  const couplings = Math.max(0, sticks - 1)
  const connectors = i.terminations
  const straps = strapsFor(i.run)
  const degrees = i.nineties * 90

  const perWireInches = (i.run + i.terminations * MAKEUP_PER_END) * (1 + i.waste)
  const perWireFeet = Math.ceil(perWireInches / 12 / 5) * 5 // round up to the next 5 ft
  const wireFeet = perWireFeet * i.wires

  const headline: NonNullable<ToolResult['headline']> = [
    { label: `${i.size}" EMT sticks (10')`, value: String(sticks), good: true },
    { label: `${i.size}" couplings`, value: String(couplings), good: true },
    { label: `${i.size}" connectors`, value: String(connectors), good: true },
    { label: `${i.size}" straps`, value: String(straps), good: true },
  ]
  if (i.wires > 0) headline.push({ label: `Wire (${i.wires} × ${perWireFeet} ft)`, value: `${wireFeet} ft`, good: true })

  const wastePct = Math.round(i.waste * 100)
  const steps = [
    { title: 'Pipe', detail: `${formatLength(i.run)} run${wastePct ? ` + ${wastePct}% waste` : ''} = ${formatLength(pipe)} ÷ 10' sticks = ${(pipe / STICK).toFixed(2)} → ${sticks} sticks` },
    { title: 'Couplings', detail: `${sticks} sticks − 1 = ${couplings} (one at every joint)` },
    { title: 'Connectors', detail: `One at each of the ${connectors} box${connectors === 1 ? '' : 'es'}` },
    {
      title: 'Straps',
      detail:
        i.run <= 2 * STRAP_FROM_END
          ? 'Short run: one strap is within 3\' of both ends (NEC 358.30)'
          : `One within 3' of each end, then every 10' or less: (${formatLength(i.run)} − 6') ÷ 10' = ${((i.run - 72) / 120).toFixed(2)} → ${straps - 1} gaps → ${straps} straps (NEC 358.30)`,
    },
  ]
  if (i.wires > 0) {
    steps.push({
      title: 'Wire',
      detail: `(${formatLength(i.run)} + 1' makeup × ${i.terminations} boxes)${wastePct ? ` + ${wastePct}%` : ''} ≈ ${(perWireInches / 12).toFixed(1)} ft → ${perWireFeet} ft each × ${i.wires} = ${wireFeet} ft`,
    })
  }
  steps.push({ title: 'Bends', detail: `${i.nineties} × 90° = ${degrees}° (max 360° between pull points, NEC 358.26)` })

  return {
    marks: [],
    headline,
    stats: [
      { label: 'Run length', value: formatLength(i.run) },
      { label: 'Total bends', value: `${degrees}°` },
    ],
    howToBend: [
      'Straps count assumes one straight run. Add a strap near each bend if your foreman wants them.',
      'Grab a couple extra couplings and connectors. They walk off.',
      'Long pulls with lots of bends go easier with a pull point in the middle.',
    ],
    notesTitle: 'Good to know',
    steps,
    warning: degrees > 360 ? `${degrees}° of bends is over the 360° limit between pull points. Add a pull box or LB.` : undefined,
  }
}
