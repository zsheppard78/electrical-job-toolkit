import { useState } from 'react'
import {
  addArea,
  addComment,
  addCrew,
  addMember,
  addNote,
  addPerson,
  addPersonAs,
  addTask,
  allowedVisibilities,
  canCreateTask,
  canManageAreas,
  canManageCrewsIn,
  canManageTask,
  canWorkOnTask,
  canWriteNote,
  crewsInScope,
  deleteTask,
  emptyTeam,
  exampleTeam,
  personName,
  removeMember,
  ROLE_LABEL,
  setAreaGf,
  toggleTask,
  VISIBILITY_LABEL,
  visibleNotes,
  visibleTasks,
  type Role,
  type Task,
  type Team,
  type Visibility,
} from '../lib/crew'
import type { TeamStore } from './useTeamStore'
import { ChoiceButtons, DeleteButton, inputClass, Warning } from './ui'

interface Props {
  jobId: string
  jobName: string
  teamStore: TeamStore
  onBack: () => void
}

const card = 'rounded-xl bg-slate-800 p-4'
const btn = 'rounded-lg py-3 px-4 font-semibold'
const field = `${inputClass} text-lg`
const ROLES: Role[] = ['pm', 'gf', 'foreman', 'crew']

const VIS_STYLE: Record<Visibility, string> = {
  crew: 'bg-slate-700 text-slate-200',
  foreman: 'bg-sky-900 text-sky-200',
  leadership: 'bg-purple-900 text-purple-200',
}

export default function TeamScreen({ jobId, jobName, teamStore, onBack }: Props) {
  const team = teamStore.teams[jobId] ?? emptyTeam(jobId)
  const [viewerId, setViewerId] = useState<string>('')
  const [tab, setTab] = useState<'tasks' | 'notes' | 'team'>('tasks')
  const [error, setError] = useState<string | null>(null)

  /** Run a change; permission problems show as a message instead of crashing. */
  function change(fn: (t: Team) => Team): boolean {
    try {
      const next = fn(team) // throws on a permission problem, before anything is saved
      teamStore.setTeams((all) => ({ ...all, [jobId]: next }))
      setError(null)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }

  // Default "viewing as" to the first person (the PM in the example team).
  const viewer = team.people.find((p) => p.id === viewerId) ?? team.people[0]
  // Crew members have no Notes tab; fall back to Tasks if they land there.
  const activeTab = tab === 'notes' && viewer?.role === 'crew' ? 'tasks' : tab

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-amber-400">
        ← {jobName}
      </button>
      <h2 className="text-2xl font-black text-white">Team & Tasks</h2>

      {team.people.length === 0 ? (
        <Setup jobId={jobId} change={change} />
      ) : (
        <>
          <div className="rounded-xl border border-dashed border-amber-400 p-3">
            <label className="block">
              <span className="text-sm text-amber-400">Demo: viewing as</span>
              <select className={field} value={viewer.id} onChange={(e) => setViewerId(e.target.value)}>
                {ROLES.map((role) => (
                  <optgroup key={role} label={ROLE_LABEL[role]}>
                    {team.people
                      .filter((p) => p.role === role)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({ROLE_LABEL[p.role]})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <p className="mt-1 text-xs text-slate-400">In the real app, everyone signs in and the server only sends what they're allowed to see.</p>
          </div>

          <nav className="flex gap-2 rounded-xl bg-slate-800 p-1">
            {(['tasks', viewer.role !== 'crew' ? 'notes' : null, 'team'] as const)
              .filter((t): t is 'tasks' | 'notes' | 'team' => t !== null)
              .map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-3 font-semibold capitalize ${activeTab === t ? 'bg-amber-400 text-slate-900' : 'text-slate-300'}`}>
                  {t}
                </button>
              ))}
          </nav>

          {error && <Warning>{error}</Warning>}

          {activeTab === 'tasks' && <TasksTab team={team} viewerId={viewer.id} change={change} />}
          {activeTab === 'notes' && <NotesTab team={team} viewerId={viewer.id} change={change} />}
          {activeTab === 'team' && <TeamTab team={team} viewerId={viewer.id} change={change} />}
        </>
      )}
    </section>
  )
}

type Change = (fn: (t: Team) => Team) => boolean

// ---------------------------------------------------------------------------

function Setup({ jobId, change }: { jobId: string; change: Change }) {
  const [name, setName] = useState('')
  return (
    <div className={`${card} space-y-3`}>
      <p className="text-lg font-semibold text-white">Set up the team</p>
      <button onClick={() => change(() => exampleTeam(jobId))} className={`${btn} w-full bg-amber-400 text-slate-900`}>
        Load example team
      </button>
      <p className="text-sm text-slate-400">Jeremy & Sarah (PMs), Mike (GF, Floor 3), Dave & Luis (foremen), Zach, Tyler & Ana (crew), with sample tasks and notes.</p>
      <p className="pt-2 text-sm text-slate-400">Or start with yourself as the PM:</p>
      <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => change((t) => addPerson(t, name, 'pm'))} className={`${btn} w-full bg-slate-700 text-white`}>
        Start team
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------

function TasksTab({ team, viewerId, change }: { team: Team; viewerId: string; change: Change }) {
  const viewer = team.people.find((p) => p.id === viewerId)!
  const crews = crewsInScope(team, viewerId)
  const tasks = visibleTasks(team, viewerId)
  const canCreateAny = crews.some((c) => canCreateTask(team, viewerId, c.id, 'crew'))

  return (
    <div className="space-y-5">
      {canCreateAny && <NewTask team={team} viewerId={viewerId} change={change} />}

      {crews.length === 0 && <p className="text-slate-400">{viewer.name} isn't on a crew yet. A PM or GF can add them on the Team tab.</p>}

      {crews.map((crew) => {
        const crewTasks = tasks.filter((t) => t.crewId === crew.id).sort((a, b) => Number(a.done) - Number(b.done))
        return (
          <div key={crew.id} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400">{crew.name}</h3>
            {crewTasks.length === 0 && <p className="text-slate-400">No tasks.</p>}
            {crewTasks.map((task) => (
              <TaskCard key={task.id} team={team} task={task} viewerId={viewerId} change={change} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function NewTask({ team, viewerId, change }: { team: Team; viewerId: string; change: Change }) {
  const viewer = team.people.find((p) => p.id === viewerId)!
  const crews = crewsInScope(team, viewerId).filter((c) => canCreateTask(team, viewerId, c.id, 'crew'))
  const [open, setOpen] = useState(false)
  const [crewId, setCrewId] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('normal')
  const [visibility, setVisibility] = useState<Visibility>('crew')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${btn} w-full bg-amber-400 text-slate-900`}>
        + New task
      </button>
    )
  }

  const selectedCrew = crews.some((c) => c.id === crewId) ? crewId : crews[0]?.id
  const visOptions = allowedVisibilities(viewer.role).map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))

  function save() {
    const ok = change((t) => addTask(t, viewerId, { crewId: selectedCrew, title, details, priority, visibility }))
    if (ok) {
      setTitle('')
      setDetails('')
      setOpen(false)
    }
  }

  return (
    <div className={`${card} space-y-3 border border-amber-400`}>
      <p className="text-lg font-semibold text-white">New task</p>
      <select className={field} value={selectedCrew} onChange={(e) => setCrewId(e.target.value)}>
        {crews.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input className={field} placeholder="What needs to get done?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${field} min-h-20`} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <div>
        <p className="mb-1 text-sm text-slate-400">Who can see it?</p>
        <ChoiceButtons options={visOptions} value={visibility} onChange={setVisibility} />
      </div>
      <div>
        <p className="mb-1 text-sm text-slate-400">Priority</p>
        <ChoiceButtons
          options={[
            { value: 'normal' as const, label: 'Normal' },
            { value: 'high' as const, label: 'High' },
          ]}
          value={priority}
          onChange={setPriority}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setOpen(false)} className={`${btn} bg-slate-700 text-white`}>
          Cancel
        </button>
        <button onClick={save} className={`${btn} bg-amber-400 text-slate-900`}>
          Add task
        </button>
      </div>
    </div>
  )
}

function TaskCard({ team, task, viewerId, change }: { team: Team; task: Task; viewerId: string; change: Change }) {
  const [comment, setComment] = useState('')
  const canWork = canWorkOnTask(team, viewerId, task)

  return (
    <div className={`${card} space-y-2 ${task.done ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => change((t) => toggleTask(t, viewerId, task.id))}
          disabled={!canWork}
          aria-label={task.done ? 'Mark not done' : 'Mark done'}
          className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 text-xl ${task.done ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-slate-500'}`}
        >
          {task.done ? '✓' : ''}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-lg font-bold text-white ${task.done ? 'line-through' : ''}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <span className={`rounded px-2 py-0.5 ${VIS_STYLE[task.visibility]}`}>{VISIBILITY_LABEL[task.visibility]}</span>
            {task.priority === 'high' && <span className="rounded bg-rose-900 px-2 py-0.5 text-rose-200">High priority</span>}
          </div>
          {task.details && <p className="mt-1 text-slate-300">{task.details}</p>}
          <p className="mt-1 text-xs text-slate-500">
            From {personName(team, task.createdById)}
            {task.done && ` · Done by ${personName(team, task.doneById)}`}
          </p>
        </div>
      </div>

      {task.comments.length > 0 && (
        <ul className="space-y-1 border-l-2 border-slate-600 pl-3">
          {task.comments.map((c) => (
            <li key={c.id} className="text-sm text-slate-200">
              <span className="font-semibold">{personName(team, c.byId)}:</span> {c.text}
            </li>
          ))}
        </ul>
      )}

      {canWork && (
        <div className="flex gap-2">
          <input className={`${inputClass} py-2 text-base`} placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <button
            onClick={() => change((t) => addComment(t, viewerId, task.id, comment)) && setComment('')}
            className={`${btn} bg-slate-700 text-white`}
          >
            Post
          </button>
        </div>
      )}

      {canManageTask(team, viewerId, task) && <DeleteButton onDelete={() => change((t) => deleteTask(t, viewerId, task.id))} label="Delete task" />}
    </div>
  )
}

// ---------------------------------------------------------------------------

function NotesTab({ team, viewerId, change }: { team: Team; viewerId: string; change: Change }) {
  const writableAreas = team.areas.filter((a) => canWriteNote(team, viewerId, a.id))
  const notes = visibleNotes(team, viewerId)
  const [areaId, setAreaId] = useState('')
  const [crewId, setCrewId] = useState('')
  const [text, setText] = useState('')

  const area = writableAreas.find((a) => a.id === areaId) ?? writableAreas[0]
  const areaCrews = team.crews.filter((c) => c.areaId === area?.id)

  return (
    <div className="space-y-4">
      {area && (
        <div className={`${card} space-y-3 border border-sky-700`}>
          <p className="text-lg font-semibold text-white">Note to foremen</p>
          <p className="text-sm text-slate-400">Only foremen and up can read notes. Crews never see them.</p>
          {writableAreas.length > 1 && (
            <select className={field} value={area.id} onChange={(e) => setAreaId(e.target.value)}>
              {writableAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <select className={field} value={crewId} onChange={(e) => setCrewId(e.target.value)}>
            <option value="">All foremen on {area.name}</option>
            {areaCrews.map((c) => (
              <option key={c.id} value={c.id}>
                Only {personName(team, c.foremanId)} ({c.name})
              </option>
            ))}
          </select>
          <textarea className={`${field} min-h-20`} placeholder="e.g. Inspector walking Thursday 9am" value={text} onChange={(e) => setText(e.target.value)} />
          <button
            onClick={() => change((t) => addNote(t, viewerId, { areaId: area.id, crewId: crewId || undefined, text })) && setText('')}
            className={`${btn} w-full bg-sky-700 text-white`}
          >
            Post note
          </button>
        </div>
      )}

      {notes.length === 0 && <p className="text-slate-400">No notes.</p>}
      {notes.map((n) => {
        const to = n.crewId ? `${personName(team, team.crews.find((c) => c.id === n.crewId)?.foremanId)} only` : `All foremen, ${team.areas.find((a) => a.id === n.areaId)?.name}`
        return (
          <div key={n.id} className={card}>
            <p className="text-white">{n.text}</p>
            <p className="mt-1 text-xs text-slate-500">
              {personName(team, n.fromId)} → {to} · {new Date(n.at).toLocaleDateString()}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function TeamTab({ team, viewerId, change }: { team: Team; viewerId: string; change: Change }) {
  const isPm = canManageAreas(team, viewerId)
  const canAddPeople = isPm || team.areas.some((a) => canManageCrewsIn(team, viewerId, a.id))
  const gfs = team.people.filter((p) => p.role === 'gf')
  const foremen = team.people.filter((p) => p.role === 'foreman')
  const crewPeople = team.people.filter((p) => p.role === 'crew')

  const [personNameText, setPersonNameText] = useState('')
  const [personRole, setPersonRole] = useState<Role>('crew')
  const [areaName, setAreaName] = useState('')

  return (
    <div className="space-y-5">
      {team.areas.map((area) => {
        const manage = canManageCrewsIn(team, viewerId, area.id)
        return (
          <div key={area.id} className={`${card} space-y-3`}>
            <div>
              <p className="text-xl font-bold text-white">{area.name}</p>
              {isPm ? (
                <select className={`${field} mt-1`} value={area.gfId ?? ''} onChange={(e) => change((t) => setAreaGf(t, viewerId, area.id, e.target.value))}>
                  <option value="" disabled>
                    Pick a General Foreman
                  </option>
                  {gfs.map((g) => (
                    <option key={g.id} value={g.id}>
                      GF: {g.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-400">GF: {area.gfId ? personName(team, area.gfId) : 'none'}</p>
              )}
            </div>

            {team.crews
              .filter((c) => c.areaId === area.id)
              .map((crew) => (
                <div key={crew.id} className="rounded-lg bg-slate-900 p-3">
                  <p className="font-semibold text-white">{crew.name}</p>
                  <p className="text-sm text-sky-300">Foreman: {personName(team, crew.foremanId)}</p>
                  <ul className="mt-1 space-y-1">
                    {crew.memberIds.map((m) => (
                      <li key={m} className="flex items-center justify-between text-slate-200">
                        {personName(team, m)}
                        {manage && (
                          <button onClick={() => change((t) => removeMember(t, viewerId, crew.id, m))} className="px-3 text-rose-300" aria-label={`Remove ${personName(team, m)}`}>
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {manage && (
                    <select
                      className={`${inputClass} mt-2 py-2 text-base`}
                      value=""
                      onChange={(e) => e.target.value && change((t) => addMember(t, viewerId, crew.id, e.target.value))}
                    >
                      <option value="">+ Add crew member…</option>
                      {crewPeople
                        .filter((p) => !crew.memberIds.includes(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              ))}

            {manage && (
              <select
                className={`${inputClass} py-2 text-base`}
                value=""
                onChange={(e) => e.target.value && change((t) => addCrew(t, viewerId, { name: '', areaId: area.id, foremanId: e.target.value }))}
              >
                <option value="">+ New crew, pick its foreman…</option>
                {foremen.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )
      })}

      {isPm && (
        <div className={`${card} space-y-2`}>
          <p className="font-semibold text-white">New area / floor</p>
          <input className={field} placeholder="e.g. Floor 4" value={areaName} onChange={(e) => setAreaName(e.target.value)} />
          <button onClick={() => change((t) => addArea(t, viewerId, areaName)) && setAreaName('')} className={`${btn} w-full bg-slate-700 text-white`}>
            Add area
          </button>
        </div>
      )}

      {canAddPeople && (
        <div className={`${card} space-y-2`}>
          <p className="font-semibold text-white">Add a person</p>
          <input className={field} placeholder="Name" value={personNameText} onChange={(e) => setPersonNameText(e.target.value)} />
          <ChoiceButtons
            options={(isPm ? ROLES : (['foreman', 'crew'] as Role[])).map((r) => ({ value: r, label: r === 'pm' ? 'PM' : r === 'gf' ? 'GF' : ROLE_LABEL[r] }))}
            value={personRole}
            onChange={setPersonRole}
          />
          <button onClick={() => change((t) => addPersonAs(t, viewerId, personNameText, personRole)) && setPersonNameText('')} className={`${btn} w-full bg-slate-700 text-white`}>
            Add person
          </button>
        </div>
      )}

      <div className={`${card} space-y-1`}>
        <p className="font-semibold text-white">Everyone</p>
        {ROLES.map((role) => {
          const people = team.people.filter((p) => p.role === role)
          return people.length ? (
            <p key={role} className="text-sm text-slate-300">
              <span className="text-slate-500">{ROLE_LABEL[role]}s:</span> {people.map((p) => p.name).join(', ')}
            </p>
          ) : null
        })}
      </div>
    </div>
  )
}
