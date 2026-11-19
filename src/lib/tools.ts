import type { ToolDefinition } from '../components/ToolScreen'
import { BENDERS, backToBack, fourPointSaddle, kick, rollingOffset, stubUp, threePointSaddle, type SaddleType } from './bends'
import { COMMON_ANGLES } from './offset'

/**
 * Each tool = its questions + which math function to call.
 * Adding a new bend means adding one entry here (plus its math in bends.ts).
 */

const angleOptions = COMMON_ANGLES.map((a) => ({ value: String(a), label: `${a}°` }))
const benderOptions = BENDERS.map((b) => ({ value: b.id, label: b.id + '"' }))

const benderField = {
  kind: 'choice' as const,
  key: 'bender',
  title: 'Which bender?',
  hint: 'EMT hand bender size. Take-up is stamped on the bender. Check it matches.',
  options: benderOptions,
}

const num = (v: unknown) => v as number
const optNum = (v: unknown) => v as number | undefined

export const TOOLS: ToolDefinition[] = [
  {
    id: 'stub',
    name: '90° Stub-Up',
    description: 'A 90 coming up out of the floor or down from the ceiling to a set height.',
    fields: [
      { kind: 'length', key: 'height', title: 'How tall does the stub need to be?', hint: 'From the floor (or back of the 90) to the end of the pipe.', placeholder: '14' },
      benderField,
    ],
    initial: { height: '', bender: '1/2' },
    compute: (v) => stubUp(num(v.height), String(v.bender)),
  },
  {
    id: 'b2b',
    name: 'Back-to-Back 90s',
    description: 'Two 90s on one pipe, like a "U" (e.g. down one wall, across, up the other).',
    fields: [
      { kind: 'length', key: 'stub', title: 'How tall is the first stub?', hint: 'Same as a normal stub-up.', placeholder: '14' },
      { kind: 'length', key: 'outToOut', title: 'Outside-to-outside distance?', hint: 'From the back of the first 90 to the back of the second 90.', placeholder: "3' 6\"" },
      benderField,
    ],
    initial: { stub: '', outToOut: '', bender: '1/2' },
    compute: (v) => backToBack(num(v.stub), num(v.outToOut), String(v.bender)),
  },
  {
    id: 'kick',
    name: 'Kick',
    description: 'One bend that angles the pipe away from a wall or floor.',
    fields: [
      { kind: 'length', key: 'depth', title: 'How far out does the pipe need to come?', hint: 'Distance away from the wall at the spot it needs to be.', placeholder: '4' },
      { kind: 'choice', key: 'angle', title: 'What angle?', hint: 'Smaller angle = longer, gentler kick.', options: angleOptions },
    ],
    initial: { depth: '', angle: '30' },
    compute: (v) => kick(num(v.depth), Number(v.angle)),
  },
  {
    id: 'saddle3',
    name: '3-Point Saddle',
    description: 'Going over a round obstacle like another pipe. One center bend, two outer bends.',
    fields: [
      { kind: 'length', key: 'height', title: 'How tall is the obstacle?', hint: 'Usually the outside diameter of the pipe you\'re going over.', placeholder: '2' },
      {
        kind: 'choice',
        key: 'type',
        title: 'Which saddle?',
        hint: '45° center is standard. 60° is tighter for bigger obstacles.',
        options: [
          { value: '45', label: '45° / 22.5°' },
          { value: '60', label: '60° / 30°' },
        ],
      },
      { kind: 'length', key: 'distance', title: 'How far to the CENTER of the obstacle?', hint: 'Hook your tape on the end of the pipe, measure to the middle of the obstacle.', placeholder: "3' 4\"", optional: true },
    ],
    initial: { height: '', type: '45', distance: '' },
    compute: (v) => threePointSaddle(num(v.height), v.type as SaddleType, optNum(v.distance)),
    marksHint: 'Fill in step 3 to see where to put your marks.',
  },
  {
    id: 'saddle4',
    name: '4-Point Saddle',
    description: 'Going over a box-shaped obstacle (a beam, a duct). Two offsets: up, across, down.',
    fields: [
      { kind: 'length', key: 'height', title: 'How tall is the obstacle?', hint: 'How far the pipe needs to go up.', placeholder: '4' },
      { kind: 'length', key: 'width', title: 'How wide is the obstacle?', hint: 'Front to back, along the pipe. Add a little for clearance.', placeholder: '10' },
      { kind: 'length', key: 'distance', title: 'How far to the FRONT of the obstacle?', hint: 'Hook your tape on the end of the pipe.', placeholder: "4'" },
      { kind: 'choice', key: 'angle', title: 'What angle?', hint: '30° is the go-to.', options: angleOptions },
    ],
    initial: { height: '', width: '', distance: '', angle: '30' },
    compute: (v) => fourPointSaddle(num(v.height), num(v.width), num(v.distance), Number(v.angle)),
  },
  {
    id: 'rolling',
    name: 'Rolling Offset',
    description: 'An offset that goes up AND over at the same time.',
    fields: [
      { kind: 'length', key: 'rise', title: 'How far up?', hint: 'The vertical part of the offset.', placeholder: '6' },
      { kind: 'length', key: 'roll', title: 'How far over?', hint: 'The sideways part of the offset.', placeholder: '8' },
      { kind: 'choice', key: 'angle', title: 'What angle?', hint: '30° is the go-to.', options: angleOptions },
      { kind: 'length', key: 'distance', title: 'How far to the obstacle?', hint: 'Hook your tape on the end of the pipe.', placeholder: "4'", optional: true },
    ],
    initial: { rise: '', roll: '', angle: '30', distance: '' },
    compute: (v) => rollingOffset(num(v.rise), num(v.roll), Number(v.angle), optNum(v.distance)),
    marksHint: 'Fill in step 4 to see where to put your marks.',
  },
]
