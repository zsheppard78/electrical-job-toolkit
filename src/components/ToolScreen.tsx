import { useMemo, useState } from 'react'
import type { BendPlan } from '../lib/bends'
import { formatLength, parseLength } from '../lib/measure'
import { Answer, ChoiceButtons, HowToBend, inputClass, PipeMarks, Question, ShowTheMath, Stat, Warning } from './ui'

/**
 * One screen that can run ANY bend calculator.
 * Each tool just describes its questions (fields) and a compute function;
 * this component handles inputs, validation and showing the results.
 */

export type Field =
  | { kind: 'length'; key: string; title: string; hint: string; placeholder: string; optional?: boolean }
  | { kind: 'choice'; key: string; title: string; hint: string; options: { value: string; label: string }[] }

/** What compute() receives: lengths parsed to inches (undefined if blank), choices as strings. */
export type Values = Record<string, number | string | undefined>

export interface ToolDefinition {
  id: string
  name: string
  description: string
  fields: Field[]
  initial: Record<string, string>
  compute: (values: Values) => BendPlan
  /** Shown when the optional fields are blank, e.g. "Fill in step 3 to get your marks." */
  marksHint?: string
}

export default function ToolScreen({ tool }: { tool: ToolDefinition }) {
  const [raw, setRaw] = useState<Record<string, string>>(tool.initial)
  const set = (key: string, value: string) => setRaw((prev) => ({ ...prev, [key]: value }))

  const { plan, error, waiting } = useMemo(() => {
    const values: Values = {}
    for (const [i, field] of tool.fields.entries()) {
      const text = raw[field.key] ?? ''
      if (field.kind === 'choice') {
        values[field.key] = text
        continue
      }
      if (text.trim() === '') {
        if (!field.optional) return { plan: null, error: null, waiting: `Fill in step ${i + 1} to get started.` }
        values[field.key] = undefined
        continue
      }
      const inches = parseLength(text)
      if (inches === null) return { plan: null, error: `Step ${i + 1} should look like 6, 5-1/2, or 4' 2-1/2"`, waiting: null }
      values[field.key] = inches
    }
    try {
      return { plan: tool.compute(values), error: null, waiting: null }
    } catch (e) {
      return { plan: null, error: (e as Error).message, waiting: null }
    }
  }, [raw, tool])

  return (
    <section className="space-y-4">
      <p className="text-slate-400">{tool.description}</p>

      {tool.fields.map((field, i) => (
        <Question key={field.key} n={i + 1} title={field.title} hint={field.hint}>
          {field.kind === 'length' ? (
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder={field.placeholder}
              value={raw[field.key] ?? ''}
              onChange={(e) => set(field.key, e.target.value)}
            />
          ) : (
            <ChoiceButtons options={field.options} value={raw[field.key]} onChange={(v) => set(field.key, v)} />
          )}
        </Question>
      ))}

      {error && <Warning>{error}</Warning>}
      {waiting && <p className="rounded-lg bg-slate-800 p-3 text-slate-400">{waiting}</p>}

      {plan && (
        <div className="space-y-4 rounded-xl border-2 border-amber-400 bg-slate-800 p-4">
          {plan.warning && <Warning>{plan.warning}</Warning>}

          {plan.marks.length > 0 ? (
            <div className="space-y-2">
              {plan.marks.every((m) => m.fromEnd) && (
                <p className="text-sm uppercase tracking-wide text-slate-400">Measure from the end of the pipe</p>
              )}
              {plan.marks.map((m, i) => (
                <Answer key={m.label} n={i + 1} label={m.label} value={formatLength(m.at)} />
              ))}
            </div>
          ) : (
            tool.marksHint && <p className="rounded-lg bg-slate-900 p-3 text-slate-300">{tool.marksHint}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-center">
            {plan.stats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} />
            ))}
          </div>

          <PipeMarks marks={plan.marks} />
          <HowToBend steps={plan.howToBend} />
          <ShowTheMath steps={plan.steps} />
        </div>
      )}
    </section>
  )
}
