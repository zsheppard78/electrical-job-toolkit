import { formatLength } from './measure'

/**
 * Offset bending math.
 *
 * An offset is two equal bends that move the conduit over by some depth
 * (to get around a beam, a box, a pipe...). Two numbers matter:
 *
 *  - Distance between bends = depth × multiplier
 *      The multiplier is the cosecant of the bend angle (1 / sin θ).
 *      It's the hypotenuse of the right triangle the offset makes.
 *
 *  - Shrink = depth × shrink-per-inch
 *      The pipe "uses up" length going over instead of straight, so a run
 *      with an offset comes up short. When bending toward an obstacle you
 *      add the shrink to your measurement so the offset lands in the right spot.
 */

export const COMMON_ANGLES = [10, 22.5, 30, 45, 60] as const

/**
 * Field shrink values per inch of offset depth (the numbers on most bender
 * charts). These are what foremen use, so we prefer them for common angles.
 */
const FIELD_SHRINK_PER_INCH: Record<number, number> = {
  10: 1 / 16,
  22.5: 3 / 16,
  30: 1 / 4,
  45: 3 / 8,
  60: 1 / 2,
}

/** Rounded multipliers printed on most bender charts (the app uses the exact value). */
export const FIELD_MULTIPLIER: Record<number, number> = {
  10: 6,
  22.5: 2.6,
  30: 2,
  45: 1.4,
  60: 1.2,
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Shrink per inch of depth: chart value if the angle is on the chart, otherwise tan(θ/2). */
export function shrinkPerInchFor(angle: number): { value: number; source: 'field chart' | 'trig' } {
  const field = FIELD_SHRINK_PER_INCH[angle]
  return field !== undefined ? { value: field, source: 'field chart' } : { value: Math.tan(toRad(angle) / 2), source: 'trig' }
}

export interface ChartRow {
  angle: number
  chartMultiplier: number
  exactMultiplier: number
  shrinkPerInch: number
  /** Only filled in when a depth is given */
  distanceBetweenBends?: number
  totalShrink?: number
}

/** The offset chart: every common angle, optionally worked out for a given depth. */
export function offsetChart(depth?: number): ChartRow[] {
  return COMMON_ANGLES.map((angle) => {
    const exactMultiplier = 1 / Math.sin(toRad(angle))
    const shrinkPerInch = shrinkPerInchFor(angle).value
    const row: ChartRow = { angle, chartMultiplier: FIELD_MULTIPLIER[angle], exactMultiplier, shrinkPerInch }
    if (depth !== undefined && depth > 0) {
      row.distanceBetweenBends = depth * exactMultiplier
      row.totalShrink = depth * shrinkPerInch
    }
    return row
  })
}

export interface Step {
  title: string
  detail: string
}

export interface OffsetInput {
  /** How far the pipe needs to move over, in inches */
  depth: number
  /** Bend angle in degrees */
  angle: number
  /** Optional: distance from end of pipe to the obstacle, in inches */
  distanceToObstacle?: number
}

export interface OffsetResult {
  multiplier: number
  distanceBetweenBends: number
  shrinkPerInch: number
  shrinkSource: 'field chart' | 'trig'
  totalShrink: number
  /** Mark positions measured from the end of the pipe (only if distanceToObstacle given) */
  marks?: { first: number; second: number }
  steps: Step[]
}

const toRadians = (deg: number) => (deg * Math.PI) / 180
const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places

export function calculateOffset({ depth, angle, distanceToObstacle }: OffsetInput): OffsetResult {
  if (!(depth > 0)) throw new Error('Offset depth must be greater than 0')
  if (!(angle > 0 && angle < 90)) throw new Error('Angle must be between 0° and 90°')

  const multiplier = 1 / Math.sin(toRadians(angle))
  const distanceBetweenBends = depth * multiplier

  // Use the chart value when we have one; otherwise fall back to the
  // geometric value tan(θ/2), which is what the chart numbers approximate.
  const { value: shrinkPerInch, source: shrinkSource } = shrinkPerInchFor(angle)
  const totalShrink = depth * shrinkPerInch

  const steps: Step[] = [
    {
      title: 'Find the multiplier',
      detail: `Multiplier = 1 ÷ sin(${angle}°) = ${round(multiplier)}`,
    },
    {
      title: 'Distance between bends',
      detail: `${formatLength(depth)} depth × ${round(multiplier)} = ${formatLength(distanceBetweenBends)}`,
    },
    {
      title: 'Shrink',
      detail:
        shrinkSource === 'field chart'
          ? `At ${angle}°, the bender chart says ${formatLength(shrinkPerInch)} of shrink per inch of depth. ${formatLength(depth)} × ${formatLength(shrinkPerInch)} = ${formatLength(totalShrink)}`
          : `${angle}° isn't on the bender chart, so we use tan(${angle}° ÷ 2) = ${round(shrinkPerInch)} per inch. ${formatLength(depth)} × ${round(shrinkPerInch)} = ${formatLength(totalShrink)}`,
    },
  ]

  let marks: OffsetResult['marks']
  if (distanceToObstacle !== undefined && distanceToObstacle > 0) {
    // Bending toward the obstacle: the far mark goes at the obstacle plus shrink,
    // the near mark is one "distance between bends" back toward the end.
    const second = distanceToObstacle + totalShrink
    const first = second - distanceBetweenBends
    marks = { first, second }

    steps.push({
      title: 'Second mark (farther from the end)',
      detail: `Distance to obstacle + shrink = ${formatLength(distanceToObstacle)} + ${formatLength(totalShrink)} = ${formatLength(second)}`,
    })
    steps.push({
      title: 'First mark (closer to the end)',
      detail:
        first >= 0
          ? `Second mark − distance between bends = ${formatLength(second)} − ${formatLength(distanceBetweenBends)} = ${formatLength(first)}`
          : `Second mark − distance between bends comes out negative (${formatLength(first)}). The obstacle is too close to the end of the pipe for this angle. Try a steeper angle or cut a longer piece.`,
    })
  }

  return { multiplier, distanceBetweenBends, shrinkPerInch, shrinkSource, totalShrink, marks, steps }
}
