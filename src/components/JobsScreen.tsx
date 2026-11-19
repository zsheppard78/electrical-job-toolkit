import { useState } from 'react'
import {
  addJob,
  calcsOnDay,
  deleteCalc,
  deleteJob,
  deleteReport,
  localDate,
  reportToText,
  saveReport,
  type DailyReport,
  type SavedCalc,
} from '../lib/jobs'
import type { JobStore } from './useJobStore'
import type { TeamStore } from './useTeamStore'
import TeamScreen from './TeamScreen'
import { DeleteButton, inputClass, Warning } from './ui'

type View = { name: 'list' } | { name: 'job'; jobId: string } | { name: 'report'; jobId: string; reportId?: string } | { name: 'team'; jobId: string }

interface Props {
  store: JobStore
  teamStore: TeamStore
  /** Reopen a saved calculation in its tool */
  onOpenCalc: (calc: SavedCalc) => void
}

const card = 'rounded-xl bg-slate-800 p-4'
const button = 'rounded-lg py-3 px-4 font-semibold'

export default function JobsScreen({ store, teamStore, onOpenCalc }: Props) {
  const [view, setView] = useState<View>({ name: 'list' })

  if (view.name === 'team') {
    const job = store.state.jobs.find((j) => j.id === view.jobId)
    return <TeamScreen jobId={view.jobId} jobName={job?.name ?? 'Job'} teamStore={teamStore} onBack={() => setView({ name: 'job', jobId: view.jobId })} />
  }
  if (view.name === 'job') return <JobDetail store={store} teamStore={teamStore} jobId={view.jobId} setView={setView} onOpenCalc={onOpenCalc} />
  if (view.name === 'report') return <ReportForm store={store} jobId={view.jobId} reportId={view.reportId} setView={setView} />
  return <JobList store={store} setView={setView} />
}

// ---------------------------------------------------------------------------

function JobList({ store, setView }: { store: JobStore; setView: (v: View) => void }) {
  const { state, setState, saveFailed } = store
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function create() {
    try {
      const { state: next, job } = addJob(state, name)
      setState(next)
      setName('')
      setError(null)
      setView({ name: 'job', jobId: job.id })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      {saveFailed && <Warning>This browser isn't letting the app save. Turn off private browsing to keep your jobs.</Warning>}

      <div className={`${card} space-y-3`}>
        <p className="text-lg font-semibold text-white">New job</p>
        <input className={inputClass} placeholder="e.g. Hospital Floor 3" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <Warning>{error}</Warning>}
        <button onClick={create} className={`${button} w-full bg-amber-400 text-slate-900`}>
          Create job
        </button>
      </div>

      {state.jobs.length === 0 ? (
        <p className="text-center text-slate-400">No jobs yet. Create one, or save a calculation from any tool.</p>
      ) : (
        state.jobs.map((job) => {
          const calcs = state.calcs.filter((c) => c.jobId === job.id).length
          const reports = state.reports.filter((r) => r.jobId === job.id).length
          return (
            <button key={job.id} onClick={() => setView({ name: 'job', jobId: job.id })} className={`${card} block w-full text-left hover:bg-slate-700`}>
              <p className="text-xl font-bold text-white">{job.name}</p>
              <p className="text-sm text-slate-400">
                {calcs} saved calc{calcs === 1 ? '' : 's'} · {reports} report{reports === 1 ? '' : 's'}
              </p>
            </button>
          )
        })
      )}
      <p className="text-center text-xs text-slate-500">Jobs are saved on this device only.</p>
    </section>
  )
}

// ---------------------------------------------------------------------------

function JobDetail({ store, teamStore, jobId, setView, onOpenCalc }: { store: JobStore; teamStore: TeamStore; jobId: string; setView: (v: View) => void; onOpenCalc: (c: SavedCalc) => void }) {
  const { state, setState } = store
  const job = state.jobs.find((j) => j.id === jobId)
  if (!job) {
    return (
      <button onClick={() => setView({ name: 'list' })} className="text-amber-400">
        ← Job not found. Back to jobs
      </button>
    )
  }

  const calcs = state.calcs.filter((c) => c.jobId === jobId)
  const reports = state.reports.filter((r) => r.jobId === jobId).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <section className="space-y-5">
      <button onClick={() => setView({ name: 'list' })} className="text-amber-400">
        ← All jobs
      </button>
      <h2 className="text-2xl font-black text-white">{job.name}</h2>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setView({ name: 'team', jobId })} className={`${button} bg-sky-700 text-lg text-white`}>
          Team & Tasks
        </button>
        <button onClick={() => setView({ name: 'report', jobId })} className={`${button} bg-amber-400 text-lg text-slate-900`}>
          + Daily report
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400">Daily reports</h3>
        {reports.length === 0 && <p className="text-slate-400">None yet.</p>}
        {reports.map((r) => (
          <button key={r.id} onClick={() => setView({ name: 'report', jobId, reportId: r.id })} className={`${card} block w-full text-left hover:bg-slate-700`}>
            <p className="font-bold text-white">
              {r.date}
              {r.hours && <span className="font-normal text-slate-400"> · {r.hours} hrs</span>}
            </p>
            <p className="line-clamp-2 text-sm text-slate-300">{r.workDone}</p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400">Saved calculations</h3>
        {calcs.length === 0 && <p className="text-slate-400">None yet. Tap "Save to a job" on any tool's results.</p>}
        {calcs.map((c) => (
          <div key={c.id} className={`${card} space-y-2`}>
            <div>
              <p className="font-bold text-white">{c.toolName}</p>
              <p className="text-sm text-slate-400">
                {c.location || 'No location'} · {new Date(c.savedAt).toLocaleDateString()}
              </p>
            </div>
            <ul className="text-sm text-slate-200">
              {c.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onOpenCalc(c)} className={`${button} bg-slate-700 text-white`}>
                Open
              </button>
              <DeleteButton onDelete={() => setState(deleteCalc(state, c.id))} />
            </div>
          </div>
        ))}
      </div>

      <DeleteButton
        label="Delete this job"
        onDelete={() => {
          setState(deleteJob(state, jobId))
          teamStore.setTeams((all) => {
            const rest = { ...all }
            delete rest[jobId]
            return rest
          })
          setView({ name: 'list' })
        }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------

/** Share sheet on phones, clipboard on computers, or show the text to copy by hand. */
async function shareText(text: string): Promise<'shared' | 'copied' | 'show' | 'cancelled'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Daily report', text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'show'
  }
}

function ReportForm({ store, jobId, reportId, setView }: { store: JobStore; jobId: string; reportId?: string; setView: (v: View) => void }) {
  const { state, setState } = store
  const job = state.jobs.find((j) => j.id === jobId)
  const existing = state.reports.find((r) => r.id === reportId)
  const lastName = state.reports[0]?.name ?? ''

  const [report, setReport] = useState<Omit<DailyReport, 'id'> & { id?: string }>(
    existing ?? { jobId, date: localDate(), name: lastName, hours: '', workDone: '', materials: '', issues: '', tomorrow: '' },
  )
  const [includeCalcs, setIncludeCalcs] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [showText, setShowText] = useState(false)

  const set = (key: keyof DailyReport, value: string) => setReport((r) => ({ ...r, [key]: value }))
  const dayCalcs = calcsOnDay(state, jobId, report.date)
  const materialCalcs = dayCalcs.filter((c) => c.toolId === 'materials')
  const text = reportToText({ ...report, id: report.id ?? '' }, job, includeCalcs ? dayCalcs : [])

  function save(): boolean {
    try {
      const next = saveReport(state, report)
      setState(next)
      // Remember the id so saving again edits instead of duplicating.
      if (!report.id) setReport((r) => ({ ...r, id: next.reports[0].id }))
      setStatus('✓ Saved')
      return true
    } catch (e) {
      setStatus((e as Error).message)
      return false
    }
  }

  async function share() {
    if (!save()) return
    const result = await shareText(text)
    if (result === 'copied') setStatus('✓ Saved and copied. Paste it in a text or email.')
    if (result === 'show') setShowText(true)
  }

  const textarea = `${inputClass} min-h-24 text-lg`

  return (
    <section className="space-y-4">
      <button onClick={() => setView({ name: 'job', jobId })} className="text-amber-400">
        ← {job?.name ?? 'Back'}
      </button>
      <h2 className="text-2xl font-black text-white">Daily report</h2>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm text-slate-400">Date</span>
          <input type="date" className={`${inputClass} text-lg`} value={report.date} onChange={(e) => set('date', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-400">Hours</span>
          <input className={`${inputClass} text-lg`} inputMode="decimal" placeholder="8" value={report.hours} onChange={(e) => set('hours', e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm text-slate-400">Your name</span>
        <input className={`${inputClass} text-lg`} value={report.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-slate-400">Work done *</span>
        <textarea className={textarea} placeholder='e.g. Ran 3/4" EMT from panel B to rooms 301–305' value={report.workDone} onChange={(e) => set('workDone', e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-slate-400">Materials used</span>
        <textarea className={textarea} placeholder="e.g. 10 sticks 3/4 EMT, 12 connectors" value={report.materials} onChange={(e) => set('materials', e.target.value)} />
      </label>
      {materialCalcs.length > 0 && (
        <button
          onClick={() =>
            set('materials', [report.materials.trim(), ...materialCalcs.map((c) => `${c.location ? c.location + ': ' : ''}${c.summary.join(', ')}`)].filter(Boolean).join('\n'))
          }
          className={`${button} w-full bg-slate-700 text-white`}
        >
          + Add today's material lists ({materialCalcs.length})
        </button>
      )}
      <label className="block">
        <span className="text-sm text-slate-400">Issues / delays</span>
        <textarea className={textarea} placeholder="e.g. Waiting on ceiling grid in 304" value={report.issues} onChange={(e) => set('issues', e.target.value)} />
      </label>
      <label className="block">
        <span className="text-sm text-slate-400">Plan for tomorrow</span>
        <textarea className={textarea} value={report.tomorrow} onChange={(e) => set('tomorrow', e.target.value)} />
      </label>

      {dayCalcs.length > 0 && (
        <label className="flex items-center gap-3 text-slate-200">
          <input type="checkbox" className="h-6 w-6" checked={includeCalcs} onChange={(e) => setIncludeCalcs(e.target.checked)} />
          Include {dayCalcs.length} calculation{dayCalcs.length === 1 ? '' : 's'} saved this day
        </label>
      )}

      {status && <p className={status.startsWith('✓') ? 'text-emerald-400' : 'text-rose-300'}>{status}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={save} className={`${button} bg-slate-700 text-white`}>
          Save
        </button>
        <button onClick={share} className={`${button} bg-amber-400 text-slate-900`}>
          Save & send
        </button>
      </div>
      <a
        href={`mailto:?subject=${encodeURIComponent(`Daily report: ${job?.name ?? ''} ${report.date}`)}&body=${encodeURIComponent(text)}`}
        onClick={() => save()}
        className={`${button} block w-full bg-slate-700 text-center text-white`}
      >
        Email it
      </a>

      {showText && (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Copy this and paste it in a text or email:</p>
          <textarea readOnly className={`${inputClass} min-h-64 text-sm`} value={text} onFocus={(e) => e.target.select()} />
        </div>
      )}

      {existing && (
        <DeleteButton
          label="Delete report"
          onDelete={() => {
            setState(deleteReport(state, existing.id))
            setView({ name: 'job', jobId })
          }}
        />
      )}
    </section>
  )
}
