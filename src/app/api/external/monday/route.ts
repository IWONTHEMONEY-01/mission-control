import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MONDAY_API_URL = 'https://api.monday.com/v2'

/** POST /api/external/monday — proxy GraphQL queries to Monday.com */
export async function POST(request: NextRequest) {
  const apiKey = process.env.MONDAY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'MONDAY_API_KEY not configured' }, { status: 503 })
  }

  const body = await request.json()
  const { query, variables } = body

  if (!query) {
    return NextResponse.json({ error: 'Missing query field' }, { status: 400 })
  }

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}

/** GET /api/external/monday — fetch board summaries */
export async function GET() {
  const apiKey = process.env.MONDAY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'MONDAY_API_KEY not configured' }, { status: 503 })
  }

  const query = `{
    boards(limit: 10) {
      id
      name
      state
      board_kind
      items_count
      updated_at
      columns { id title type }
      groups {
        id
        title
        items_page(limit: 5) {
          items {
            id
            name
            state
            updated_at
            column_values { id text }
          }
        }
      }
    }
  }`

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}
