'use client'

import { create } from 'zustand'

export interface FleetBot {
  id: string
  name: string
  configured: boolean
}

export interface FleetBotStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'timeout' | 'unknown'
  latency: number | null
  sessions: number
  activeSessions: number
  cronJobs: number
  uptime: string | null
  version: string | null
  error: string | null
}

interface FleetStore {
  bots: FleetBot[]
  botStatuses: Record<string, FleetBotStatus>
  activeBot: string | null // null = all bots (fleet view)
  loading: boolean
  lastRefresh: number | null

  setBots: (bots: FleetBot[]) => void
  setBotStatuses: (statuses: FleetBotStatus[]) => void
  setActiveBot: (botId: string | null) => void
  setLoading: (loading: boolean) => void
}

export const useFleetStore = create<FleetStore>()((set) => ({
  bots: [],
  botStatuses: {},
  activeBot: null,
  loading: false,
  lastRefresh: null,

  setBots: (bots) => set({ bots }),
  setBotStatuses: (statuses) => {
    const map: Record<string, FleetBotStatus> = {}
    for (const s of statuses) map[s.id] = s
    set({ botStatuses: map, lastRefresh: Date.now() })
  },
  setActiveBot: (botId) => set({ activeBot: botId }),
  setLoading: (loading) => set({ loading }),
}))

/** Fetch fleet config (bot list) */
export async function fetchFleetConfig() {
  const { setBots } = useFleetStore.getState()
  try {
    const res = await fetch('/api/fleet/config')
    const data = await res.json()
    setBots(data.bots || [])
  } catch {
    // Silently fail — fleet may not be configured
  }
}

/** Fetch fleet status (probe all gateways) */
export async function fetchFleetStatus() {
  const { setBotStatuses, setLoading } = useFleetStore.getState()
  setLoading(true)
  try {
    const res = await fetch('/api/fleet/status')
    const data = await res.json()
    setBotStatuses(data.bots || [])
  } catch {
    // Silently fail
  } finally {
    setLoading(false)
  }
}
