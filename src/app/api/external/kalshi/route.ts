import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const KALSHI_API_URL = 'https://api.elections.kalshi.com/trade-api/v2'

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
        const res = await fetch(`${KALSHI_API_URL}/portfolio/positions`, { headers })
        const data = await res.json()
        return NextResponse.json(data)
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
