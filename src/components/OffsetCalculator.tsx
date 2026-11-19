import { useMemo } from 'react'
import { calculateOffset, COMMON_ANGLES, type OffsetResult } from '../lib/offset'
import { formatLength, parseLength } from '../lib/measure'
import { Answer, ChoiceButtons, HowToBend, inputClass, Question, ShowTheMath, Stat, Warning } from './ui'

interface Props {
  depthText: string
  setDepthText: (v: string) => void
  angle: number
  setAngle: (a: number) => void
  obstacleText: string
  setObstacleText: (v: string) => void
}

/**
 * Side view of the pipe, labeled with the real numbers.
 * Not to scale — it's there to show WHAT each measurement is.
 */
function OffsetDiagram({ angle, depth, result, obstacle }: { angle: number; depth: number; result: OffsetResult; obstacle?: number }) {
  const low = 120
  const rise = 55
  const high = low - rise
  const x0 = 20 // end of pipe
  const x1 = 120 // 1st bend
  const run = Math.max(45, Math.min(rise / Math.tan((angle * Math.PI) / 180), 150))
  const x2 = x1 + run // 2nd bend
  const xEnd = x2 + 110
  const W = xEnd + 10

  const label = 'text-[11px] font-semibold'

  return (
    <svg viewBox={`0 0 ${W} 205`} className="w-full" role="img" aria-label="Offset diagram">
      {/* obstacle the pipe goes over */}
      <rect x={x2} y={high + 10} width={xEnd - x2 - 10} height={low - high - 4} rx={3} className="fill-slate-600" />
      <text x={(x2 + xEnd) / 2 - 22} y={(low + high) / 2 + 14} className="fill-slate-300 text-[11px]">obstacle</text>

      {/* conduit */}
      <polyline
        points={`${x0},${low} ${x1},${low} ${x2},${high} ${xEnd},${high}`}
        className="fill-none stroke-amber-400"
        strokeWidth={6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* end of pipe */}
      <line x1={x0} y1={low - 10} x2={x0} y2={low + 10} className="stroke-white" strokeWidth={3} />
      <text x={x0 - 8} y={low - 16} className={`fill-white ${label}`}>END</text>

      {/* angle */}
      <text x={x1 + 14} y={low - 6} className={`fill-amber-300 ${label}`}>{angle}°</text>

      {/* depth (how far over) */}
      <line x1={x2 - 14} y1={low} x2={x2 - 14} y2={high} className="stroke-sky-400" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={x2 - 14 - 46} y={high + 14} className={`fill-sky-400 ${label}`}>depth</text>
      <text x={x2 - 14 - 46} y={high + 27} className={`fill-sky-400 ${label}`}>{formatLength(depth)}</text>

      {/* bend marks */}
      <circle cx={x1} cy={low} r={6} className="fill-rose-500" />
      <circle cx={x2} cy={high} r={6} className="fill-rose-500" />
      <text x={x1 - 6} y={low + 22} className={`fill-rose-400 ${label}`}>1</text>
      <text x={x2 - 4} y={high - 12} className={`fill-rose-400 ${label}`}>2</text>

      {/* dimension: between bends */}
      <line x1={x1} y1={150} x2={x2} y2={150} className="stroke-emerald-400" strokeWidth={1.5} />
      <line x1={x1} y1={144} x2={x1} y2={156} className="stroke-emerald-400" />
      <line x1={x2} y1={144} x2={x2} y2={156} className="stroke-emerald-400" />
      <text x={x1} y={166} className={`fill-emerald-400 ${label}`}>
        {formatLength(result.distanceBetweenBends)} between
      </text>

      {/* dimension: end of pipe to 1st bend (where the offset starts) */}
      {result.marks && (
        <>
          <line x1={x0} y1={185} x2={x1} y2={185} className="stroke-rose-400" strokeWidth={1.5} />
          <line x1={x0} y1={179} x2={x0} y2={191} className="stroke-rose-400" />
          <line x1={x1} y1={179} x2={x1} y2={191} className="stroke-rose-400" />
          <text x={x0} y={201} className={`fill-rose-400 ${label}`}>
            start: {formatLength(result.marks.first)}
          </text>
          {obstacle !== undefined && (
            <text x={x2 + 4} y={201} className={`fill-slate-300 ${label}`}>
              obstacle at {formatLength(obstacle)}
            </text>
          )}
        </>
      )}
    </svg>
  )
}

export default function OffsetCalculator(props: Props) {
  const { depthText, setDepthText, angle, setAngle, obstacleText, setObstacleText } = props

  const depth = parseLength(depthText)
  const obstacle = obstacleText.trim() ? parseLength(obstacleText) : undefined

  const { result, error } = useMemo(() => {
    if (!depthText.trim()) return { result: null, error: null }
    if (depth === null) return { result: null, error: 'Depth should look like 6, 5-1/2, or 5 1/2' }
    if (obstacle === null) return { result: null, error: `Obstacle distance should look like 48, 4', or 4' 2-1/2"` }
    try {
      return { result: calculateOffset({ depth, angle, distanceToObstacle: obstacle }), error: null }
    } catch (e) {
      return { result: null, error: (e as Error).message }
    }
  }, [depthText, depth, obstacle, angle])

  return (
    <section className="space-y-4">
      <Question n={1} title="How far over do you need to go?" hint="The offset depth — e.g. the pipe needs to clear a 6&quot; beam">
        <div className="relative">
          <input className={inputClass} inputMode="decimal" placeholder='6' value={depthText} onChange={(e) => setDepthText(e.target.value)} />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">inches</span>
        </div>
      </Question>

      <Question n={2} title="What angle are you bending?" hint="30° is the go-to. Smaller angles = longer, gentler offset.">
        <ChoiceButtons options={COMMON_ANGLES.map((a) => ({ value: a as number, label: `${a}°` }))} value={angle} onChange={setAngle} />
      </Question>

      <Question n={3} title="How far from the end of the pipe is the obstacle?" hint="Hook your tape on the end of the pipe and measure to the front of the obstacle.">
        <input className={inputClass} placeholder={`4' 2-1/2"`} value={obstacleText} onChange={(e) => setObstacleText(e.target.value)} />
      </Question>

      {error && <Warning>{error}</Warning>}

      {result && (
        <div className="space-y-4 rounded-xl border-2 border-amber-400 bg-slate-800 p-4">
          {result.marks ? (
            result.marks.first >= 0 ? (
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-slate-400">Measure from the end of the pipe</p>
                <Answer n={1} label="Offset starts here — 1st mark at" value={formatLength(result.marks.first)} />
                <Answer n={2} label="2nd mark at" value={formatLength(result.marks.second)} />
              </div>
            ) : (
              <p className="rounded-lg bg-rose-950 p-3 text-rose-300">
                The obstacle is too close to the end of the pipe for a {angle}° offset. Try a bigger angle, or cut a longer piece.
              </p>
            )
          ) : (
            <p className="rounded-lg bg-slate-900 p-3 text-slate-300">Fill in step 3 to see where to put your marks.</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-center">
            <Stat label="Distance between marks" value={formatLength(result.distanceBetweenBends)} />
            <Stat label="Shrink (pipe gets shorter)" value={formatLength(result.totalShrink)} />
          </div>

          <OffsetDiagram angle={angle} depth={depth!} result={result} obstacle={obstacle ?? undefined} />

          {result.marks && result.marks.first >= 0 && (
            <HowToBend
              steps={[
                `Mark the pipe at ${formatLength(result.marks.first)} and ${formatLength(result.marks.second)} from the end.`,
                `Line up the bender's arrow with mark 1 and bend to ${angle}°.`,
                `Roll the pipe over 180° (so the bend points the opposite way).`,
                `Line up the arrow with mark 2 and bend to ${angle}° again.`,
                `Lay it on the floor and check it's flat and the depth is ${formatLength(depth!)}.`,
              ]}
            />
          )}

          <ShowTheMath steps={result.steps} />
        </div>
      )}
    </section>
  )
}
