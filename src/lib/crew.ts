import { newId } from './jobs'

/**
 * Crews, tasks and notes, with role-based permissions.
 *
 *   PM ─┬─ General Foreman (runs an area, e.g. "Floor 3")
 *       │     └─ Foreman (runs a crew)
 *       │           └─ Crew members
 *
 * Every rule about who can SEE or DO something lives in this file as a plain
 * function. Today the app calls them; when the Spring Boot server exists, the
 * server enforces the exact same rules (the app can't be trusted to hide data
 * on its own, because whoever holds the phone can read its storage).
 */

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export type Role = 'pm' | 'gf' | 'foreman' | 'crew'

export const ROLE_LABEL: Record<Role, string> = {
  pm: 'Project Manager',
  gf: 'General Foreman',
  foreman: 'Foreman',
  crew: 'Crew member',
}

/** Higher number = more authority */
const RANK: Record<Role, number> = { crew: 0, foreman: 1, gf: 2, pm: 3 }

export interface Person {
  id: string
  name: string
  role: Role
}

/** A floor or area, run by a General Foreman */
export interface Area {
  id: string
  name: string
  gfId?: string
}

export interface Crew {
  id: string
  name: string
  areaId: string
  foremanId: string
  memberIds: string[]
}

/** Who can see a task */
export type Visibility = 'crew' | 'foreman' | 'leadership'

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  crew: 'Whole crew',
  foreman: 'Foreman & up',
  leadership: 'GF & PM only',
}

/** Lowest role that can see each visibility level */
const MIN_RANK: Record<Visibility, number> = { crew: 0, foreman: 1, leadership: 2 }

export interface Comment {
  id: string
  byId: string
  text: string
  at: string
}

export interface Task {
  id: string
  crewId: string
  title: string
  details: string
  priority: 'normal' | 'high'
  visibility: Visibility
  done: boolean
  doneById?: string
  createdById: string
  createdAt: string
  comments: Comment[]
}

/** A note from a GF (or PM) to the foremen in an area, or to one crew's foreman. */
export interface Note {
  id: string
  fromId: string
  areaId: string
  /** undefined = every foreman in the area */
  crewId?: string
  text: string
  at: string
}

export interface Team {
  jobId: string
  people: Person[]
  areas: Area[]
  crews: Crew[]
  tasks: Task[]
  notes: Note[]
}

export const emptyTeam = (jobId: string): Team => ({ jobId, people: [], areas: [], crews: [], tasks: [], notes: [] })

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export class PermissionError extends Error {}

function person(team: Team, id: string): Person {
  const p = team.people.find((x) => x.id === id)
  if (!p) throw new Error('Person not found')
  return p
}

function crewById(team: Team, id: string): Crew {
  const c = team.crews.find((x) => x.id === id)
  if (!c) throw new Error('Crew not found')
  return c
}

export const personName = (team: Team, id: string | undefined) => team.people.find((p) => p.id === id)?.name ?? 'Unknown'

// ---------------------------------------------------------------------------
// Permission rules
// ---------------------------------------------------------------------------

/** The crews a person is connected to. PM: all. GF: crews in their areas. Foreman: crews they run. Crew: crews they're on. */
export function crewsInScope(team: Team, personId: string): Crew[] {
  const p = team.people.find((x) => x.id === personId)
  if (!p) return []
  switch (p.role) {
    case 'pm':
      return team.crews
    case 'gf': {
      const myAreas = new Set(team.areas.filter((a) => a.gfId === p.id).map((a) => a.id))
      return team.crews.filter((c) => myAreas.has(c.areaId))
    }
    case 'foreman':
      return team.crews.filter((c) => c.foremanId === p.id)
    case 'crew':
      return team.crews.filter((c) => c.memberIds.includes(p.id))
  }
}

const inScope = (team: Team, personId: string, crewId: string) => crewsInScope(team, personId).some((c) => c.id === crewId)

/** Visibility levels this person can SEE (and, if not crew, create). */
export function allowedVisibilities(role: Role): Visibility[] {
  return (Object.keys(MIN_RANK) as Visibility[]).filter((v) => RANK[role] >= MIN_RANK[v])
}

export function canSeeTask(team: Team, personId: string, task: Task): boolean {
  const p = team.people.find((x) => x.id === personId)
  if (!p) return false
  return inScope(team, personId, task.crewId) && RANK[p.role] >= MIN_RANK[task.visibility]
}

/** Crew members can't create tasks; others can, for crews they're over, at levels they can see. */
export function canCreateTask(team: Team, personId: string, crewId: string, visibility: Visibility): boolean {
  const p = team.people.find((x) => x.id === personId)
  if (!p || p.role === 'crew') return false
  return inScope(team, personId, crewId) && RANK[p.role] >= MIN_RANK[visibility]
}

/** Edit/delete: anyone above crew level who can see the task. */
export function canManageTask(team: Team, personId: string, task: Task): boolean {
  const p = team.people.find((x) => x.id === personId)
  return !!p && p.role !== 'crew' && canSeeTask(team, personId, task)
}

/** Anyone who can see a task can check it off and comment on it. */
export const canWorkOnTask = canSeeTask

export function visibleTasks(team: Team, personId: string): Task[] {
  return team.tasks.filter((t) => canSeeTask(team, personId, t))
}

/** Notes are never shown to crew members. */
export function canSeeNote(team: Team, personId: string, note: Note): boolean {
  const p = team.people.find((x) => x.id === personId)
  if (!p) return false
  switch (p.role) {
    case 'pm':
      return true
    case 'gf':
      return note.fromId === p.id || team.areas.some((a) => a.id === note.areaId && a.gfId === p.id)
    case 'foreman':
      return team.crews.some(
        (c) => c.foremanId === p.id && c.areaId === note.areaId && (note.crewId === undefined || note.crewId === c.id),
      )
    case 'crew':
      return false
  }
}

export function visibleNotes(team: Team, personId: string): Note[] {
  return team.notes.filter((n) => canSeeNote(team, personId, n))
}

/** PM can write notes anywhere; a GF only in their own areas. */
export function canWriteNote(team: Team, personId: string, areaId: string): boolean {
  const p = team.people.find((x) => x.id === personId)
  if (!p) return false
  if (p.role === 'pm') return true
  return p.role === 'gf' && team.areas.some((a) => a.id === areaId && a.gfId === p.id)
}

/** PM manages areas; PM or the area's GF manages the crews in it. */
export const canManageAreas = (team: Team, personId: string) => team.people.find((p) => p.id === personId)?.role === 'pm'

export function canManageCrewsIn(team: Team, personId: string, areaId: string): boolean {
  return canWriteNote(team, personId, areaId)
}

function ensure(allowed: boolean, message = "You don't have permission to do that.") {
  if (!allowed) throw new PermissionError(message)
}

// ---------------------------------------------------------------------------
// Changes (each returns a NEW team; the old one is untouched)
// ---------------------------------------------------------------------------

export function addPerson(team: Team, name: string, role: Role): Team {
  if (!name.trim()) throw new Error('Enter a name')
  return { ...team, people: [...team.people, { id: newId(), name: name.trim(), role }] }
}

/** Adding people from the app: a PM can add anyone; a GF can add foremen and crew. */
export function addPersonAs(team: Team, actorId: string, name: string, role: Role): Team {
  const actor = team.people.find((p) => p.id === actorId)
  const allowed = actor?.role === 'pm' || (actor?.role === 'gf' && (role === 'foreman' || role === 'crew'))
  ensure(allowed, 'Only a PM (or a GF, for foremen and crew) can add people.')
  return addPerson(team, name, role)
}

export function addArea(team: Team, actorId: string, name: string, gfId?: string): Team {
  ensure(canManageAreas(team, actorId), 'Only a PM can add areas.')
  if (!name.trim()) throw new Error('Enter an area name')
  if (gfId && person(team, gfId).role !== 'gf') throw new Error('That person is not a General Foreman')
  return { ...team, areas: [...team.areas, { id: newId(), name: name.trim(), gfId }] }
}

export function setAreaGf(team: Team, actorId: string, areaId: string, gfId: string): Team {
  ensure(canManageAreas(team, actorId), 'Only a PM can assign General Foremen.')
  if (person(team, gfId).role !== 'gf') throw new Error('That person is not a General Foreman')
  return { ...team, areas: team.areas.map((a) => (a.id === areaId ? { ...a, gfId } : a)) }
}

export function addCrew(team: Team, actorId: string, input: { name: string; areaId: string; foremanId: string }): Team {
  ensure(canManageCrewsIn(team, actorId, input.areaId), 'Only the PM or this area\'s GF can add crews.')
  if (person(team, input.foremanId).role !== 'foreman') throw new Error('Pick a foreman to run the crew')
  const name = input.name.trim() || `${person(team, input.foremanId).name}'s crew`
  return { ...team, crews: [...team.crews, { id: newId(), name, areaId: input.areaId, foremanId: input.foremanId, memberIds: [] }] }
}

export function addMember(team: Team, actorId: string, crewId: string, personId: string): Team {
  const crew = crewById(team, crewId)
  ensure(canManageCrewsIn(team, actorId, crew.areaId), 'Only the PM or this area\'s GF can change crews.')
  if (person(team, personId).role !== 'crew') throw new Error('Only crew members can be added to a crew')
  if (crew.memberIds.includes(personId)) return team
  return { ...team, crews: team.crews.map((c) => (c.id === crewId ? { ...c, memberIds: [...c.memberIds, personId] } : c)) }
}

export function removeMember(team: Team, actorId: string, crewId: string, personId: string): Team {
  const crew = crewById(team, crewId)
  ensure(canManageCrewsIn(team, actorId, crew.areaId), 'Only the PM or this area\'s GF can change crews.')
  return { ...team, crews: team.crews.map((c) => (c.id === crewId ? { ...c, memberIds: c.memberIds.filter((m) => m !== personId) } : c)) }
}

export function addTask(
  team: Team,
  actorId: string,
  input: { crewId: string; title: string; details: string; priority: Task['priority']; visibility: Visibility },
  now = new Date(),
): Team {
  ensure(canCreateTask(team, actorId, input.crewId, input.visibility), "You can't add that task to this crew.")
  if (!input.title.trim()) throw new Error('Give the task a title')
  const task: Task = {
    id: newId(),
    crewId: input.crewId,
    title: input.title.trim(),
    details: input.details.trim(),
    priority: input.priority,
    visibility: input.visibility,
    done: false,
    createdById: actorId,
    createdAt: now.toISOString(),
    comments: [],
  }
  return { ...team, tasks: [task, ...team.tasks] }
}

function updateTask(team: Team, taskId: string, check: (t: Task) => boolean, change: (t: Task) => Task): Team {
  const task = team.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('Task not found')
  ensure(check(task))
  return { ...team, tasks: team.tasks.map((t) => (t.id === taskId ? change(t) : t)) }
}

export function toggleTask(team: Team, actorId: string, taskId: string): Team {
  return updateTask(
    team,
    taskId,
    (t) => canWorkOnTask(team, actorId, t),
    (t) => ({ ...t, done: !t.done, doneById: t.done ? undefined : actorId }),
  )
}

export function addComment(team: Team, actorId: string, taskId: string, text: string, now = new Date()): Team {
  if (!text.trim()) throw new Error('Type a comment')
  return updateTask(
    team,
    taskId,
    (t) => canWorkOnTask(team, actorId, t),
    (t) => ({ ...t, comments: [...t.comments, { id: newId(), byId: actorId, text: text.trim(), at: now.toISOString() }] }),
  )
}

export function deleteTask(team: Team, actorId: string, taskId: string): Team {
  const task = team.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error('Task not found')
  ensure(canManageTask(team, actorId, task))
  return { ...team, tasks: team.tasks.filter((t) => t.id !== taskId) }
}

export function addNote(team: Team, actorId: string, input: { areaId: string; crewId?: string; text: string }, now = new Date()): Team {
  ensure(canWriteNote(team, actorId, input.areaId), 'Only the PM or this area\'s GF can post notes here.')
  if (!input.text.trim()) throw new Error('Type a note')
  if (input.crewId && crewById(team, input.crewId).areaId !== input.areaId) throw new Error('That crew is not in this area')
  const note: Note = { id: newId(), fromId: actorId, areaId: input.areaId, crewId: input.crewId, text: input.text.trim(), at: now.toISOString() }
  return { ...team, notes: [note, ...team.notes] }
}

// ---------------------------------------------------------------------------
// Example team (for demos)
// ---------------------------------------------------------------------------

/** A ready-made team so you can try every role right away. */
export function exampleTeam(jobId: string): Team {
  let t = emptyTeam(jobId)
  const add = (name: string, role: Role) => {
    t = addPerson(t, name, role)
    return t.people[t.people.length - 1].id
  }
  const jeremy = add('Jeremy', 'pm')
  add('Sarah', 'pm')
  const mike = add('Mike', 'gf')
  const dave = add('Dave', 'foreman')
  const luis = add('Luis', 'foreman')
  const zach = add('Zach', 'crew')
  const tyler = add('Tyler', 'crew')
  const ana = add('Ana', 'crew')

  t = addArea(t, jeremy, 'Floor 3', mike)
  const floor3 = t.areas[0].id
  t = addCrew(t, mike, { name: 'Dave\'s crew (east wing)', areaId: floor3, foremanId: dave })
  t = addCrew(t, mike, { name: 'Luis\'s crew (west wing)', areaId: floor3, foremanId: luis })
  const [daveCrew, luisCrew] = t.crews.map((c) => c.id)
  t = addMember(t, mike, daveCrew, zach)
  t = addMember(t, mike, daveCrew, tyler)
  t = addMember(t, mike, luisCrew, ana)

  t = addTask(t, dave, { crewId: daveCrew, title: 'Pipe rooms 301–305 to panel B', details: '3/4" EMT, stub up at each desk location', priority: 'normal', visibility: 'crew' })
  t = addTask(t, dave, { crewId: daveCrew, title: 'Pull wire to 301–305', details: '#12 THHN, 3 wires + ground', priority: 'normal', visibility: 'crew' })
  t = addTask(t, mike, { crewId: daveCrew, title: 'East wing is 2 days behind. Get it back on schedule', details: 'Can lend Tyler from Luis\'s crew if needed', priority: 'high', visibility: 'foreman' })
  t = addTask(t, jeremy, { crewId: daveCrew, title: 'Change order #14 pending: hold off on room 305 lighting', details: 'Owner may move fixtures. Don\'t tell the crew to stop yet', priority: 'high', visibility: 'leadership' })
  t = addNote(t, mike, { areaId: floor3, text: 'Inspector walking Floor 3 Thursday 9am. Covers off, labels on.' })
  t = addNote(t, mike, { areaId: floor3, crewId: daveCrew, text: 'Dave: watch the overtime on your crew this week.' })
  return t
}

// ---------------------------------------------------------------------------
// Saving to the device
// ---------------------------------------------------------------------------

export type TeamState = Record<string, Team>

const STORAGE_KEY = 'electrical-toolkit:teams:v1'

export function loadTeams(storage: Pick<Storage, 'getItem'> | undefined): TeamState {
  try {
    const text = storage?.getItem(STORAGE_KEY)
    return text ? (JSON.parse(text) as TeamState) : {}
  } catch {
    return {}
  }
}

export function persistTeams(storage: Pick<Storage, 'setItem'> | undefined, state: TeamState): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
