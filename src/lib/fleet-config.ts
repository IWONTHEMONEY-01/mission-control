/**
 * Fleet configuration — reads bot gateway configs from environment variables.
 * Server-side only (tokens must never reach the browser).
 *
 * Env var pattern:
 *   GATEWAY_<ID>_URL   = ws://host:port
 *   GATEWAY_<ID>_TOKEN = auth-token
 *   GATEWAY_<ID>_NAME  = Human-readable name (optional, defaults to ID)
 *
 * Pre-configured IDs: GENERAL, QUANT, MARKETING
 */

export interface BotConfig {
  id: string
  name: string
  url: string
  token: string
  /** HTTP base URL derived from the WS URL (for health probes) */
  httpUrl: string
}

export interface BotConfigPublic {
  id: string
  name: string
  /** true if a URL is configured (don't leak the actual URL to the browser) */
  configured: boolean
}

const BOT_IDS = ['GENERAL', 'QUANT', 'MARKETING'] as const

function wsToHttp(wsUrl: string): string {
  return wsUrl
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')
}

export function getFleetConfig(): BotConfig[] {
  const bots: BotConfig[] = []

  for (const id of BOT_IDS) {
    const url = process.env[`GATEWAY_${id}_URL`]
    if (!url) continue

    bots.push({
      id: id.toLowerCase(),
      name: process.env[`GATEWAY_${id}_NAME`] || id.charAt(0) + id.slice(1).toLowerCase(),
      url,
      token: process.env[`GATEWAY_${id}_TOKEN`] || '',
      httpUrl: wsToHttp(url),
    })
  }

  return bots
}

export function getFleetConfigPublic(): BotConfigPublic[] {
  return getFleetConfig().map(({ id, name }) => ({
    id,
    name,
    configured: true,
  }))
}

export function getBotConfig(botId: string): BotConfig | undefined {
  return getFleetConfig().find(b => b.id === botId.toLowerCase())
}
