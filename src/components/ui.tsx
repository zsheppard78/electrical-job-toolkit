import { useState, type ReactNode } from 'react'
import type { Step } from '../lib/offset'
import type { Mark } from '../lib/bends'
import { formatLength } from '../lib/measure'

/** Small building blocks shared by every calculator screen. */

export const inputClass =
  'w-full rounded-lg bg-slate-900 border border-slate-600 px-4 py-3 text-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400'

/** A numbered question card, so each screen reads top to bottom like a checklist. */
export function Question({ n, title, hint, children }: { n: number; title: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-800 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-slate-900">
          {n}
        </span>
        <div>
          <p className="text-lg font-semibold text-white">{title}</p>
          <p className="text-sm text-slate-400">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

/** A row of big tap-friendly buttons (angles, bender sizes...). */
export function ChoiceButtons<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    // Long labels (like box sizes) get 2 columns; short ones (angles) up to 5.
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.some((o) => o.label.length > 8) ? 2 : Math.min(options.length, 5)}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-1 py-3 text-base font-bold ${value === o.value ? 'bg-amber-400 text-slate-900' : 'bg-slate-900 text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A big answer. With n: a numbered mark. With good: green (pass) or red (fail). */
export function Answer({ n, label, value, good }: { n?: number; label: string; value: string; good?: boolean }) {
  const color = good === undefined ? 'text-white' : good ? 'text-emerald-400' : 'text-rose-400'
  return (
    <div className="flex items-center gap-3 rounded-lg bg-slate-900 p-3">
      {n !== undefined && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-lg font-bold text-white">{n}</span>
      )}
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className={`text-3xl font-black ${color}`}>{value}</p>
      </div>
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

export function Warning({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-rose-950 p-3 text-rose-300">{children}</p>
}

export function HowToBend({ steps, title = 'How to bend it' }: { steps: string[]; title?: string }) {
  if (steps.length === 0) return null
  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <p className="mb-2 font-semibold text-white">{title}</p>
      <ol className="list-decimal space-y-1 pl-5 text-slate-200">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </div>
  )
}

export function ShowTheMath({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(!open)} className="w-full rounded-lg border border-amber-400 py-3 font-semibold text-amber-400">
        {open ? 'Hide the math' : 'Show me the math'}
      </button>
      {open && (
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.title + i} className="rounded-lg bg-slate-900 p-3">
              <p className="font-semibold text-amber-400">
                {i + 1}. {step.title}
              </p>
              <p className="text-slate-200">{step.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

/**
 * The straight pipe BEFORE bending, with each mark drawn where it goes.
 * Only marks measured from the end of the pipe are drawn.
 */
export function PipeMarks({ marks }: { marks: Mark[] }) {
  const drawn = marks.filter((m) => m.fromEnd && m.at >= 0)
  if (drawn.length === 0) return null

  const W = 340
  const left = 20
  const right = W - 20
  const longest = Math.max(...drawn.map((m) => m.at)) * 1.15
  const x = (inches: number) => left + (inches / longest) * (right - left)

  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <p className="mb-1 text-sm text-slate-400">Your pipe before bending (hook your tape on the left end)</p>
      <svg viewBox={`0 0 ${W} 110`} className="w-full" role="img" aria-label="Marks on the pipe">
        <rect x={left} y={45} width={right - left} height={12} rx={3} className="fill-amber-400" />
        <line x1={left} y1={35} x2={left} y2={67} className="stroke-white" strokeWidth={3} />
        <text x={left - 6} y={28} className="fill-white text-[10px] font-semibold">END</text>
        {drawn.map((m, i) => {
          const above = i % 2 === 0 // alternate labels above/below so close marks don't overlap
          const cx = x(m.at)
          return (
            <g key={i}>
              <line x1={cx} y1={40} x2={cx} y2={62} className="stroke-rose-500" strokeWidth={3} />
              <circle cx={cx} cy={above ? 28 : 78} r={9} className="fill-rose-500" />
              <text x={cx} y={above ? 32 : 82} textAnchor="middle" className="fill-white text-[11px] font-bold">
                {i + 1}
              </text>
              <text x={cx} y={above ? 12 : 102} textAnchor="middle" className="fill-slate-200 text-[10px]">
                {formatLength(m.at)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** +/− counters, e.g. how many #12 wires. Big buttons for gloves. */
export function Counters({
  items,
  values,
  onChange,
}: {
  items: { value: string; label: string }[]
  values: Record<string, number>
  onChange: (values: Record<string, number>) => void
}) {
  const set = (key: string, n: number) => onChange({ ...values, [key]: Math.max(0, n) })
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const n = values[item.value] ?? 0
        return (
          <div key={item.value} className={`flex items-center justify-between rounded-lg p-1 ${n > 0 ? 'bg-slate-700' : 'bg-slate-900'}`}>
            <button onClick={() => set(item.value, n - 1)} className="h-11 w-11 rounded-md bg-slate-800 text-2xl text-white" aria-label={`fewer ${item.label}`}>
              −
            </button>
            <span className="text-center">
              <span className="block text-xs text-slate-400">{item.label}</span>
              <span className="text-xl font-bold text-white">{n}</span>
            </span>
            <button onClick={() => set(item.value, n + 1)} className="h-11 w-11 rounded-md bg-slate-800 text-2xl text-white" aria-label={`more ${item.label}`}>
              +
            </button>
          </div>
        )
      })}
    </div>
  )
}
