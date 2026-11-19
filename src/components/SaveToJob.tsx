import { useState } from 'react'
import { addJob, saveCalc } from '../lib/jobs'
import type { JobStore } from './useJobStore'
import { inputClass } from './ui'

interface Props {
  store: JobStore
  toolId: string
  toolName: string
  inputs: Record<string, string>
  summary: string[]
}

/** "Save to job" button that opens a small form: pick/create a job, add a location. */
export default function SaveToJob({ store, toolId, toolName, inputs, summary }: Props) {
  const { state, setState } = store
  const [open, setOpen] = useState(false)
  const [jobId, setJobId] = useState(state.jobs[0]?.id ?? '')
  const [newJobName, setNewJobName] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setMessage(null) }} className="w-full rounded-lg bg-emerald-600 py-3 font-semibold text-white">
        {message ?? 'Save to a job'}
      </button>
    )
  }

  // If the remembered job was deleted, fall back to the first job.
  const selected = jobId === 'new' || state.jobs.some((j) => j.id === jobId) ? jobId : (state.jobs[0]?.id ?? '')
  const creating = state.jobs.length === 0 || selected === 'new'

  function save() {
    try {
      let next = state
      let targetJob = selected
      if (creating) {
        const created = addJob(state, newJobName)
        next = created.state
        targetJob = created.job.id
      }
      next = saveCalc(next, { jobId: targetJob, toolId, toolName, location, inputs, summary })
      setState(next)
      setJobId(targetJob)
      setLocation('')
      setNewJobName('')
      setOpen(false)
      setMessage(`✓ Saved to ${next.jobs.find((j) => j.id === targetJob)?.name}. Save again?`)
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-600 bg-slate-900 p-3">
      <p className="font-semibold text-white">Save to a job</p>

      {state.jobs.length > 0 && (
        <select className={`${inputClass} text-lg`} value={selected} onChange={(e) => setJobId(e.target.value)}>
          {state.jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
          <option value="new">+ New job…</option>
        </select>
      )}

      {creating && (
        <input className={`${inputClass} text-lg`} placeholder="Job name, e.g. Hospital Floor 3" value={newJobName} onChange={(e) => setNewJobName(e.target.value)} />
      )}

      <input
        className={`${inputClass} text-lg`}
        placeholder="Where? e.g. Run to panel B (optional)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      {message && <p className="text-rose-300">{message}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setOpen(false)} className="rounded-lg bg-slate-700 py-3 text-white">
          Cancel
        </button>
        <button onClick={save} className="rounded-lg bg-emerald-600 py-3 font-semibold text-white">
          Save
        </button>
      </div>
    </div>
  )
}
