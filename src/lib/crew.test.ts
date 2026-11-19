import { describe, it, expect } from 'vitest'
import {
  addComment,
  addCrew,
  addMember,
  addNote,
  addPersonAs,
  addTask,
  allowedVisibilities,
  canCreateTask,
  crewsInScope,
  deleteTask,
  exampleTeam,
  loadTeams,
  PermissionError,
  persistTeams,
  toggleTask,
  visibleNotes,
  visibleTasks,
  type Team,
} from './crew'

/** Look people and crews up by name so the tests read like the jobsite. */
function setup() {
  const team = exampleTeam('job1')
  const id = (name: string) => team.people.find((p) => p.name === name)!.id
  const crew = (foreman: string) => team.crews.find((c) => c.foremanId === id(foreman))!.id
  const titles = (t: Team, name: string) => visibleTasks(t, id(name)).map((x) => x.title)
  return { team, id, crew, titles }
}

describe('who sees which tasks', () => {
  const { team, titles } = setup()

  it('crew members only see "whole crew" tasks on their own crew', () => {
    expect(titles(team, 'Zach')).toEqual(['Pull wire to 301–305', 'Pipe rooms 301–305 to panel B'])
  })

  it('crew members on another crew see none of them', () => {
    expect(titles(team, 'Ana')).toEqual([])
  })

  it('the foreman also sees "foreman & up" tasks, but not "GF & PM only"', () => {
    const dave = titles(team, 'Dave')
    expect(dave).toContain('East wing is 2 days behind. Get it back on schedule')
    expect(dave.some((t) => t.startsWith('Change order'))).toBe(false)
  })

  it('another foreman does not see Dave\'s crew tasks', () => {
    expect(titles(team, 'Luis')).toEqual([])
  })

  it('the GF and PMs see everything in their scope', () => {
    expect(titles(team, 'Mike')).toHaveLength(4)
    expect(titles(team, 'Jeremy')).toHaveLength(4)
    expect(titles(team, 'Sarah')).toHaveLength(4)
  })
})

describe('notes from the GF', () => {
  const { team, id } = setup()
  const notes = (name: string) => visibleNotes(team, id(name)).map((n) => n.text)

  it('crew members never see notes', () => {
    expect(notes('Zach')).toEqual([])
    expect(notes('Ana')).toEqual([])
  })

  it('area-wide notes go to every foreman in the area; crew notes only to that foreman', () => {
    expect(notes('Dave')).toHaveLength(2)
    expect(notes('Luis')).toEqual(['Inspector walking Floor 3 Thursday 9am. Covers off, labels on.'])
  })

  it('crew members and foremen cannot post notes', () => {
    const area = team.areas[0].id
    expect(() => addNote(team, id('Dave'), { areaId: area, text: 'hi' })).toThrow(PermissionError)
    expect(() => addNote(team, id('Zach'), { areaId: area, text: 'hi' })).toThrow(PermissionError)
  })
})

describe('creating tasks', () => {
  const { team, id, crew } = setup()

  it('crew members cannot create tasks', () => {
    expect(canCreateTask(team, id('Zach'), crew('Dave'), 'crew')).toBe(false)
    expect(() =>
      addTask(team, id('Zach'), { crewId: crew('Dave'), title: 'x', details: '', priority: 'normal', visibility: 'crew' }),
    ).toThrow(PermissionError)
  })

  it('a foreman can create crew and foreman-level tasks for their own crew only', () => {
    expect(canCreateTask(team, id('Dave'), crew('Dave'), 'crew')).toBe(true)
    expect(canCreateTask(team, id('Dave'), crew('Dave'), 'foreman')).toBe(true)
    expect(canCreateTask(team, id('Dave'), crew('Dave'), 'leadership')).toBe(false)
    expect(canCreateTask(team, id('Dave'), crew('Luis'), 'crew')).toBe(false)
  })

  it('visibility options match the role', () => {
    expect(allowedVisibilities('crew')).toEqual(['crew'])
    expect(allowedVisibilities('foreman')).toEqual(['crew', 'foreman'])
    expect(allowedVisibilities('gf')).toEqual(['crew', 'foreman', 'leadership'])
  })
})

describe('working on tasks', () => {
  const { team, id } = setup()
  const crewTask = team.tasks.find((t) => t.visibility === 'crew')!
  const foremanTask = team.tasks.find((t) => t.visibility === 'foreman')!

  it('crew members can check off and comment on tasks they can see', () => {
    let t = toggleTask(team, id('Zach'), crewTask.id)
    expect(t.tasks.find((x) => x.id === crewTask.id)).toMatchObject({ done: true, doneById: id('Zach') })
    t = addComment(t, id('Zach'), crewTask.id, 'Waiting on ceiling grid in 304')
    expect(t.tasks.find((x) => x.id === crewTask.id)!.comments[0].text).toBe('Waiting on ceiling grid in 304')
  })

  it('crew members cannot touch tasks they cannot see', () => {
    expect(() => toggleTask(team, id('Zach'), foremanTask.id)).toThrow(PermissionError)
    expect(() => addComment(team, id('Zach'), foremanTask.id, 'hi')).toThrow(PermissionError)
  })

  it('crew members cannot delete tasks; the foreman can', () => {
    expect(() => deleteTask(team, id('Zach'), crewTask.id)).toThrow(PermissionError)
    expect(deleteTask(team, id('Dave'), crewTask.id).tasks).toHaveLength(team.tasks.length - 1)
  })
})

describe('managing crews', () => {
  const { team, id, crew } = setup()

  it('the GF of the area can add crews and members; a foreman cannot', () => {
    const area = team.areas[0].id
    expect(() => addCrew(team, id('Dave'), { name: 'x', areaId: area, foremanId: id('Luis') })).toThrow(PermissionError)
    const t = addMember(team, id('Mike'), crew('Luis'), id('Tyler'))
    expect(crewsInScope(t, id('Tyler'))).toHaveLength(2)
  })

  it('a PM can add anyone; a GF only foremen and crew; foremen and crew nobody', () => {
    expect(addPersonAs(team, id('Jeremy'), 'New GF', 'gf').people).toHaveLength(team.people.length + 1)
    expect(addPersonAs(team, id('Mike'), 'New guy', 'crew').people).toHaveLength(team.people.length + 1)
    expect(() => addPersonAs(team, id('Mike'), 'New PM', 'pm')).toThrow(PermissionError)
    expect(() => addPersonAs(team, id('Dave'), 'New guy', 'crew')).toThrow(PermissionError)
    expect(() => addPersonAs(team, id('Zach'), 'New guy', 'crew')).toThrow(PermissionError)
  })

  it('only crew members can be added to a crew', () => {
    expect(() => addMember(team, id('Mike'), crew('Dave'), id('Luis'))).toThrow()
  })
})

describe('saving', () => {
  it('round-trips through storage and survives bad data', () => {
    const data: Record<string, string> = {}
    const storage = { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) }
    const state = { job1: exampleTeam('job1') }
    persistTeams(storage, state)
    expect(loadTeams(storage)).toEqual(state)
    data['electrical-toolkit:teams:v1'] = 'broken'
    expect(loadTeams(storage)).toEqual({})
  })
})
