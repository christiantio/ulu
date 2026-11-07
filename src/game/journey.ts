import { TIERS, type Tier } from './types'

/**
 * Timing and motion for the answer animation (components/Journey.tsx): a ride out of town on the "Ulu Line",
 * whose stations are the tiers in order. The ride passes every station below the answer's tier, slowing at each
 * one as if it might stop, and stops at the answer's own. A miss is the train leaving without you.
 *
 * Positions are in stations: 0 is the departure platform, 1 is the first stop (common), 6 the last (gem).
 */

/** The stops in order out of town, one per tier */
export const STOPS: readonly Tier[] = TIERS

/** Where the line leaves the land, between the Steady and Damn Ulu stops: past it, the train is a bumboat */
export const COAST = 4.5

/** Doors closing, before the train moves */
export const DEPART_MS = 450
/** A ride that stops at the very first station: from rest to rest */
export const ONE_STOP_MS = 1100
/** Pulling away from the platform to the first station passed */
export const FIRST_LEG_MS = 750
/** Each leg between two stations passed */
export const PASS_LEG_MS = 420
/** The last leg, braking into the answer's station */
export const LAST_LEG_MS = 950
/** At a station it passes, the train runs at this share of the leg's average speed */
const PASS_SPEED = 0.45
/** After the stop: the stamp, the confetti and the line, before the reveal */
export const ARRIVE_MS = 1200
/** The gem's arrival is longer, for the lighthouse */
export const GEM_ARRIVE_MS = 1600
/** A miss: the train pulls out and is gone */
export const LEAVE_MS = 1000
export const MISS_HOLD_MS = 900
/** Skips this soon after the answer are ignored, so a double-tap on Go or a held Enter doesn't skip the ride */
export const SKIP_GRACE_MS = 400

/** How many stations out the answer's tier is: 1 (common) to 6 (gem) */
export function stopsFor(tier: Tier): number {
  return STOPS.indexOf(tier) + 1
}

/** Time from pulling away to stopping, for a ride of `stops` stations */
export function travelMs(stops: number): number {
  if (stops <= 1) return ONE_STOP_MS
  return FIRST_LEG_MS + (stops - 2) * PASS_LEG_MS + LAST_LEG_MS
}

/** The whole animation for a result, from the doors closing to the reveal */
export function journeyMs(tier: Tier | null): number {
  if (!tier) return DEPART_MS + LEAVE_MS + MISS_HOLD_MS
  return DEPART_MS + travelMs(stopsFor(tier)) + (tier === 'gem' ? GEM_ARRIVE_MS : ARRIVE_MS)
}

/**
 * Cubic Hermite from 0 to 1 over u in [0, 1], with start and end slopes m0 and m1. Slopes up to 3 keep it
 * monotonic, so the train never rolls back
 */
function hermite(u: number, m0: number, m1: number): number {
  const u2 = u * u
  const u3 = u2 * u
  return m0 * (u3 - 2 * u2 + u) + (3 * u2 - 2 * u3) + m1 * (u3 - u2)
}

/**
 * Where the train is, in stations, `elapsed` ms after pulling away on a ride of `stops` stations. It starts and
 * ends at rest, and passes each station in between at the same, slower speed, so the speed is continuous
 */
export function position(elapsed: number, stops: number): number {
  const total = travelMs(stops)
  if (elapsed <= 0) return 0
  if (elapsed >= total) return stops
  if (stops <= 1) return hermite(elapsed / ONE_STOP_MS, 0, 0)

  // Speed at a passed station, in stations per ms: PASS_SPEED of a middle leg's average
  const speed = PASS_SPEED / PASS_LEG_MS
  if (elapsed < FIRST_LEG_MS) return hermite(elapsed / FIRST_LEG_MS, 0, speed * FIRST_LEG_MS)
  const middle = elapsed - FIRST_LEG_MS
  const passes = stops - 2
  if (middle < passes * PASS_LEG_MS) {
    const leg = Math.floor(middle / PASS_LEG_MS)
    const u = (middle - leg * PASS_LEG_MS) / PASS_LEG_MS
    return 1 + leg + hermite(u, PASS_SPEED, PASS_SPEED)
  }
  const u = (middle - passes * PASS_LEG_MS) / LAST_LEG_MS
  return stops - 1 + hermite(u, speed * LAST_LEG_MS, 0)
}

/** Where a missed train is, from 0 (at the platform) to 1 (gone), `elapsed` ms after pulling out */
export function leaving(elapsed: number): number {
  const u = Math.min(Math.max(elapsed / LEAVE_MS, 0), 1)
  return u * u * u
}

/** What the caption says when the train arrives */
export const ARRIVAL_LINES: Record<Tier | 'miss', string> = {
  common: 'Everybody say one lah. Still got points.',
  trap: 'Act smart only… everybody also thought of that.',
  solid: 'Can lah! Out of town already.',
  rare: 'Steady! Not many people come this far.',
  ulu: 'Wah, damn ulu. Bumboat-only territory.',
  gem: 'Sibei ulu! End of the line.',
  miss: 'Aiyo, the train left without you.',
}

/** Whether the player asked for less motion. Without matchMedia (very old browsers, tests), assume not */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}
