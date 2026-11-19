import { useEffect, useState } from 'react'
import { loadState, persistState, type JobState } from '../lib/jobs'

/** localStorage, or undefined where it's blocked (some private-browsing modes). */
function phoneStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/**
 * A custom React hook: loads saved jobs once when the app starts, and saves
 * them to the phone every time they change.
 */
export function useJobStore() {
  const [state, setState] = useState<JobState>(() => loadState(phoneStorage()))
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    setSaveFailed(!persistState(phoneStorage(), state))
  }, [state])

  return { state, setState, saveFailed }
}

export type JobStore = ReturnType<typeof useJobStore>
