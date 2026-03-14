import { NextRequest, NextResponse } from 'next/server'
import { getFleetConfig } from '@/lib/fleet-config'

export const dynamic = 'force-dynamic'

const KALSHI_API_URL = 'https://api.elections.kalshi.com/trade-api/v2'

/**
 * Get the General bot's HTTP base URL from fleet config.
 * The bot API serves enriched data (FV@Trade, per-leg fair odds, adaptive EG).
 */
function getBotApiUrl(): string | null {
  const bots = getFleetConfig()
  const general = bots.find(b => b.id === 'general')
  return general?.httpUrl || null
}

/** GET /api/external/kalshi — fetch trading data */
export async function GET(request: NextRequest) {
  const apiKey = process.env.KALSHI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'KALSHI_API_KEY not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'positions'

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    switch (action) {
      case 'positions': {
        // Try bot's enriched API first (has FV@Trade, per-leg fair odds, live FV)
        const botUrl = getBotApiUrl()
        if (botUrl) {
          try {
            const botToken = getFleetConfig().find(b => b.id === 'general')?.token || ''
            const res = await fetch(`${botUrl}/api/portfolio/positions`, {
              headers: { 'Authorization': `Bearer ${botToken}` },
              signal: AbortSignal.timeout(5000),
            })
            if (res.ok) {
              const data = await res.json()
              return NextResponse.json({ ...data, source: 'bot' })
            }
          } catch {
            // Fall through to Kalshi direct
          }
        }
        // Fallback: Kalshi direct (no enrichment)
        const res = await fetch(`${KALSHI_API_URL}/portfolio/positions`, { headers })
        const data = await res.json()
        return NextResponse.json({ ...data, source: 'kalshi' })
      }
      case 'balance': {
        const res = await fetch(`${KALSHI_API_URL}/portfolio/balance`, { headers })
        const data = await res.json()
        return NextResponse.json(data)
      }
      case 'fills': {
        const limit = searchParams.get('limit') || '50'
        const res = await fetch(`${KALSHI_API_URL}/portfolio/fills?limit=${limit}`, { headers })
        const data = await res.json()
        return NextResponse.json(data)
      }
      case 'exposure': {
        // Bot's exposure/adaptive EG data
        const botUrl = getBotApiUrl()
        if (!botUrl) {
          return NextResponse.json({ error: 'Bot API not configured' }, { status: 503 })
        }
        const botToken = getFleetConfig().find(b => b.id === 'general')?.token || ''
        const res = await fetch(`${botUrl}/api/exposure`, {
          headers: { 'Authorization': `Bearer ${botToken}` },
          signal: AbortSignal.timeout(5000),
        })
        const data = await res.json()
        return NextResponse.json(data)
      }
      case 'markets': {
        const ticker = searchParams.get('ticker')
        if (ticker) {
          const res = await fetch(`${KALSHI_API_URL}/markets/${ticker}`, { headers })
          const data = await res.json()
          return NextResponse.json(data)
        }
        const status = searchParams.get('status') || 'open'
        const limit = searchParams.get('limit') || '20'
        const res = await fetch(`${KALSHI_API_URL}/markets?status=${status}&limit=${limit}`, { headers })
        const data = await res.json()
        return NextResponse.json(data)
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Kalshi API request failed' }, { status: 502 })
  }
}
