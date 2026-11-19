import type { ToolResult } from './bends'
import { formatLength } from './measure'

/**
 * Jobs, saved calculations and daily reports.
 *
 * The functions here are "pure": they take the current state and return a NEW
 * state instead of changing the old one. That makes them easy to test, and it's
 * how React expects state to be updated. Saving to the phone happens elsewhere.
 */

export interface Job {
  id: string
  name: string
  createdAt: string
}

export interface SavedCalc {
  id: string
  jobId: string
  toolId: string
  toolName: string
  /** Where on the job, e.g. "Floor 3, run to panel B" */
  location: string
  /** The raw inputs, so the calculation can be reopened */
  inputs: Record<string, string>
  /** Short readable results, e.g. ["1st mark: 3' 1-1/2\"", ...] */
  summary: string[]
  savedAt: string
}

export interface DailyReport {
  id: string
  jobId: string
  /** YYYY-MM-DD */
  date: string
  name: string
  hours: string
  workDone: string
  materials: string
  issues: string
  tomorrow: string
}

export interface JobState {
  jobs: Job[]
  calcs: SavedCalc[]
  reports: DailyReport[]
}

export const EMPTY_STATE: JobState = { jobs: [], calcs: [], reports: [] }

/** Works everywhere (crypto.randomUUID needs https, which a phone on your Wi-Fi may not have). */
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// --- Jobs -------------------------------------------------------------------

export function addJob(state: JobState, name: string, now = new Date()): { state: JobState; job: Job } {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Give the job a name')
  const job: Job = { id: newId(), name: trimmed, createdAt: now.toISOString() }
  return { state: { ...state, jobs: [job, ...state.jobs] }, job }
}

/** Deleting a job deletes everything saved under it. */
export function deleteJob(state: JobState, jobId: string): JobState {
  return {
    jobs: state.jobs.filter((j) => j.id !== jobId),
    calcs: state.calcs.filter((c) => c.jobId !== jobId),
    reports: state.reports.filter((r) => r.jobId !== jobId),
  }
}

// --- Saved calculations ------------------------------------------------------

export function saveCalc(state: JobState, calc: Omit<SavedCalc, 'id' | 'savedAt'>, now = new Date()): JobState {
  if (!state.jobs.some((j) => j.id === calc.jobId)) throw new Error('Pick a job first')
  const saved: SavedCalc = { ...calc, location: calc.location.trim(), id: newId(), savedAt: now.toISOString() }
  return { ...state, calcs: [saved, ...state.calcs] }
}

export function deleteCalc(state: JobState, id: string): JobState {
  return { ...state, calcs: state.calcs.filter((c) => c.id !== id) }
}

/** Turn a tool result into a few readable lines to store with the save. */
export function summarize(result: ToolResult): string[] {
  const lines: string[] = []
  for (const h of result.headline ?? []) lines.push(`${h.label}: ${h.value}`)
  for (const m of result.marks) lines.push(`${m.label}: ${formatLength(m.at)}`)
  if (lines.length === 0) for (const s of result.stats.slice(0, 2)) lines.push(`${s.label}: ${s.value}`)
  if (result.warning) lines.push(`⚠ ${result.warning}`)
  return lines
}

// --- Daily reports -----------------------------------------------------------

export function saveReport(state: JobState, report: Omit<DailyReport, 'id'> & { id?: string }): JobState {
  if (!state.jobs.some((j) => j.id === report.jobId)) throw new Error('Pick a job first')
  if (!report.workDone.trim()) throw new Error('Fill in the work done')
  // Same id = editing an existing report
  if (report.id && state.reports.some((r) => r.id === report.id)) {
    return { ...state, reports: state.reports.map((r) => (r.id === report.id ? (report as DailyReport) : r)) }
  }
  return { ...state, reports: [{ ...report, id: newId() }, ...state.reports] }
}

export function deleteReport(state: JobState, id: string): JobState {
  return { ...state, reports: state.reports.filter((r) => r.id !== id) }
}

/** Calculations saved to a job on a given day (YYYY-MM-DD, local time). */
export function calcsOnDay(state: JobState, jobId: string, date: string): SavedCalc[] {
  return state.calcs.filter((c) => c.jobId === jobId && localDate(new Date(c.savedAt)) === date)
}

export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Plain-text version of a report, for texting or emailing to the foreman. */
export function reportToText(report: DailyReport, job: Job | undefined, calcs: SavedCalc[] = []): string {
  const section = (title: string, body: string) => (body.trim() ? `\n${title}:\n${body.trim()}\n` : '')
  const calcText = calcs.length
    ? `\nCalculations:\n${calcs.map((c) => `- ${c.toolName}${c.location ? ` (${c.location})` : ''}: ${c.summary.join('; ')}`).join('\n')}\n`
    : ''
  return (
    `DAILY REPORT: ${job?.name ?? 'Unknown job'}\n` +
    `Date: ${report.date}\n` +
    (report.name.trim() ? `Name: ${report.name.trim()}\n` : '') +
    (report.hours.trim() ? `Hours: ${report.hours.trim()}\n` : '') +
    section('Work done', report.workDone) +
    section('Materials used', report.materials) +
    section('Issues / delays', report.issues) +
    section('Plan for tomorrow', report.tomorrow) +
    calcText
  ).trim()
}

// --- Saving to the phone -------------------------------------------------------

const STORAGE_KEY = 'electrical-toolkit:v1'

/** Read saved data. Anything broken or missing → start empty instead of crashing. */
export function loadState(storage: Pick<Storage, 'getItem'> | undefined): JobState {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    if (!text) return EMPTY_STATE
    const data = JSON.parse(text) as Partial<JobState>
    return { jobs: data.jobs ?? [], calcs: data.calcs ?? [], reports: data.reports ?? [] }
  } catch {
    return EMPTY_STATE
  }
}

export function persistState(storage: Pick<Storage, 'setItem'> | undefined, state: JobState): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false // storage full or blocked (private browsing)
  }
}
