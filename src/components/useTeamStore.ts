import { useEffect, useState } from 'react'
import { loadTeams, persistTeams, type TeamState } from '../lib/crew'

function phoneStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/** Same idea as useJobStore: load teams once, save on every change. */
export function useTeamStore() {
  const [teams, setTeams] = useState<TeamState>(() => loadTeams(phoneStorage()))
  useEffect(() => {
    persistTeams(phoneStorage(), teams)
  }, [teams])
  return { teams, setTeams }
}

export type TeamStore = ReturnType<typeof useTeamStore>
