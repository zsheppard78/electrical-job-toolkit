import type { ToolDefinition } from '../components/ToolScreen'
import { BENDERS, backToBack, fourPointSaddle, kick, rollingOffset, stubUp, threePointSaddle, type SaddleType } from './bends'
import { COMMON_ANGLES } from './offset'
import { BOX_SIZES, BOX_WIRE_SIZES, boxFill, conduitFill, EMT_SIZES, sizeLabel, voltageDrop, WIRE_SIZES, type EmtSize, type WireSize } from './electrical'
import { tapeCalculator } from './tape'

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
const counts = (v: unknown) => v as Partial<Record<WireSize, number>>
const wireItems = (sizes: readonly string[]) => sizes.map((s) => ({ value: s, label: sizeLabel(s) }))
const optNum = (v: unknown) => v as number | undefined

export const TOOLS: ToolDefinition[] = [
  {
    id: 'stub',
    name: '90° Stub-Up',
    category: 'Bending',
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
    category: 'Bending',
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
    category: 'Bending',
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
    category: 'Bending',
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
    category: 'Bending',
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
    category: 'Bending',
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
  {
    id: 'tape',
    name: 'Feet-Inches Calculator',
    category: 'Measuring',
    description: 'Add, subtract, multiply and divide tape measurements.',
    fields: [
      {
        kind: 'text',
        key: 'expr',
        title: 'Type it like you\'d say it',
        hint: 'Spaces around + − × ÷.  Example:  7\' 5-3/8" - 2\' 11-3/4"',
        placeholder: `7' 5-3/8" - 2' 11-3/4"`,
      },
    ],
    initial: { expr: '' },
    compute: (v) => tapeCalculator(String(v.expr)),
  },
  {
    id: 'fill',
    name: 'Conduit Fill',
    category: 'Electrical',
    description: 'How many wires fit in a pipe, or what size pipe you need.',
    fields: [
      { kind: 'counts', key: 'wires', title: 'What wires are you pulling?', hint: 'THHN/THWN-2. Count insulated grounds too.', items: wireItems(WIRE_SIZES) },
      {
        kind: 'choice',
        key: 'pipe',
        title: 'What size EMT? (optional)',
        hint: 'Pick one to check it, or leave on "Find" for the smallest that works.',
        options: [{ value: '', label: 'Find' }, ...EMT_SIZES.slice(0, 7).map((s) => ({ value: s, label: s + '"' }))],
      },
    ],
    initial: { wires: '{}', pipe: '' },
    compute: (v) => conduitFill(counts(v.wires), (v.pipe || undefined) as EmtSize | undefined),
  },
  {
    id: 'vd',
    name: 'Voltage Drop / Wire Size',
    category: 'Electrical',
    description: 'Is the wire big enough for the load and the distance?',
    fields: [
      { kind: 'number', key: 'amps', title: 'How many amps?', hint: 'The load on the circuit.', placeholder: '16', unit: 'amps' },
      { kind: 'number', key: 'feet', title: 'How far, one way?', hint: 'From the panel to the load.', placeholder: '150', unit: 'feet' },
      {
        kind: 'choice',
        key: 'system',
        title: 'What voltage?',
        hint: '',
        options: [
          { value: '120-1', label: '120V' },
          { value: '208-1', label: '208V 1ø' },
          { value: '240-1', label: '240V 1ø' },
          { value: '277-1', label: '277V' },
          { value: '208-3', label: '208V 3ø' },
          { value: '480-3', label: '480V 3ø' },
        ],
      },
      { kind: 'choice', key: 'material', title: 'Copper or aluminum?', hint: '', options: [{ value: 'cu', label: 'Copper' }, { value: 'al', label: 'Aluminum' }] },
      {
        kind: 'choice',
        key: 'continuous',
        title: 'Continuous load?',
        hint: 'On for 3+ hours at a time (lighting, heat). Wire gets sized at 125%.',
        options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }],
      },
      {
        kind: 'choice',
        key: 'chosen',
        title: 'Wire you plan to use (optional)',
        hint: 'Pick one to check it.',
        options: [{ value: '', label: 'Find' }, ...WIRE_SIZES.slice(0, 9).map((s) => ({ value: s, label: sizeLabel(s) }))],
      },
    ],
    initial: { amps: '', feet: '', system: '120-1', material: 'cu', continuous: 'no', chosen: '' },
    compute: (v) => {
      const [volts, phase] = String(v.system).split('-').map(Number)
      return voltageDrop({
        amps: num(v.amps),
        feet: num(v.feet),
        volts,
        phase: phase as 1 | 3,
        material: v.material as 'cu' | 'al',
        continuous: v.continuous === 'yes',
        chosen: (v.chosen || undefined) as WireSize | undefined,
      })
    },
  },
  {
    id: 'box',
    name: 'Box Fill',
    category: 'Electrical',
    description: 'Is this box big enough for the wires and devices going in it?',
    fields: [
      { kind: 'counts', key: 'wires', title: 'Wires coming into the box', hint: 'Count each hot, neutral and switch leg. Not grounds, not pigtails.', items: wireItems(BOX_WIRE_SIZES) },
      { kind: 'choice', key: 'grounds', title: 'Any ground wires?', hint: 'All grounds together count as one.', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { kind: 'choice', key: 'devices', title: 'How many devices?', hint: 'Switches, receptacles (each counts as 2 wires).', options: ['0', '1', '2', '3', '4'].map((n) => ({ value: n, label: n })) },
      { kind: 'choice', key: 'clamps', title: 'Internal cable clamps?', hint: 'Clamps inside the box. All together count as one.', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
      { kind: 'choice', key: 'studs', title: 'Fixture studs / hickeys?', hint: 'Each counts as one.', options: ['0', '1', '2'].map((n) => ({ value: n, label: n })) },
      {
        kind: 'choice',
        key: 'box',
        title: 'Which box? (optional)',
        hint: 'Pick one to check it.',
        options: [{ value: '', label: 'Just tell me the size' }, ...BOX_SIZES.map((b) => ({ value: b.id, label: b.label }))],
      },
      { kind: 'number', key: 'ring', title: 'Ring volume (optional)', hint: 'If you add a mud/extension ring, its volume is stamped on it.', placeholder: '0', unit: 'cu in', optional: true },
    ],
    initial: { wires: '{}', grounds: 'yes', devices: '1', clamps: 'no', studs: '0', box: '', ring: '' },
    compute: (v) =>
      boxFill({
        counts: counts(v.wires),
        grounds: v.grounds === 'yes',
        devices: Number(v.devices),
        clamps: v.clamps === 'yes',
        fixtureStuds: Number(v.studs),
        boxId: String(v.box) || undefined,
        extraVolume: v.ring as number | undefined,
      }),
  },
]
