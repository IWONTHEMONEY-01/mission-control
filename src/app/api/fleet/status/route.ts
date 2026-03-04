import { NextResponse } from 'next/server'
import { getFleetConfig } from '@/lib/fleet-config'

export const dynamic = 'force-dynamic'

interface BotStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'timeout'
  latency: number | null
  sessions: number
  activeSessions: number
  cronJobs: number
  uptime: string | null
  version: string | null
  error: string | null
}

async function probeGateway(bot: { id: string; name: string; httpUrl: string; token: string }): Promise<BotStatus> {
  const start = Date.now()
  const result: BotStatus = {
    id: bot.id,
    name: bot.name,
    status: 'offline',
    latency: null,
    sessions: 0,
    activeSessions: 0,
    cronJobs: 0,
    uptime: null,
    version: null,
    error: null,
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    // OpenClaw gateway exposes /health or /api/status endpoints
    const headers: Record<string, string> = {}
    if (bot.token) headers['Authorization'] = `Bearer ${bot.token}`

    const res = await fetch(`${bot.httpUrl}/health`, {
      signal: controller.signal,
      headers,
    })
    clearTimeout(timeout)

    result.latency = Date.now() - start

    if (res.ok) {
      result.status = 'online'
      try {
        const data = await res.json()
        result.sessions = data.sessions ?? data.sessionCount ?? 0
        result.activeSessions = data.activeSessions ?? 0
        result.cronJobs = data.cronJobs ?? data.cronCount ?? 0
        result.uptime = data.uptime ?? null
        result.version = data.version ?? null
      } catch {
        // Health endpoint may return non-JSON (plain "ok")
      }
    } else {
      result.status = 'offline'
      result.error = `HTTP ${res.status}`
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      result.status = 'timeout'
      result.error = 'Connection timed out (5s)'
    } else {
      result.status = 'offline'
      result.error = err.message || 'Connection failed'
    }
  }

  return result
}

/** GET /api/fleet/status — probe all configured gateways */
export async function GET() {
  const fleet = getFleetConfig()

  if (fleet.length === 0) {
    return NextResponse.json({
      bots: [],
      message: 'No bots configured. Set GATEWAY_<ID>_URL env vars.',
    })
  }

  const bots = await Promise.all(fleet.map(probeGateway))

  const summary = {
    total: bots.length,
    online: bots.filter(b => b.status === 'online').length,
    offline: bots.filter(b => b.status !== 'online').length,
  }

  return NextResponse.json({ bots, summary, timestamp: Date.now() })
}
