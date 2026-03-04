'use client'

import { useState, useEffect, useCallback } from 'react'

interface FunnelData {
  discovered: number
  qualified: number
  contacted: number
  responded: number
  meeting: number
  closed: number
}

interface Prospect {
  id: string
  name: string
  company: string
  stage: string
  score: number
  created_at: string
  updated_at: string
}

export function PmPipelinePanel() {
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [funnelRes, prospectsRes] = await Promise.all([
        fetch('/api/external/supabase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'funnel' }),
        }),
        fetch('/api/external/supabase?table=prospects&limit=20'),
      ])

      if (!funnelRes.ok || !prospectsRes.ok) {
        const errData = await (funnelRes.ok ? prospectsRes : funnelRes).json()
        setError(errData.error || 'Failed to fetch pipeline data')
        return
      }

      const funnelData = await funnelRes.json()
      const prospectsData = await prospectsRes.json()
      setFunnel(funnelData.funnel)
      setProspects(prospectsData.data || [])
    } catch {
      setError('Network error fetching pipeline data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h2 className="text-lg font-semibold text-foreground mb-4">PM Pipeline</h2>
        <div className="bg-card border border-amber-500/20 rounded-lg p-6 text-center">
          <p className="text-sm text-amber-400">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure <code className="font-mono bg-secondary px-1 rounded">SUPABASE_URL</code> and{' '}
            <code className="font-mono bg-secondary px-1 rounded">SUPABASE_KEY</code> to enable this panel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">PM Pipeline</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prospect funnel from Supabase
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="h-8 px-3 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-smooth disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Funnel Visualization */}
      {funnel && <FunnelChart data={funnel} />}

      {/* Recent Prospects */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Recent Prospects</h3>
        {prospects.length === 0 ? (
          <p className="text-xs text-muted-foreground">No prospects found</p>
        ) : (
          <div className="space-y-1.5">
            {prospects.map((p) => (
              <div key={p.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{p.name || 'Unknown'}</div>
                  <div className="text-2xs text-muted-foreground">{p.company || '-'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StageBadge stage={p.stage} />
                  {p.score > 0 && (
                    <span className="text-2xs font-mono text-muted-foreground">
                      Score: {p.score}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FunnelChart({ data }: { data: FunnelData }) {
  const stages = [
    { key: 'discovered', label: 'Discovered', color: 'bg-blue-500' },
    { key: 'qualified', label: 'Qualified', color: 'bg-cyan-500' },
    { key: 'contacted', label: 'Contacted', color: 'bg-purple-500' },
    { key: 'responded', label: 'Responded', color: 'bg-amber-500' },
    { key: 'meeting', label: 'Meeting', color: 'bg-orange-500' },
    { key: 'closed', label: 'Closed', color: 'bg-green-500' },
  ] as const

  const maxCount = Math.max(...Object.values(data), 1)

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Pipeline Funnel</h3>
      <div className="space-y-2">
        {stages.map((stage) => {
          const count = data[stage.key]
          const pct = Math.round((count / maxCount) * 100)
          return (
            <div key={stage.key} className="flex items-center gap-3">
              <div className="w-20 text-xs text-muted-foreground text-right shrink-0">{stage.label}</div>
              <div className="flex-1 h-7 bg-secondary rounded-md overflow-hidden relative">
                <div
                  className={`h-full ${stage.color} rounded-md transition-all duration-500`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs font-bold text-foreground">
                  {count}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    discovered: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    qualified: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    contacted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    responded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    meeting: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    closed: 'bg-green-500/20 text-green-400 border-green-500/30',
  }

  return (
    <span className={`text-2xs px-1.5 py-0.5 rounded border font-medium ${colors[stage] || 'bg-secondary text-muted-foreground border-border'}`}>
      {stage}
    </span>
  )
}
