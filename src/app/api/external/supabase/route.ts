import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** GET /api/external/supabase — fetch PM pipeline data from Supabase */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'SUPABASE_URL or SUPABASE_KEY not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') || 'prospects'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')

  // Allowlist of tables we'll proxy
  const allowedTables = ['prospects', 'outreach_messages', 'pipeline_stages', 'qualification_scores']
  if (!allowedTables.includes(table)) {
    return NextResponse.json({ error: `Table "${table}" not allowed` }, { status: 403 })
  }

  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?limit=${limit}&offset=${offset}&order=created_at.desc`,
    {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'count=exact',
      },
    }
  )

  const data = await res.json()
  const totalCount = res.headers.get('content-range')?.split('/')[1] || null

  return NextResponse.json({
    table,
    data,
    count: totalCount ? parseInt(totalCount) : data.length,
    limit,
    offset,
  })
}

/** POST /api/external/supabase — fetch pipeline funnel stats */
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'SUPABASE_URL or SUPABASE_KEY not configured' }, { status: 503 })
  }

  const { action } = await request.json()

  if (action === 'funnel') {
    // Fetch counts per pipeline stage
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    }

    const stages = ['discovered', 'qualified', 'contacted', 'responded', 'meeting', 'closed']
    const counts: Record<string, number> = {}

    await Promise.all(
      stages.map(async (stage) => {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/prospects?stage=eq.${stage}&select=id`,
          { headers: { ...headers, 'Prefer': 'count=exact' } }
        )
        const range = res.headers.get('content-range')
        counts[stage] = range ? parseInt(range.split('/')[1] || '0') : 0
      })
    )

    return NextResponse.json({ funnel: counts })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
