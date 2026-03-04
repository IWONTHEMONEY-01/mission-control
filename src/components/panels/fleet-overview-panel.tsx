'use client'

import { useEffect, useCallback } from 'react'
import { useFleetStore, fetchFleetConfig, fetchFleetStatus, type FleetBotStatus } from '@/store/fleet-store'
import { useNavigateToPanel } from '@/lib/navigation'

const REFRESH_INTERVAL = 15_000 // 15 seconds

export function FleetOverviewPanel() {
  const { bots, botStatuses, loading, lastRefresh } = useFleetStore()
  const navigateToPanel = useNavigateToPanel()

  const refresh = useCallback(() => {
    fetchFleetConfig()
    fetchFleetStatus()
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(fetchFleetStatus, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  const online = Object.values(botStatuses).filter(b => b.status === 'online').length
  const total = bots.length

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Fleet Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `${online}/${total} bots online` : 'No bots configured'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-2xs text-muted-foreground">
              Updated {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="h-8 px-3 rounded-md text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-smooth disabled:opacity-50"
          >
            {loading ? 'Probing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Fleet Summary */}
      {total > 0 && <FleetSummary statuses={Object.values(botStatuses)} />}

      {/* Bot Cards */}
      {bots.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              botId={bot.id}
              botName={bot.name}
              status={botStatuses[bot.id]}
              onDrillDown={() => {
                useFleetStore.getState().setActiveBot(bot.id)
                navigateToPanel('overview')
              }}
            />
          ))}
        </div>
      )}

      {/* Quick Links */}
      {total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink label="Sessions" panel="sessions" icon={<SessionsIcon />} onClick={() => navigateToPanel('sessions')} />
          <QuickLink label="Logs" panel="logs" icon={<LogsIcon />} onClick={() => navigateToPanel('logs')} />
          <QuickLink label="Cron Jobs" panel="cron" icon={<CronIcon />} onClick={() => navigateToPanel('cron')} />
          <QuickLink label="Gateway Manager" panel="gateways" icon={<GatewaysIcon />} onClick={() => navigateToPanel('gateways')} />
        </div>
      )}
    </div>
  )
}

function FleetSummary({ statuses }: { statuses: FleetBotStatus[] }) {
  const totalSessions = statuses.reduce((sum, s) => sum + (s.sessions || 0), 0)
  const totalActiveSessions = statuses.reduce((sum, s) => sum + (s.activeSessions || 0), 0)
  const totalCronJobs = statuses.reduce((sum, s) => sum + (s.cronJobs || 0), 0)
  const avgLatency = statuses.filter(s => s.latency != null).length > 0
    ? Math.round(statuses.filter(s => s.latency != null).reduce((sum, s) => sum + (s.latency || 0), 0) / statuses.filter(s => s.latency != null).length)
    : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryCard label="Total Sessions" value={totalSessions} />
      <SummaryCard label="Active Sessions" value={totalActiveSessions} />
      <SummaryCard label="Cron Jobs" value={totalCronJobs} />
      <SummaryCard label="Avg Latency" value={avgLatency != null ? `${avgLatency}ms` : '-'} />
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-2xs text-muted-foreground font-medium">{label}</div>
      <div className="text-xl font-bold text-foreground mt-0.5">{value}</div>
    </div>
  )
}

function BotCard({ botId, botName, status, onDrillDown }: {
  botId: string
  botName: string
  status: FleetBotStatus | undefined
  onDrillDown: () => void
}) {
  const statusConfig = {
    online: { color: 'bg-green-500', border: 'border-green-500/20', bg: 'bg-green-500/5', label: 'Online', textColor: 'text-green-400' },
    offline: { color: 'bg-red-500', border: 'border-red-500/20', bg: 'bg-red-500/5', label: 'Offline', textColor: 'text-red-400' },
    timeout: { color: 'bg-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5', label: 'Timeout', textColor: 'text-amber-400' },
    unknown: { color: 'bg-muted-foreground/30', border: 'border-border', bg: '', label: 'Probing...', textColor: 'text-muted-foreground' },
  }

  const s = status?.status || 'unknown'
  const cfg = statusConfig[s]

  const botIcons: Record<string, string> = {
    general: 'G',
    quant: 'Q',
    marketing: 'M',
    metrics: 'X',
  }

  return (
    <button
      onClick={onDrillDown}
      className={`text-left bg-card border rounded-xl p-4 transition-smooth hover:bg-secondary/50 ${cfg.border} ${cfg.bg}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-sm">{botIcons[botId] || botId[0]?.toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{botName}</h3>
              <span className={`w-2 h-2 rounded-full ${cfg.color} ${s === 'online' ? 'pulse-dot' : ''}`} />
            </div>
            <span className={`text-2xs font-medium ${cfg.textColor}`}>{cfg.label}</span>
          </div>
        </div>
        {status?.latency != null && (
          <span className="text-2xs text-muted-foreground font-mono">{status.latency}ms</span>
        )}
      </div>

      {/* Stats row */}
      {status && status.status === 'online' && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <div>
            <div className="text-2xs text-muted-foreground">Sessions</div>
            <div className="text-sm font-semibold text-foreground">{status.sessions}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground">Active</div>
            <div className="text-sm font-semibold text-foreground">{status.activeSessions}</div>
          </div>
          <div>
            <div className="text-2xs text-muted-foreground">Cron</div>
            <div className="text-sm font-semibold text-foreground">{status.cronJobs}</div>
          </div>
          {status.version && (
            <div>
              <div className="text-2xs text-muted-foreground">Version</div>
              <div className="text-sm font-mono text-foreground">{status.version}</div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {status?.error && status.status !== 'online' && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-2xs text-red-400 font-mono">{status.error}</p>
        </div>
      )}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-card border border-border rounded-xl">
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="5" rx="1" />
          <rect x="1" y="9" width="14" height="5" rx="1" />
          <circle cx="4" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
          <circle cx="4" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-foreground">No bots configured</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Set <code className="font-mono bg-secondary px-1 rounded">GATEWAY_&lt;ID&gt;_URL</code> and{' '}
        <code className="font-mono bg-secondary px-1 rounded">GATEWAY_&lt;ID&gt;_TOKEN</code> environment
        variables to connect your bot fleet.
      </p>
      <div className="mt-4 bg-secondary rounded-lg p-3 max-w-md mx-auto text-left">
        <pre className="text-2xs text-muted-foreground font-mono whitespace-pre-wrap">
{`GATEWAY_GENERAL_URL=ws://general-bot.railway.internal:18789
GATEWAY_GENERAL_TOKEN=your-token
GATEWAY_QUANT_URL=ws://quant-bot.railway.internal:18789
GATEWAY_QUANT_TOKEN=your-token`}
        </pre>
      </div>
    </div>
  )
}

function QuickLink({ label, icon, onClick }: { label: string; panel: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg hover:bg-secondary/50 transition-smooth"
    >
      <div className="w-5 h-5 text-muted-foreground">{icon}</div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}

// Inline icons (match nav-rail style)
function SessionsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v9H2zM5 12v2M11 12v2M4 14h8" />
    </svg>
  )
}

function LogsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M5 5h6M5 8h6M5 11h3" />
    </svg>
  )
}

function CronIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 4v4l2.5 2.5" />
    </svg>
  )
}

function GatewaysIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="5" rx="1" />
      <rect x="1" y="9" width="14" height="5" rx="1" />
      <circle cx="4" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="4" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
      <path d="M7 4.5h5M7 11.5h5" />
    </svg>
  )
}
