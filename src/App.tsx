import { useState } from 'react'
import OffsetCalculator from './components/OffsetCalculator'
import OffsetChart from './components/OffsetChart'
import ToolScreen from './components/ToolScreen'
import { TOOLS } from './lib/tools'

/** Everything that shows up on the home menu. */
const MENU = [
  { id: 'offset', name: 'Offset', description: 'Move over to clear something' },
  { id: 'chart', name: 'Offset Chart', description: 'Multipliers and shrink' },
  ...TOOLS.map((t) => ({ id: t.id, name: t.name, description: t.description })),
]

export default function App() {
  // null = home menu
  const [screen, setScreen] = useState<string | null>(null)

  // Offset state lives here so the Offset Chart can hand its angle to the calculator.
  const [depthText, setDepthText] = useState('')
  const [angle, setAngle] = useState(30)
  const [obstacleText, setObstacleText] = useState('')

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
            <p className="text-slate-400">Conduit bending, step by step.</p>
          </>
        )}
      </header>

      {screen === null && (
        <nav className="grid grid-cols-2 gap-3">
          {MENU.map((m) => (
            <button
              key={m.id}
              onClick={() => setScreen(m.id)}
              className="rounded-xl bg-slate-800 p-4 text-left hover:bg-slate-700 active:bg-slate-600"
            >
              <p className="text-lg font-bold text-white">{m.name}</p>
              <p className="text-sm text-slate-400">{m.description}</p>
            </button>
          ))}
        </nav>
      )}

      {screen === 'offset' && (
        <OffsetCalculator {...{ depthText, setDepthText, angle, setAngle, obstacleText, setObstacleText }} />
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
      {TOOLS.map((tool) => (
        <div key={tool.id} hidden={screen !== tool.id}>
          <ToolScreen tool={tool} />
        </div>
      ))}

      <footer className="mt-10 text-center text-xs text-slate-500">
        Learning aid only. Double-check with your bender chart and foreman.
      </footer>
    </main>
  )
}
