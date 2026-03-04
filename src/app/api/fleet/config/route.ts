import { NextResponse } from 'next/server'
import { getFleetConfigPublic } from '@/lib/fleet-config'

/** GET /api/fleet/config — returns fleet bot list (no secrets) */
export async function GET() {
  const bots = getFleetConfigPublic()
  return NextResponse.json({ bots })
}
