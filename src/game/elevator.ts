import { ROUNDS_PER_DIVE } from './scoring'
import type { RoundResult, Tier } from './types'

/**
 * The lift: how far an answer takes it, which lift the score has unlocked, and the timing of the ride after each
 * answer (components/elevator/ElevatorScene.tsx).
 *
 * Two things move separately. An answer's tier decides how many floors the lift climbs, and the cumulative score
 * decides which lift you're riding. The floor is only for show: the score is still out of 700.
 */

/** Floors the lift climbs for an answer of each tier. A miss doesn't move it */
export const FLOORS: Record<Tier, number> = { common: 1, trap: 2, solid: 3, rare: 4, ulu: 5, gem: 6 }

export function floorsFor(tier: Tier | null): number {
  return tier ? FLOORS[tier] : 0
}

/** Every game starts here */
export const GROUND_FLOOR = 1
/** Seven gems from the ground floor */
export const TOP_FLOOR = GROUND_FLOOR + ROUNDS_PER_DIVE * FLOORS.gem

/** The floor reached after these rounds */
export function floorAfter(results: readonly Pick<RoundResult, 'tier'>[]): number {
  return results.reduce((floor, r) => floor + floorsFor(r.tier), GROUND_FLOOR)
}

/** Floors as the lift's indicator shows them: two digits */
export function formatFloor(floor: number): string {
  return String(floor).padStart(2, '0')
}

export function floorsLabel(floors: number): string {
  return floors === 1 ? '1 floor' : `${floors} floors`
}

/**
 * The lifts, in the order the score unlocks them. They're stops on a daydream, not floors of one building: the
 * same boy, in grander and grander lifts
 */
export const STAGES = [
  { id: 'hdb', min: 0, name: 'HDB Lift', blurb: 'The classic. Every great climb starts at the void deck.' },
  { id: 'upgraded', min: 100, name: 'Upgraded HDB Lift', blurb: 'Fresh from lift upgrading. Still got the new-lift smell.' },
  { id: 'condo', min: 200, name: 'Condominium Lift', blurb: 'Wood panels, soft lighting. The guard nodded at you.' },
  { id: 'cbd', min: 350, name: 'CBD Office Tower', blurb: 'Glass, steel and very fast lifts. Nobody makes eye contact.' },
  { id: 'marina', min: 500, name: 'Marina Bay Luxury Lift', blurb: 'Marble, gold and a bay view. He is still chewing gum.' },
  { id: 'penthouse', min: 600, name: 'Sky Penthouse', blurb: 'Above the clouds. He has seen better.' },
] as const

export type Stage = (typeof STAGES)[number]
export type StageId = Stage['id']

/** How many lifts the score has unlocked beyond the first: 0 (HDB) to 5 (penthouse) */
export function stageIndex(score: number): number {
  return Math.max(0, STAGES.findLastIndex((s) => score >= s.min))
}

/** The lift a cumulative score rides in */
export function stageFor(score: number): Stage {
  return STAGES[stageIndex(score)]
}

/** The next lift to unlock, or null in the penthouse */
export function nextStage(score: number): Stage | null {
  return STAGES[stageIndex(score) + 1] ?? null
}

/** The lift an answer unlocks, when its points carry the score over a threshold */
export function upgradeFor(scoreBefore: number, gained: number): Stage | null {
  const after = stageFor(scoreBefore + gained)
  return after === stageFor(scoreBefore) ? null : after
}

/** Where a game stands: the score, the floor, the lift, and how far that lift has climbed since it was unlocked */
export interface Lift {
  score: number
  floor: number
  stage: Stage
  /** Floors climbed in this lift. Its view is drawn from here, so every lift opens on its best side */
  climbed: number
}

export function liftAfter(results: readonly Pick<RoundResult, 'tier' | 'points'>[]): Lift {
  let score = 0
  let floor = GROUND_FLOOR
  let stage: Stage = STAGES[0]
  let entered = GROUND_FLOOR
  for (const r of results) {
    score += r.points
    floor += floorsFor(r.tier)
    const now = stageFor(score)
    if (now !== stage) {
      stage = now
      entered = floor
    }
  }
  return { score, floor, stage, climbed: floor - entered }
}

/*
 * The ride. The doors close, the lift climbs the answer's floors, settles, and the doors open on the result. When
 * the answer unlocks a new lift, the upgrade plays between settling and the doors opening.
 */

/** The doors sliding shut, before the lift moves */
export const DOORS_MS = 380
/** From pulling away to stopping, by tier: about 300 ms a floor once it's moving */
export const TRAVEL_MS: Record<Tier, number> = { common: 700, trap: 900, solid: 1100, rare: 1300, ulu: 1500, gem: 1700 }
/** The car settling on its floor before anything else happens */
export const SETTLE_MS = 140
/** A new lift sweeping in, behind closed doors */
export const UPGRADE_MS = 1200
/** The doors opening on the rarity and the points, and a moment to read them */
export const ARRIVE_MS: Record<Tier, number> = { common: 1050, trap: 1050, solid: 1050, rare: 1100, ulu: 1200, gem: 1400 }
/** A miss: the doors twitch, the lift stays put, and that's all */
export const MISS_MS = 1400
/** Skips this soon after the answer are ignored, so a double-tap on Go or a held Enter doesn't skip the ride */
export const SKIP_GRACE_MS = 400

/** The whole animation for a result, from the doors closing to the reveal */
export function rideMs(tier: Tier | null, upgrade = false): number {
  if (!tier) return MISS_MS
  return DOORS_MS + TRAVEL_MS[tier] + SETTLE_MS + (upgrade ? UPGRADE_MS : 0) + ARRIVE_MS[tier]
}

/** Smootherstep: 0 to 1 with no speed or acceleration at either end */
const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10)
/** Above 1, the lift gets going sooner and brakes for longer, like a real one */
const BRAKING = 1.3

/**
 * Floors climbed `elapsed` ms after pulling away. From rest to rest, never backwards: a quick launch, then a long
 * brake into the floor
 */
export function rise(tier: Tier, elapsed: number): number {
  const u = Math.min(Math.max(elapsed / TRAVEL_MS[tier], 0), 1)
  return FLOORS[tier] * smoother(1 - (1 - u) ** BRAKING)
}

/** The floor the indicator shows that far up from `from`: it ticks over halfway between floors */
export function indicatorFloor(from: number, floorsClimbed: number): number {
  return from + Math.round(floorsClimbed)
}

/** How a layer of scenery scrolls as the lift climbs: `rate` units down per floor, wrapping every `period` if set */
export interface Scroll {
  rate: number
  period?: number
}

/** How far down a layer has scrolled, in scene units, `floors` floors up from where it was drawn */
export function scrollOffset({ rate, period }: Scroll, floors: number): number {
  const y = floors * rate
  return period ? ((y % period) + period) % period : y
}

/** What the caption says when the doors open */
export const ARRIVAL_LINES: Record<Tier | 'miss', string> = {
  common: 'One floor up. Everybody presses this button.',
  trap: 'Two floors. Act smart, but the whole lift had the same idea.',
  solid: 'Three floors up. Can lah.',
  rare: 'Four floors. Steady, not many get off here.',
  ulu: 'Five floors! Damn ulu. The lift is nearly empty.',
  gem: 'Six floors, non-stop. Sibei ulu!',
  miss: 'Aiyo. The lift stays put.',
}

/** Whether the player asked for less motion. Without matchMedia (very old browsers, tests), assume not */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}
