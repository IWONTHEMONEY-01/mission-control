'use client'

import { useFleetStore } from '@/store/fleet-store'

export function BotSelector() {
  const { bots, botStatuses, activeBot, setActiveBot } = useFleetStore()

  if (bots.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground font-medium">Bot:</label>
      <select
        value={activeBot || 'all'}
        onChange={(e) => setActiveBot(e.target.value === 'all' ? null : e.target.value)}
        className="h-7 px-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
      >
        <option value="all">All Bots</option>
        {bots.map((bot) => {
          const status = botStatuses[bot.id]
          const indicator = status?.status === 'online' ? '\u25CF' : '\u25CB'
          return (
            <option key={bot.id} value={bot.id}>
              {indicator} {bot.name}
            </option>
          )
        })}
      </select>
    </div>
  )
}

/** Compact bot filter pills (for use in panel headers) */
export function BotFilterPills() {
  const { bots, botStatuses, activeBot, setActiveBot } = useFleetStore()

  if (bots.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setActiveBot(null)}
        className={`h-6 px-2 rounded-full text-2xs font-medium transition-smooth ${
          activeBot === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:text-foreground'
        }`}
      >
        All
      </button>
      {bots.map((bot) => {
        const status = botStatuses[bot.id]
        const isActive = activeBot === bot.id
        const statusColor = status?.status === 'online'
          ? 'bg-green-500'
          : status?.status === 'timeout'
            ? 'bg-amber-500'
            : 'bg-red-500'

        return (
          <button
            key={bot.id}
            onClick={() => setActiveBot(bot.id)}
            className={`h-6 px-2 rounded-full text-2xs font-medium transition-smooth flex items-center gap-1.5 ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
            {bot.name}
          </button>
        )
      })}
    </div>
  )
}
