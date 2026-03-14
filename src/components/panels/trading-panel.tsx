'use client'

import { useState, useEffect, useCallback } from 'react'

interface LegFairOdds {
  ticker: string
  side?: string
  fair_prob?: number
  fair_american?: number
  fair_prob_no?: number
  fair_american_no?: number
}

interface Position {
  ticker: string
  market_title: string
  side: string
  quantity: number
  average_price: number
  current_price: number
  pnl: number
  // Enriched fields from bot API
  legs?: Array<{ ticker: string; side: string }>
  trade_leg_fair_odds?: LegFairOdds[]
  trade_fair_odds?: { fair_yes_cents: number; fair_no_cents: number; entry_odds: number }
  live_fair_odds?: { fair_yes_cents: number; fair_no_cents: number }
  edge_at_trade?: number
  eg_at_trade?: number
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

interface AdaptiveEGStatus {
  min_eg: number
  tier: string
  reason: string
  utilization_pct: number
  fills_today: number
  games_remaining: number
  hours_until_last_game: number
}

function centsToAmerican(cents: number): string {
  if (cents <= 0 || cents >= 100) return '-'
  const prob = cents / 100
  if (prob >= 0.5) {
    return `${Math.round(prob / (1 - prob) * -100)}`
  }
  return `+${Math.round((1 - prob) / prob * 100)}`
}

export function TradingPanel() {
  const [positions, setPositions] = useState<Position[]>([])
  const [balance, setBalance] = useState<Balance | null>(null)
  const [recentFills, setRecentFills] = useState<Fill[]>([])
  const [adaptiveEG, setAdaptiveEG] = useState<AdaptiveEGStatus | null>(null)
  const [dataSource, setDataSource] = useState<string>('unknown')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'positions' | 'fills'>('positions')
  const [expandedPos, setExpandedPos] = useState<number | null>(null)

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
      setDataSource(posData.source || 'unknown')

      // Fetch adaptive EG status (non-blocking)
      fetch('/api/external/kalshi?action=exposure')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.adaptive_eg) setAdaptiveEG(data.adaptive_eg) })
        .catch(() => {})
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

      {/* Balance + PnL + EG Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-2xs text-muted-foreground font-medium">Adaptive EG</div>
          {adaptiveEG ? (
            <div className="mt-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  adaptiveEG.tier === 'tight' ? 'bg-green-400' :
                  adaptiveEG.tier === 'medium' ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                <span className="text-sm font-bold text-foreground uppercase">{adaptiveEG.tier}</span>
                <span className="text-2xs text-muted-foreground font-mono">
                  {(adaptiveEG.min_eg * 100).toFixed(3)}%
                </span>
              </div>
              <div className="text-2xs text-muted-foreground mt-0.5">
                {adaptiveEG.games_remaining} games left · {adaptiveEG.fills_today} fills · {adaptiveEG.utilization_pct.toFixed(0)}% util
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-0.5">-</div>
          )}
        </div>
      </div>
      {dataSource === 'bot' && (
        <div className="text-2xs text-muted-foreground flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" /> Enriched data from bot API
        </div>
      )}

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
              <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                <div
                  className="p-3 flex items-center justify-between cursor-pointer hover:bg-secondary/30 transition-smooth"
                  onClick={() => setExpandedPos(expandedPos === i ? null : i)}
                >
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
                      {p.trade_fair_odds && (
                        <span className="text-2xs text-muted-foreground font-mono">
                          FV: {p.trade_fair_odds.fair_yes_cents.toFixed(1)}c ({centsToAmerican(p.trade_fair_odds.fair_yes_cents)})
                        </span>
                      )}
                      {p.eg_at_trade != null && (
                        <span className="text-2xs font-mono text-purple-400">
                          EG: {(p.eg_at_trade * 100).toFixed(3)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${(p.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(p.pnl || 0) >= 0 ? '+' : ''}{((p.pnl || 0) / 100).toFixed(2)}
                    </div>
                    {p.current_price != null && (
                      <div className="text-2xs text-muted-foreground">Now: {p.current_price}c</div>
                    )}
                    {p.live_fair_odds && (
                      <div className="text-2xs text-muted-foreground">
                        Live FV: {p.live_fair_odds.fair_yes_cents.toFixed(1)}c
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded: Per-leg fair odds */}
                {expandedPos === i && p.trade_leg_fair_odds && p.trade_leg_fair_odds.length > 0 && (
                  <div className="border-t border-border bg-secondary/20 px-3 py-2 space-y-1">
                    <div className="text-2xs text-muted-foreground font-medium mb-1">Per-Leg Fair Odds at Trade</div>
                    {p.trade_leg_fair_odds.map((leg, j) => {
                      const legSide = leg.side || 'yes'
                      const fmtOdds = (v?: number) => v == null ? '-' : (v > 0 ? `+${v}` : `${v}`)
                      return (
                      <div key={j} className="flex items-center justify-between text-2xs font-mono">
                        <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                          <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${
                            legSide === 'yes' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>{legSide.toUpperCase()}</span>
                          <span className="text-foreground/80 truncate">{leg.ticker}</span>
                        </div>
                        <div className="flex gap-3">
                          {leg.fair_prob != null ? (
                            <>
                              <span className={legSide === 'yes' ? 'text-green-400 font-semibold' : 'text-green-400/60'}>
                                YES {(leg.fair_prob * 100).toFixed(1)}% ({fmtOdds(leg.fair_american)})
                              </span>
                              <span className={legSide === 'no' ? 'text-red-400 font-semibold' : 'text-red-400/60'}>
                                NO {((leg.fair_prob_no ?? (1 - leg.fair_prob)) * 100).toFixed(1)}% ({fmtOdds(leg.fair_american_no)})
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">no odds data</span>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
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
