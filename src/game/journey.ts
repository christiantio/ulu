import { TIERS, type Tier } from './types'

/**
 * Timing and motion for the answer animation (components/Journey.tsx): a ride out of town on the "Ulu Line",
 * whose stations are the tiers in order. The train passes every station below the answer's tier, slowing at each
 * one as if it might stop, and stops at the answer's own. The MRT ends at the shore, at Changi Point: a ride to
 * the island stations (Damn Ulu and Sibei Ulu) stops there, you change to the bumboat waiting at the jetty, and it
 * takes you the rest of the way. A miss is the train leaving without you.
 *
 * Distances are in scene units (the scene is 480 wide), from the departure platform.
 */

/** The stops in order out of town, one per tier */
export const STOPS: readonly Tier[] = TIERS

/** Where each station is: [0] is the departure platform, then one per tier */
export const STATION_X: readonly number[] = [0, 340, 680, 1020, 1360, 2150, 2510]
/** The first station out at sea, which only the bumboat reaches */
export const FIRST_ISLAND = 5
/** The end of the MRT line, on the shore, where the train stops for the change to the bumboat */
export const TERMINAL_X = 1580
/** Where the bumboat waits at the jetty, ahead of the terminal */
export const BOAT_X = 1750

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
/** Braking into the terminal, a shorter run from the Steady stop */
export const TERMINAL_LEG_MS = 650
/** At the terminal: the doors open and you hop across into the bumboat */
export const CHANGE_MS = 700
/** The bumboat from the jetty to Damn Ulu, from rest to rest */
export const BOAT_ONE_STOP_MS = 1200
/** The bumboat from the jetty to the Damn Ulu stop it passes */
export const BOAT_FIRST_LEG_MS = 800
/** As the bumboat pulls away, the view drifts over to it and settles with it in the vehicle's usual place */
export const CATCH_UP_MS = 800
/** After the stop: the stamp, the confetti and the line, before the reveal */
export const ARRIVE_MS = 1200
/** The gem's arrival is longer, for the lighthouse */
export const GEM_ARRIVE_MS = 1500
/** A miss: the train pulls out and is gone */
export const LEAVE_MS = 1000
export const MISS_HOLD_MS = 900
/** Skips this soon after the answer are ignored, so a double-tap on Go or a held Enter doesn't skip the ride */
export const SKIP_GRACE_MS = 400

/** At a station it passes, a vehicle runs at this share of a middle leg's average speed */
const PASS_SHARE = 0.45
/** That speed, in units per ms. The same at every station, so the speed stays continuous between legs */
const PASS_SPEED = (PASS_SHARE * (STATION_X[2] - STATION_X[1])) / PASS_LEG_MS
/** A station counts as reached this close to it, so the meter changes as the vehicle draws level */
const REACH = 7

/** One stretch of a route, run along a cubic Hermite curve from speed v0 to v1 (units per ms) */
interface Leg {
  from: number
  to: number
  ms: number
  v0: number
  v1: number
}

interface Ride {
  /** From the platform to where the train stops: the answer's station, or the terminal */
  train: Leg[]
  /** From the jetty to the answer's island station; empty when the train goes all the way */
  boat: Leg[]
}

/** What a frame of the ride shows */
export interface Frame {
  /** The point of the line at the vehicle's usual place in the view */
  camera: number
  /** Where the vehicle is: ahead of the camera while the bumboat pulls away from the jetty */
  vehicle: number
  /** On the train; changing at the terminal (both parked); or on the bumboat */
  mode: 'train' | 'change' | 'boat'
}

/** How many stations out the answer's tier is: 1 (common) to 6 (gem) */
export function stopsFor(tier: Tier): number {
  return STOPS.indexOf(tier) + 1
}

/**
 * Legs through `points`: from rest at the first, passing every one in between at PASS_SPEED, to rest at the last.
 * A single leg runs from rest to rest in `only` ms
 */
function route(points: number[], ms: { only: number; first: number; last: number }): Leg[] {
  const legs = points.length - 1
  if (legs === 1) return [{ from: points[0], to: points[1], ms: ms.only, v0: 0, v1: 0 }]
  return points.slice(1).map((to, i) => ({
    from: points[i],
    to,
    ms: i === 0 ? ms.first : i === legs - 1 ? ms.last : PASS_LEG_MS,
    v0: i === 0 ? 0 : PASS_SPEED,
    v1: i === legs - 1 ? 0 : PASS_SPEED,
  }))
}

const rides = new Map<Tier, Ride>()

function ride(tier: Tier): Ride {
  const known = rides.get(tier)
  if (known) return known
  const stops = stopsFor(tier)
  const train = { only: ONE_STOP_MS, first: FIRST_LEG_MS, last: LAST_LEG_MS }
  const made: Ride =
    stops < FIRST_ISLAND
      ? { train: route(STATION_X.slice(0, stops + 1), train), boat: [] }
      : {
          train: route([...STATION_X.slice(0, FIRST_ISLAND), TERMINAL_X], { ...train, last: TERMINAL_LEG_MS }),
          boat: route([BOAT_X, ...STATION_X.slice(FIRST_ISLAND, stops + 1)], {
            only: BOAT_ONE_STOP_MS,
            first: BOAT_FIRST_LEG_MS,
            last: LAST_LEG_MS,
          }),
        }
  rides.set(tier, made)
  return made
}

const duration = (legs: Leg[]) => legs.reduce((sum, leg) => sum + leg.ms, 0)

/** How long each part of the ride takes: the train, the change at the terminal, and the bumboat */
export function schedule(tier: Tier): { train: number; change: number; boat: number } {
  const { train, boat } = ride(tier)
  return { train: duration(train), change: boat.length ? CHANGE_MS : 0, boat: duration(boat) }
}

/** From pulling away to stopping at the answer's station */
export function travelMs(tier: Tier): number {
  const { train, change, boat } = schedule(tier)
  return train + change + boat
}

/** The whole animation for a result, from the doors closing to the reveal */
export function journeyMs(tier: Tier | null): number {
  if (!tier) return DEPART_MS + LEAVE_MS + MISS_HOLD_MS
  return DEPART_MS + travelMs(tier) + (tier === 'gem' ? GEM_ARRIVE_MS : ARRIVE_MS)
}

/**
 * Cubic Hermite from 0 to 1 over u in [0, 1], with start and end slopes m0 and m1. Slopes up to 3 keep it
 * monotonic, so nothing rolls back
 */
function hermite(u: number, m0: number, m1: number): number {
  const u2 = u * u
  const u3 = u2 * u
  return m0 * (u3 - 2 * u2 + u) + (3 * u2 - 2 * u3) + m1 * (u3 - u2)
}

/** Where a route has got to, `t` ms after setting off */
function along(legs: Leg[], t: number): number {
  if (t <= 0) return legs[0].from
  for (const leg of legs) {
    if (t < leg.ms) {
      const d = leg.to - leg.from
      return leg.from + d * hermite(t / leg.ms, (leg.v0 * leg.ms) / d, (leg.v1 * leg.ms) / d)
    }
    t -= leg.ms
  }
  return legs[legs.length - 1].to
}

/** The ride `elapsed` ms after pulling away. The camera's speed is continuous throughout, the change included */
export function frame(tier: Tier, elapsed: number): Frame {
  const { train, boat } = ride(tier)
  const trainMs = duration(train)
  if (elapsed < trainMs || !boat.length) {
    const x = along(train, elapsed)
    return { camera: x, vehicle: x, mode: 'train' }
  }
  const t = elapsed - trainMs - CHANGE_MS
  if (t < 0) return { camera: TERMINAL_X, vehicle: TERMINAL_X, mode: 'change' }
  const x = along(boat, t)
  // The view starts where it stopped for the change and eases onto the bumboat as it gets going
  const u = Math.min(t / CATCH_UP_MS, 1)
  const lead = (BOAT_X - TERMINAL_X) * (1 - (3 * u * u - 2 * u * u * u))
  return { camera: x - lead, vehicle: x, mode: 'boat' }
}

/** How many of the ride's stations the vehicle has reached at `x` */
export function reached(tier: Tier, x: number): number {
  let count = 0
  for (let i = 1; i <= stopsFor(tier); i++) if (x >= STATION_X[i] - REACH) count = i
  return count
}

/** Where a missed train is, from 0 (at the platform) to 1 (gone), `elapsed` ms after pulling out */
export function leaving(elapsed: number): number {
  const u = Math.min(Math.max(elapsed / LEAVE_MS, 0), 1)
  return u * u * u
}

/** What the caption says when the vehicle arrives */
export const ARRIVAL_LINES: Record<Tier | 'miss', string> = {
  common: 'Everybody say one lah. Still got points.',
  trap: 'Act smart only… everybody also thought of that.',
  solid: 'Can lah! Out of town already.',
  rare: 'Steady! Not many people come this far.',
  ulu: 'Wah, damn ulu. Bumboat-only territory.',
  gem: 'Sibei ulu! Even the bumboat uncle never come this far.',
  miss: 'Aiyo, the train left without you.',
}

/** Whether the player asked for less motion. Without matchMedia (very old browsers, tests), assume not */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}
