'use client'

import { useState, useEffect, useCallback } from 'react'

interface MondayBoard {
  id: string
  name: string
  state: string
  board_kind: string
  items_count: number
  updated_at: string
  groups: MondayGroup[]
}

interface MondayGroup {
  id: string
  title: string
  items_page: {
    items: MondayItem[]
  }
}

interface MondayItem {
  id: string
  name: string
  state: string
  updated_at: string
  column_values: { id: string; text: string }[]
}

export function MondayPanel() {
  const [boards, setBoards] = useState<MondayBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null)

  const fetchBoards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/external/monday')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to fetch Monday.com data')
        return
      }
      setBoards(data.data?.boards || [])
    } catch {
      setError('Network error fetching Monday.com data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchBoards() }, [fetchBoards])

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold text-foreground mb-4">Monday.com</h2>
        <div className="bg-card border border-amber-500/20 rounded-lg p-6 text-center">
          <p className="text-sm text-amber-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure <code className="font-mono bg-secondary px-1 rounded">MONDAY_API_KEY</code> to enable this panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Monday.com</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {boards.length} board{boards.length !== 1 ? 's' : ''} synced
          </p>
        </div>
        <button
          onClick={fetchBoards}
          disabled={loading}
          className="h-8 px-3 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-smooth disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Board Cards */}
      {loading && boards.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">Loading boards...</div>
      ) : boards.length === 0 ? (
        <div className="text-center py-8 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">No boards found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              expanded={expandedBoard === board.id}
              onToggle={() => setExpandedBoard(expandedBoard === board.id ? null : board.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BoardCard({ board, expanded, onToggle }: {
  board: MondayBoard
  expanded: boolean
  onToggle: () => void
}) {
  const kindColors: Record<string, string> = {
    public: 'bg-green-500/20 text-green-400 border-green-500/30',
    private: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    share: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-smooth"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="1" width="12" height="14" rx="1.5" />
              <path d="M5 5h6M5 8h6M5 11h3" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{board.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-2xs px-1.5 py-0.5 rounded border font-medium ${kindColors[board.board_kind] || 'bg-secondary text-muted-foreground border-border'}`}>
                {board.board_kind}
              </span>
              <span className="text-2xs text-muted-foreground">{board.items_count} items</span>
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="4,6 8,10 12,6" />
        </svg>
      </button>

      {expanded && board.groups && (
        <div className="border-t border-border">
          {board.groups.map((group) => (
            <div key={group.id} className="border-b border-border last:border-0">
              <div className="px-4 py-2 bg-secondary/30">
                <span className="text-xs font-semibold text-foreground">{group.title}</span>
                <span className="text-2xs text-muted-foreground ml-2">
                  ({group.items_page?.items?.length || 0} items)
                </span>
              </div>
              {group.items_page?.items?.map((item) => (
                <div key={item.id} className="px-4 py-2 flex items-center justify-between border-t border-border/50">
                  <span className="text-xs text-foreground">{item.name}</span>
                  <span className="text-2xs text-muted-foreground">
                    {new Date(item.updated_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
