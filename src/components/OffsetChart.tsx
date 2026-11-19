import { offsetChart } from '../lib/offset'
import { formatLength, parseLength } from '../lib/measure'

interface Props {
  depthText: string
  setDepthText: (v: string) => void
  /** Called when a row is tapped: use that angle in the calculator */
  onPickAngle: (angle: number) => void
}

/**
 * The offset chart from the side of the bender, plus a worked-out column
 * for your depth so you can compare angles at a glance.
 */
export default function OffsetChart({ depthText, setDepthText, onPickAngle }: Props) {
  const depth = parseLength(depthText) ?? undefined
  const rows = offsetChart(depth)

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-slate-800 p-4 text-slate-300">
        <p className="mb-1 text-lg font-semibold text-white">How the chart works</p>
        <p>
          <span className="font-semibold text-amber-400">Depth × multiplier</span> = distance between your marks.
        </p>
        <p>
          <span className="font-semibold text-amber-400">Depth × shrink</span> = how much shorter the pipe gets.
        </p>
      </div>

      <label className="block rounded-xl bg-slate-800 p-4">
        <span className="text-slate-300">Work it out for a depth of (optional)</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-2xl text-white focus:border-amber-400 focus:outline-none"
          inputMode="decimal"
          placeholder="6"
          value={depthText}
          onChange={(e) => setDepthText(e.target.value)}
        />
      </label>

      <div className="overflow-hidden rounded-xl bg-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-700 text-sm text-slate-300">
            <tr>
              <th className="p-3">Angle</th>
              <th className="p-3">Multiplier</th>
              <th className="p-3">Shrink / inch</th>
              {depth !== undefined && <th className="p-3 text-amber-400">For {formatLength(depth)}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.angle}
                onClick={() => onPickAngle(r.angle)}
                className="cursor-pointer border-t border-slate-700 text-white hover:bg-slate-700 active:bg-slate-600"
              >
                <td className="p-3 text-xl font-bold">{r.angle}°</td>
                <td className="p-3">
                  <span className="text-xl font-bold">{r.chartMultiplier}</span>
                  <span className="block text-xs text-slate-400">exact {r.exactMultiplier.toFixed(3)}</span>
                </td>
                <td className="p-3 text-xl font-bold">{formatLength(r.shrinkPerInch)}</td>
                {depth !== undefined && (
                  <td className="p-3 text-sm">
                    <span className="block">{formatLength(r.distanceBetweenBends!)} apart</span>
                    <span className="block text-slate-400">{formatLength(r.totalShrink!)} shrink</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-sm text-slate-500">Tap a row to use that angle in the calculator.</p>
    </section>
  )
}
