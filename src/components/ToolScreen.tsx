import { useMemo, useState } from 'react'
import type { ToolResult } from '../lib/bends'
import { formatLength, parseLength } from '../lib/measure'
import { summarize } from '../lib/jobs'
import SaveToJob from './SaveToJob'
import type { JobStore } from './useJobStore'
import { Answer, ChoiceButtons, Counters, HowToBend, inputClass, PipeMarks, Question, ShowTheMath, Stat, Warning } from './ui'

/**
 * One screen that can run ANY tool.
 * Each tool just describes its questions (fields) and a compute function;
 * this component handles inputs, validation and showing the results.
 */

interface FieldBase {
  key: string
  title: string
  hint: string
}

export type Field =
  /** Tape-measure length → inches */
  | (FieldBase & { kind: 'length'; placeholder: string; optional?: boolean })
  /** Plain number (amps, feet, volts) */
  | (FieldBase & { kind: 'number'; placeholder: string; unit?: string; optional?: boolean })
  /** Pick one */
  | (FieldBase & { kind: 'choice'; options: { value: string; label: string }[] })
  /** +/− counters (wires by size) */
  | (FieldBase & { kind: 'counts'; items: { value: string; label: string }[] })
  /** Free text, passed through as-is */
  | (FieldBase & { kind: 'text'; placeholder: string })

/**
 * What compute() receives:
 *  length/number → number (undefined if blank & optional)
 *  choice/text   → string
 *  counts        → Record<string, number>
 */
export type Values = Record<string, unknown>

export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: 'Bending' | 'Electrical' | 'Measuring' | 'Job'
  fields: Field[]
  /** Starting values. counts fields store JSON, e.g. '{"12":3}' */
  initial: Record<string, string>
  compute: (values: Values) => ToolResult
  /** Shown when there are no marks yet, e.g. "Fill in step 3 to get your marks." */
  marksHint?: string
}

type Parsed = { plan: ToolResult; error: null; waiting: null } | { plan: null; error: string | null; waiting: string | null }

function parseFields(tool: ToolDefinition, raw: Record<string, string>): Parsed {
  const values: Values = {}
  for (const [i, field] of tool.fields.entries()) {
    const text = raw[field.key] ?? ''
    const step = `Step ${i + 1}`

    switch (field.kind) {
      case 'choice':
        values[field.key] = text
        break
      case 'text':
        if (text.trim() === '') return { plan: null, error: null, waiting: `Fill in step ${i + 1} to get started.` }
        values[field.key] = text
        break
      case 'counts': {
        const c = text ? (JSON.parse(text) as Record<string, number>) : {}
        if (!Object.values(c).some((n) => n > 0)) return { plan: null, error: null, waiting: `Tap + in step ${i + 1} to add wires.` }
        values[field.key] = c
        break
      }
      case 'length':
      case 'number': {
        if (text.trim() === '') {
          if (!field.optional) return { plan: null, error: null, waiting: `Fill in step ${i + 1} to get started.` }
          values[field.key] = undefined
          break
        }
        const n = field.kind === 'length' ? parseLength(text) : Number(text)
        if (n === null || Number.isNaN(n)) {
          return {
            plan: null,
            error: field.kind === 'length' ? `${step} should look like 6, 5-1/2, or 4' 2-1/2"` : `${step} should be a number`,
            waiting: null,
          }
        }
        values[field.key] = n
        break
      }
    }
  }
  try {
    return { plan: tool.compute(values), error: null, waiting: null }
  } catch (e) {
    return { plan: null, error: (e as Error).message, waiting: null }
  }
}

export default function ToolScreen({ tool, store }: { tool: ToolDefinition; store?: JobStore }) {
  const [raw, setRaw] = useState<Record<string, string>>(tool.initial)
  const set = (key: string, value: string) => setRaw((prev) => ({ ...prev, [key]: value }))

  const result = useMemo(() => parseFields(tool, raw), [raw, tool])
  const plan = result.plan

  return (
    <section className="space-y-4">
      <p className="text-slate-400">{tool.description}</p>

      {tool.fields.map((field, i) => (
        <Question key={field.key} n={i + 1} title={field.title} hint={field.hint}>
          {(field.kind === 'length' || field.kind === 'number' || field.kind === 'text') && (
            <div className="relative">
              <input
                className={inputClass}
                inputMode={field.kind === 'number' ? 'decimal' : 'text'}
                placeholder={field.placeholder}
                value={raw[field.key] ?? ''}
                onChange={(e) => set(field.key, e.target.value)}
              />
              {field.kind === 'number' && field.unit && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">{field.unit}</span>
              )}
            </div>
          )}
          {field.kind === 'choice' && (
            <ChoiceButtons options={field.options} value={raw[field.key]} onChange={(v) => set(field.key, v)} />
          )}
          {field.kind === 'counts' && (
            <Counters
              items={field.items}
              values={raw[field.key] ? JSON.parse(raw[field.key]) : {}}
              onChange={(v) => set(field.key, JSON.stringify(v))}
            />
          )}
        </Question>
      ))}

      {result.error && <Warning>{result.error}</Warning>}
      {result.waiting && <p className="rounded-lg bg-slate-800 p-3 text-slate-400">{result.waiting}</p>}

      {plan && (
        <div className="space-y-4 rounded-xl border-2 border-amber-400 bg-slate-800 p-4">
          {plan.warning && <Warning>{plan.warning}</Warning>}

          {plan.headline && (
            <div className="space-y-2">
              {plan.headline.map((h) => (
                <Answer key={h.label} label={h.label} value={h.value} good={h.good} />
              ))}
            </div>
          )}

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

          {plan.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-3 text-center">
              {plan.stats.map((s) => (
                <Stat key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          )}

          <PipeMarks marks={plan.marks} />
          <HowToBend steps={plan.howToBend} title={plan.notesTitle} />
          <ShowTheMath steps={plan.steps} />
          {store && <SaveToJob store={store} toolId={tool.id} toolName={tool.name} inputs={raw} summary={summarize(plan)} />}
        </div>
      )}
    </section>
  )
}
