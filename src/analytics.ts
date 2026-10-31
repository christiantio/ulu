/**
 * Cookie-less, privacy-friendly analytics through Plausible or Umami, chosen at build time. Without the
 * VITE_ANALYTICS_* variables (local dev, CI, preview deploys) nothing is loaded or sent, and the same goes for
 * the dev server and for any host other than the configured domain.
 *
 * Events carry no personal data and nothing the player typed: only the event name and, for a few, a coarse
 * property (a score band, or share vs copy). See "Privacy" in README.md.
 */
import { MAX_SCORE } from './game/scoring'

export type AnalyticsProvider = 'plausible' | 'umami'

interface EventProps {
  /** Round 1 of the daily dive started */
  dive_started: undefined
  /** A daily dive finished, once per dive. The score only as a band, see scoreBucket */
  dive_completed: { score: string }
  unlimited_started: undefined
  share_tapped: { method: 'share' | 'copy' }
  /** How to play opened from its button (not the automatic first-visit opening) */
  howto_opened: undefined
}

export type AnalyticsEvent = keyof EventProps

type Props = Record<string, string>

declare global {
  interface Window {
    plausible?: ((event: string, options?: { props?: Props }) => void) & { q?: unknown[][] }
    umami?: { track: (event: string, data?: Props) => void }
  }
}

export interface AnalyticsConfig {
  provider: AnalyticsProvider
  /** The provider's script URL */
  src: string
  /** The production hostname, e.g. ulu.sg. Nothing is sent from any other host */
  domain: string
  /** Umami's website id */
  websiteId?: string
}

export const PROVIDER_NAMES: Record<AnalyticsProvider, string> = { plausible: 'Plausible', umami: 'Umami' }

/** The analytics set up for this build, or null when it has none. Read on every call so tests can stub the env */
export function analyticsConfig(): AnalyticsConfig | null {
  const env = import.meta.env
  const provider = env.VITE_ANALYTICS_PROVIDER?.trim()
  const src = env.VITE_ANALYTICS_SRC?.trim()
  const domain = env.VITE_ANALYTICS_DOMAIN?.trim().toLowerCase()
  const websiteId = env.VITE_ANALYTICS_WEBSITE_ID?.trim()
  if (!src || !domain) return null
  if (provider === 'plausible') return { provider, src, domain }
  if (provider === 'umami' && websiteId) return { provider, src, domain, websiteId }
  return null
}

/** The config, if this page should send anything: a configured production build on the configured domain */
function activeConfig(): AnalyticsConfig | null {
  if (import.meta.env.DEV) return null
  const config = analyticsConfig()
  if (!config) return null
  const host = window.location.hostname
  return host === config.domain || host === `www.${config.domain}` ? config : null
}

/** Add the provider's script, which also counts the page view. Does nothing unless analytics is active here */
export function loadAnalytics(): void {
  const config = activeConfig()
  if (!config || document.querySelector('script[data-ulu-analytics]')) return
  const script = document.createElement('script')
  script.defer = true
  script.src = config.src
  script.dataset.uluAnalytics = config.provider
  if (config.provider === 'plausible') {
    script.dataset.domain = config.domain
    // Plausible's own snippet: queue events fired before the script arrives, for it to replay
    const q: unknown[][] = []
    window.plausible ??= Object.assign((...args: unknown[]) => void q.push(args), { q })
  } else {
    script.dataset.websiteId = config.websiteId
    // Umami's own host check, on top of ours
    script.dataset.domains = `${config.domain},www.${config.domain}`
  }
  document.head.append(script)
}

/** Send an event, if analytics is active. Never throws: analytics must not break the game */
export function track<E extends AnalyticsEvent>(
  event: E,
  ...[props]: EventProps[E] extends undefined ? [] : [EventProps[E]]
): void {
  try {
    const config = activeConfig()
    if (!config) return
    if (config.provider === 'plausible') window.plausible?.(event, props ? { props } : undefined)
    else window.umami?.track(event, props)
  } catch {
    // A blocked or broken provider script; ignore
  }
}

/** A dive score as a band of 100 points: "0-99", "100-199", … "600-699", and "700" for a perfect dive */
export function scoreBucket(score: number): string {
  if (score >= MAX_SCORE) return String(MAX_SCORE)
  const low = Math.max(0, Math.floor(score / 100) * 100)
  return `${low}-${low + 99}`
}
