'use client'

import { useState, useEffect, useCallback } from 'react'

interface Position {
  ticker: string
  market_title: string
  side: string
  quantity: number
  average_price: number
  current_price: number
  pnl: number
}

interface Balance {
  balance: number
  available_balance: number
}

interface Fill {
  trade_id: string
  ticker: string
  side: string
  count: number
  price: number
  created_time: string
}

export function TradingPanel() {
  const [positions, setPositions] = useState<Position[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [recentFills, setRecentFills] = useState<Fill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'positions' | 'fills'>('positions')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [posRes, balRes, fillsRes] = await Promise.all([
        fetch('/api/external/kalshi?action=positions'),
        fetch('/api/external/kalshi?action=balance'),
        fetch('/api/external/kalshi?action=fills&limit=20'),
      ])

      if (!posRes.ok) {
        const errData = await posRes.json()
        setError(errData.error || 'Failed to fetch trading data')
        return
      }

      const posData = await posRes.json()
      const balData = await balRes.json()
      const fillsData = await fillsRes.json()

      setPositions(posData.market_positions || posData.positions || [])
      setBalance(balData)
      setRecentFills(fillsData.fills || [])
    } catch {
      setError('Network error fetching trading data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold text-foreground mb-4">Trading Dashboard</h2>
        <div className="bg-card border border-amber-500/20 rounded-lg p-6 text-center">
          <p className="text-sm text-amber-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure <code className="font-mono bg-secondary px-1 rounded">KALSHI_API_KEY</code> to enable this panel.
          </p>
        </div>
      </div>
    )
  }

  const totalPnl = positions.reduce((sum, p) => sum + (p.pnl || 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Trading Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Kalshi positions & activity</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="h-8 px-3 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-smooth disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Balance + PnL Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xs text-muted-foreground font-medium">Balance</div>
          <div className="text-xl font-bold text-foreground mt-0.5">
            ${balance ? (balance.balance / 100).toFixed(2) : '-'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xs text-muted-foreground font-medium">Available</div>
          <div className="text-xl font-bold text-foreground mt-0.5">
            ${balance ? (balance.available_balance / 100).toFixed(2) : '-'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xs text-muted-foreground font-medium">Open P&L</div>
          <div className={`text-xl font-bold mt-0.5 ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{(totalPnl / 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-secondary rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setTab('positions')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-smooth ${
            tab === 'positions' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Positions ({positions.length})
        </button>
        <button
          onClick={() => setTab('fills')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-smooth ${
            tab === 'fills' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Recent Fills ({recentFills.length})
        </button>
      </div>

      {/* Content */}
      {tab === 'positions' && (
        <div className="space-y-2">
          {positions.length === 0 ? (
            <div className="text-center py-8 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">No open positions</p>
            </div>
          ) : (
            positions.map((p, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{p.market_title || p.ticker}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-2xs px-1.5 py-0.5 rounded border font-medium ${
                      p.side === 'yes'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {p.side?.toUpperCase()}
                    </span>
                    <span className="text-2xs text-muted-foreground font-mono">
                      {p.quantity} @ {p.average_price}c
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${(p.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(p.pnl || 0) >= 0 ? '+' : ''}{((p.pnl || 0) / 100).toFixed(2)}
                  </div>
                  {p.current_price != null && (
                    <div className="text-2xs text-muted-foreground">Now: {p.current_price}c</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'fills' && (
        <div className="space-y-1.5">
          {recentFills.length === 0 ? (
            <div className="text-center py-8 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">No recent fills</p>
            </div>
          ) : (
            recentFills.map((fill, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-foreground font-mono">{fill.ticker}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-2xs font-medium ${fill.side === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                      {fill.side?.toUpperCase()}
                    </span>
                    <span className="text-2xs text-muted-foreground">
                      {fill.count} @ {fill.price}c
                    </span>
                  </div>
                </div>
                <span className="text-2xs text-muted-foreground">
                  {new Date(fill.created_time).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
