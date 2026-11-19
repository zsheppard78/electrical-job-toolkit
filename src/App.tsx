import { useState } from 'react'
import OffsetCalculator from './components/OffsetCalculator'
import OffsetChart from './components/OffsetChart'
import ToolScreen from './components/ToolScreen'
import JobsScreen from './components/JobsScreen'
import { useJobStore } from './components/useJobStore'
import { useTeamStore } from './components/useTeamStore'
import { TOOLS } from './lib/tools'
import type { SavedCalc } from './lib/jobs'

/** Everything that shows up on the home menu. */
const MENU = [
  { id: 'jobs', name: 'Jobs, Crews & Reports', description: 'Team tasks, GF notes, saved calcs, daily reports', category: 'Job' },
  { id: 'offset', name: 'Offset', description: 'Move over to clear something', category: 'Bending' },
  { id: 'chart', name: 'Offset Chart', description: 'Multipliers and shrink', category: 'Bending' },
  ...TOOLS.map((t) => ({ id: t.id, name: t.name, description: t.description, category: t.category })),
]
const CATEGORIES = ['Bending', 'Electrical', 'Measuring', 'Job'] as const

export default function App() {
  // null = home menu
  const [screen, setScreen] = useState<string | null>(null)
  const store = useJobStore()
  const teamStore = useTeamStore()

  // Offset state lives here so the Offset Chart can hand its angle to the calculator.
  const [depthText, setDepthText] = useState('')
  const [angle, setAngle] = useState(30)
  const [obstacleText, setObstacleText] = useState('')

  // When a saved calc is reopened, its tool restarts with the saved inputs.
  // Changing the "version" in the React key forces a fresh ToolScreen.
  const [reopened, setReopened] = useState<Record<string, { inputs: Record<string, string>; version: number }>>({})

  function openCalc(calc: SavedCalc) {
    if (calc.toolId === 'offset') {
      setDepthText(calc.inputs.depth ?? '')
      setAngle(Number(calc.inputs.angle ?? 30))
      setObstacleText(calc.inputs.obstacle ?? '')
    } else {
      setReopened((prev) => ({ ...prev, [calc.toolId]: { inputs: calc.inputs, version: (prev[calc.toolId]?.version ?? 0) + 1 } }))
    }
    setScreen(calc.toolId)
  }

  const current = MENU.find((m) => m.id === screen)

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <header className="mb-5">
        {current ? (
          <>
            <button onClick={() => setScreen(null)} className="mb-2 text-amber-400">
              ← All tools
            </button>
            <h1 className="text-3xl font-black text-white">{current.name}</h1>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-black text-amber-400">Electrical Job Toolkit</h1>
            <p className="text-slate-400">Bending, electrical calcs and job tracking, with the work shown.</p>
          </>
        )}
      </header>

      {screen === null && (
        <nav className="space-y-6">
          {CATEGORIES.map((category) => (
            <div key={category}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-400">{category}</h2>
              <div className="grid grid-cols-2 gap-3">
                {MENU.filter((m) => m.category === category).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setScreen(m.id)}
                    className="rounded-xl bg-slate-800 p-4 text-left hover:bg-slate-700 active:bg-slate-600"
                  >
                    <p className="text-lg font-bold text-white">{m.name}</p>
                    <p className="text-sm text-slate-400">{m.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}

      {screen === 'jobs' && <JobsScreen store={store} teamStore={teamStore} onOpenCalc={openCalc} />}

      {screen === 'offset' && (
        <OffsetCalculator {...{ depthText, setDepthText, angle, setAngle, obstacleText, setObstacleText, store }} />
      )}

      {screen === 'chart' && (
        <OffsetChart
          depthText={depthText}
          setDepthText={setDepthText}
          onPickAngle={(a) => {
            setAngle(a)
            setScreen('offset')
          }}
        />
      )}

      {/* Keep every tool mounted (just hidden) so your numbers survive switching screens. */}
      {TOOLS.map((tool) => {
        const r = reopened[tool.id]
        return (
          <div key={`${tool.id}-${r?.version ?? 0}`} hidden={screen !== tool.id}>
            <ToolScreen tool={r ? { ...tool, initial: { ...tool.initial, ...r.inputs } } : tool} store={store} />
          </div>
        )
      })}

      <footer className="mt-10 text-center text-xs text-slate-500">
        Learning aid only. Double-check with your bender chart, the code book and your foreman.
      </footer>
    </main>
  )
}
