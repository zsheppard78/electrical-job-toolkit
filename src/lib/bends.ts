import { calculateOffset, type Step } from './offset'
import { formatLength as f } from './measure'

/**
 * Every bend calculator returns the same shape (a "BendPlan"), so one
 * screen component can display any of them.
 */
export interface Mark {
  /** Position in inches */
  at: number
  label: string
  /** true = measured from the end of the pipe; false = from somewhere else (explained in label) */
  fromEnd: boolean
}

export interface BendPlan {
  marks: Mark[]
  stats: { label: string; value: string }[]
  howToBend: string[]
  steps: Step[]
  warning?: string
}

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const r3 = (n: number) => Math.round(n * 1000) / 1000

function requirePositive(value: number, name: string) {
  if (!(value > 0)) throw new Error(`${name} must be greater than 0`)
}

// ---------------------------------------------------------------------------
// Benders
// ---------------------------------------------------------------------------

/**
 * Take-up (a.k.a. deduct) for common EMT hand benders: how much of the stub
 * the bend itself "uses". Always check the number stamped on YOUR bender.
 */
export const BENDERS = [
  { id: '1/2', name: '1/2" EMT', takeUp: 5 },
  { id: '3/4', name: '3/4" EMT', takeUp: 6 },
  { id: '1', name: '1" EMT', takeUp: 8 },
  { id: '1-1/4', name: '1-1/4" EMT', takeUp: 11 },
] as const

export function getBender(id: string) {
  const bender = BENDERS.find((b) => b.id === id)
  if (!bender) throw new Error(`Unknown bender: ${id}`)
  return bender
}

// ---------------------------------------------------------------------------
// 90° stub-up
// ---------------------------------------------------------------------------

export function stubUp(height: number, benderId: string): BendPlan {
  requirePositive(height, 'Stub height')
  const bender = getBender(benderId)
  const mark = height - bender.takeUp

  const steps: Step[] = [
    { title: 'Find the take-up', detail: `A ${bender.name} bender has ${f(bender.takeUp)} of take-up (check the number stamped on the bender).` },
    { title: 'Subtract it from the stub', detail: `${f(height)} stub − ${f(bender.takeUp)} take-up = ${f(mark)}` },
  ]

  if (mark <= 0) {
    return {
      marks: [],
      stats: [{ label: 'Take-up', value: f(bender.takeUp) }],
      howToBend: [],
      steps,
      warning: `A ${f(height)} stub is too short for a ${bender.name} bender. The stub has to be longer than the ${f(bender.takeUp)} take-up.`,
    }
  }

  return {
    marks: [{ at: mark, label: 'Mark', fromEnd: true }],
    stats: [
      { label: 'Take-up', value: f(bender.takeUp) },
      { label: 'Stub height', value: f(height) },
    ],
    howToBend: [
      `Measure ${f(mark)} from the end of the pipe and mark it.`,
      `Put the bender on the pipe with the arrow pointing toward the end you measured from.`,
      `Line up the arrow with your mark and bend to 90°. Check it with a level.`,
      `Measure the stub: it should be ${f(height)} from the floor to the end.`,
    ],
    steps,
  }
}

// ---------------------------------------------------------------------------
// Back-to-back 90s
// ---------------------------------------------------------------------------

/**
 * Two 90s on the same pipe, like a "U". The second 90 is measured from the
 * back (outside) of the first 90 and bent using the bender's star mark.
 */
export function backToBack(firstStub: number, outToOut: number, benderId: string): BendPlan {
  requirePositive(outToOut, 'Back-to-back distance')
  const first = stubUp(firstStub, benderId)
  if (first.warning) return first

  const firstMark = first.marks[0].at
  return {
    marks: [
      { at: firstMark, label: '1st 90 mark (from end of pipe)', fromEnd: true },
      { at: outToOut, label: '2nd 90 mark (from the BACK of the 1st 90)', fromEnd: false },
    ],
    stats: first.stats,
    howToBend: [
      `Bend the first 90 like a stub-up: mark ${f(firstMark)} from the end, arrow toward the end, bend to 90°.`,
      `Measure ${f(outToOut)} from the back (outside edge) of the first 90 and mark the pipe.`,
      `Line up the bender's star (back-of-90 symbol) with that mark.`,
      `Bend to 90° so both legs point the same way. Check that the outside-to-outside distance is ${f(outToOut)}.`,
    ],
    steps: [
      ...first.steps,
      {
        title: 'Second 90',
        detail: `No math: the star on the bender marks the back of the bend, so you mark the full ${f(outToOut)} out-to-out measurement from the back of the first 90.`,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Kick
// ---------------------------------------------------------------------------

/** A single bend that angles the pipe away from a wall or floor. */
export function kick(depth: number, angle: number): BendPlan {
  requirePositive(depth, 'Kick depth')
  if (!(angle > 0 && angle < 90)) throw new Error('Angle must be between 0° and 90°')

  const multiplier = 1 / Math.sin(rad(angle))
  const alongPipe = depth * multiplier
  const alongWall = depth / Math.tan(rad(angle))

  return {
    marks: [],
    stats: [
      { label: 'Pipe after the bend', value: f(alongPipe) },
      { label: 'Measured along the wall', value: f(alongWall) },
    ],
    howToBend: [
      `Find the spot where the pipe needs to be ${f(depth)} out from the wall.`,
      `Measure ${f(alongWall)} back from that spot along the wall. That's where the kick bend goes.`,
      `Bend to ${angle}°. From the bend, ${f(alongPipe)} of pipe gets you ${f(depth)} out.`,
    ],
    steps: [
      { title: 'Multiplier', detail: `1 ÷ sin(${angle}°) = ${r3(multiplier)}` },
      { title: 'Pipe after the bend', detail: `${f(depth)} × ${r3(multiplier)} = ${f(alongPipe)}` },
      { title: 'Along the wall', detail: `${f(depth)} ÷ tan(${angle}°) = ${f(alongWall)}` },
    ],
  }
}

// ---------------------------------------------------------------------------
// 3-point saddle
// ---------------------------------------------------------------------------

/** Chart values for 3-point saddles, by center-bend angle. */
export const THREE_POINT_SADDLES = {
  '45': { center: 45, outer: 22.5, spacing: 2.5, shrinkPerInch: 3 / 16 },
  '60': { center: 60, outer: 30, spacing: 2, shrinkPerInch: 1 / 4 },
} as const

export type SaddleType = keyof typeof THREE_POINT_SADDLES

/** Going over a round obstacle (another pipe): one center bend, two outer bends. */
export function threePointSaddle(height: number, type: SaddleType, distanceToCenter?: number): BendPlan {
  requirePositive(height, 'Obstacle height')
  const s = THREE_POINT_SADDLES[type]
  const spacing = height * s.spacing
  const shrink = height * s.shrinkPerInch

  const steps: Step[] = [
    { title: 'Shrink', detail: `${s.center}° center saddle: ${f(s.shrinkPerInch)} per inch. ${f(height)} × ${f(s.shrinkPerInch)} = ${f(shrink)}` },
    { title: 'Outer marks', detail: `${s.spacing} × height = ${s.spacing} × ${f(height)} = ${f(spacing)} on each side of the center mark` },
  ]
  const stats = [
    { label: 'Center → outer marks', value: f(spacing) },
    { label: 'Shrink', value: f(shrink) },
  ]

  if (distanceToCenter === undefined) {
    return { marks: [], stats, howToBend: [], steps }
  }

  const center = distanceToCenter + shrink
  const first = center - spacing
  const third = center + spacing
  steps.push({ title: 'Center mark', detail: `Distance to center of obstacle + shrink = ${f(distanceToCenter)} + ${f(shrink)} = ${f(center)}` })
  steps.push({ title: 'Outer marks', detail: `${f(center)} − ${f(spacing)} = ${f(first)}, and ${f(center)} + ${f(spacing)} = ${f(third)}` })

  return {
    marks: [
      { at: first, label: '1st mark (outer)', fromEnd: true },
      { at: center, label: '2nd mark (center)', fromEnd: true },
      { at: third, label: '3rd mark (outer)', fromEnd: true },
    ],
    stats,
    howToBend: [
      `Mark the pipe at ${f(first)}, ${f(center)} and ${f(third)} from the end.`,
      `Line up the center mark with the bender's center-of-bend mark (teardrop or notch). Bend to ${s.center}°.`,
      `Roll the pipe 180°. Line up the arrow with the 3rd mark and bend to ${s.outer}°.`,
      `Flip the pipe end for end in the bender, line up the arrow with the 1st mark, and bend to ${s.outer}°.`,
      `Check that the saddle sits flat and clears the obstacle.`,
    ],
    steps,
    warning: first < 0 ? 'The obstacle is too close to the end of the pipe. The first mark lands off the pipe. Cut a longer piece.' : undefined,
  }
}

// ---------------------------------------------------------------------------
// 4-point saddle
// ---------------------------------------------------------------------------

/** Going over a box-shaped obstacle: an offset up, a straight section, an offset down. */
export function fourPointSaddle(height: number, width: number, distance: number, angle: number): BendPlan {
  requirePositive(height, 'Obstacle height')
  requirePositive(width, 'Obstacle width')
  requirePositive(distance, 'Distance to obstacle')

  const o = calculateOffset({ depth: height, angle })
  const second = distance + o.totalShrink
  const first = second - o.distanceBetweenBends
  const third = second + width
  const fourth = third + o.distanceBetweenBends

  return {
    marks: [
      { at: first, label: '1st mark', fromEnd: true },
      { at: second, label: '2nd mark', fromEnd: true },
      { at: third, label: '3rd mark', fromEnd: true },
      { at: fourth, label: '4th mark', fromEnd: true },
    ],
    stats: [
      { label: 'Between bends (each offset)', value: f(o.distanceBetweenBends) },
      { label: 'Total shrink (both offsets)', value: f(o.totalShrink * 2) },
    ],
    howToBend: [
      `Mark the pipe at ${f(first)}, ${f(second)}, ${f(third)} and ${f(fourth)} from the end.`,
      `First offset: arrow on mark 1, bend ${angle}°. Roll 180°, arrow on mark 2, bend ${angle}°.`,
      `Second offset: arrow on mark 3, bend ${angle}°. Roll 180°, arrow on mark 4, bend ${angle}°.`,
      `Lay it flat and check it clears the obstacle. Most people add a little extra width for clearance.`,
    ],
    steps: [
      ...o.steps,
      { title: '2nd mark', detail: `Distance to obstacle + shrink = ${f(distance)} + ${f(o.totalShrink)} = ${f(second)}` },
      { title: '1st mark', detail: `${f(second)} − ${f(o.distanceBetweenBends)} = ${f(first)}` },
      { title: '3rd mark', detail: `2nd mark + obstacle width = ${f(second)} + ${f(width)} = ${f(third)}` },
      { title: '4th mark', detail: `${f(third)} + ${f(o.distanceBetweenBends)} = ${f(fourth)}` },
    ],
    warning: first < 0 ? 'The obstacle is too close to the end of the pipe for this angle. Try a bigger angle or cut a longer piece.' : undefined,
  }
}

// ---------------------------------------------------------------------------
// Rolling offset
// ---------------------------------------------------------------------------

/** An offset that goes up AND over at the same time. */
export function rollingOffset(rise: number, roll: number, angle: number, distance?: number): BendPlan {
  requirePositive(rise, 'Rise')
  requirePositive(roll, 'Roll')

  // The pythagorean theorem gives the real (diagonal) offset.
  const trueOffset = Math.hypot(rise, roll)
  const rollAngle = deg(Math.atan(roll / rise))
  const o = calculateOffset({ depth: trueOffset, angle, distanceToObstacle: distance })

  const marks: Mark[] = o.marks
    ? [
        { at: o.marks.first, label: '1st mark', fromEnd: true },
        { at: o.marks.second, label: '2nd mark', fromEnd: true },
      ]
    : []

  return {
    marks,
    stats: [
      { label: 'True offset', value: f(trueOffset) },
      { label: 'Between bends', value: f(o.distanceBetweenBends) },
      { label: 'Shrink', value: f(o.totalShrink) },
      { label: 'Turn the pipe', value: `${Math.round(rollAngle)}° from vertical` },
    ],
    howToBend: marks.length
      ? [
          `Mark the pipe at ${f(marks[0].at)} and ${f(marks[1].at)} from the end.`,
          `Bend it like a normal ${angle}° offset with a ${f(trueOffset)} depth.`,
          `Before the first bend, turn the pipe about ${Math.round(rollAngle)}° from straight up so the offset goes up AND over.`,
          `Check it: it should rise ${f(rise)} and roll over ${f(roll)}.`,
        ]
      : [],
    steps: [
      { title: 'True offset', detail: `√(rise² + roll²) = √(${f(rise)}² + ${f(roll)}²) = ${f(trueOffset)}` },
      { title: 'Roll angle', detail: `tan⁻¹(roll ÷ rise) = tan⁻¹(${r3(roll)} ÷ ${r3(rise)}) = ${Math.round(rollAngle)}° from vertical` },
      ...o.steps,
    ],
    warning: o.marks && o.marks.first < 0 ? 'The obstacle is too close to the end of the pipe. Try a bigger angle or cut a longer piece.' : undefined,
  }
}
