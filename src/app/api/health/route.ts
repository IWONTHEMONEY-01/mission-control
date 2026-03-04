import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** GET /api/health — lightweight health check for Railway/Docker */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: Date.now() })
}
