import { describe, it, expect } from 'vitest'
import {
  addJob,
  calcsOnDay,
  deleteJob,
  EMPTY_STATE,
  loadState,
  persistState,
  reportToText,
  saveCalc,
  saveReport,
  summarize,
} from './jobs'
import { calculateOffset } from './offset'
import { stubUp } from './bends'

/** A fake phone storage so tests don't need a browser. */
function memoryStorage() {
  const data: Record<string, string> = {}
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}

const report = (jobId: string) => ({
  jobId,
  date: '2026-11-19',
  name: 'Zach',
  hours: '8',
  workDone: 'Ran 3/4" EMT to panel B',
  materials: '10 sticks 3/4" EMT',
  issues: '',
  tomorrow: 'Pull wire',
})

describe('jobs', () => {
  it('adds a job to the top of the list', () => {
    const { state, job } = addJob(EMPTY_STATE, '  Hospital Floor 3  ')
    expect(job.name).toBe('Hospital Floor 3')
    expect(state.jobs[0]).toBe(job)
  })

  it('does not change the old state (pure function)', () => {
    addJob(EMPTY_STATE, 'Job')
    expect(EMPTY_STATE.jobs).toHaveLength(0)
  })

  it('needs a name', () => {
    expect(() => addJob(EMPTY_STATE, '   ')).toThrow()
  })

  it('deleting a job deletes its calcs and reports', () => {
    let { state, job } = addJob(EMPTY_STATE, 'A')
    const other = addJob(state, 'B')
    state = other.state
    state = saveCalc(state, { jobId: job.id, toolId: 'stub', toolName: 'Stub', location: '', inputs: {}, summary: [] })
    state = saveCalc(state, { jobId: other.job.id, toolId: 'stub', toolName: 'Stub', location: '', inputs: {}, summary: [] })
    state = saveReport(state, report(job.id))
    state = deleteJob(state, job.id)
    expect(state.jobs.map((j) => j.name)).toEqual(['B'])
    expect(state.calcs).toHaveLength(1)
    expect(state.reports).toHaveLength(0)
  })
})

describe('saved calculations', () => {
  it('needs an existing job', () => {
    expect(() => saveCalc(EMPTY_STATE, { jobId: 'nope', toolId: 'x', toolName: 'x', location: '', inputs: {}, summary: [] })).toThrow()
  })

  it('summarizes marks and headline answers', () => {
    expect(summarize(stubUp(14, '1/2'))).toEqual(['Mark: 9"'])
  })

  it('finds calcs saved on a given day', () => {
    const { state: s1, job } = addJob(EMPTY_STATE, 'A')
    const s2 = saveCalc(s1, { jobId: job.id, toolId: 'x', toolName: 'X', location: '', inputs: {}, summary: [] }, new Date(2026, 10, 19, 9))
    const s3 = saveCalc(s2, { jobId: job.id, toolId: 'x', toolName: 'X', location: '', inputs: {}, summary: [] }, new Date(2026, 10, 18, 9))
    expect(calcsOnDay(s3, job.id, '2026-11-19')).toHaveLength(1)
  })
})

describe('daily reports', () => {
  it('saves, then edits in place when the id matches', () => {
    const { state, job } = addJob(EMPTY_STATE, 'A')
    const saved = saveReport(state, report(job.id))
    const id = saved.reports[0].id
    const edited = saveReport(saved, { ...saved.reports[0], hours: '10' })
    expect(edited.reports).toHaveLength(1)
    expect(edited.reports[0]).toMatchObject({ id, hours: '10' })
  })

  it('requires work done', () => {
    const { state, job } = addJob(EMPTY_STATE, 'A')
    expect(() => saveReport(state, { ...report(job.id), workDone: ' ' })).toThrow()
  })

  it('formats a text report, skipping empty sections', () => {
    const { state, job } = addJob(EMPTY_STATE, 'Hospital')
    const s = saveReport(state, report(job.id))
    const offset = calculateOffset({ depth: 6, angle: 30 })
    const text = reportToText(s.reports[0], job, [
      { id: '1', jobId: job.id, toolId: 'offset', toolName: 'Offset', location: 'Panel B', inputs: {}, summary: [`Between bends: 1' 0"`], savedAt: '' },
    ])
    expect(offset.distanceBetweenBends).toBeCloseTo(12)
    expect(text).toContain('DAILY REPORT: Hospital')
    expect(text).toContain('Hours: 8')
    expect(text).toContain('Plan for tomorrow:\nPull wire')
    expect(text).toContain(`- Offset (Panel B): Between bends: 1' 0"`)
    expect(text).not.toContain('Issues')
  })
})

describe('saving to the phone', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const { state } = addJob(EMPTY_STATE, 'A')
    expect(persistState(storage, state)).toBe(true)
    expect(loadState(storage)).toEqual(state)
  })

  it('starts empty when storage is missing or corrupted', () => {
    expect(loadState(undefined)).toEqual(EMPTY_STATE)
    const storage = memoryStorage()
    storage.setItem('electrical-toolkit:v1', '{not json')
    expect(loadState(storage)).toEqual(EMPTY_STATE)
  })
})
