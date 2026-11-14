import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_LINES,
  ARRIVE_MS,
  DOORS_MS,
  FLOORS,
  GROUND_FLOOR,
  POINTS_PER_FLOOR,
  floorForScore,
  MISS_MS,
  SETTLE_MS,
  SKIP_GRACE_MS,
  STAGES,
  TOP_FLOOR,
  TRAVEL_MS,
  UPGRADE_MS,
  floorAfter,
  floorsFor,
  formatFloor,
  indicatorFloor,
  liftAfter,
  nextStage,
  rideMs,
  rise,
  scrollOffset,
  stageFor,
  stageIndex,
  upgradeFor,
} from './elevator'
import { MAX_SCORE, ROUNDS_PER_DIVE, TIER_INFO } from './scoring'
import { TIERS, type Tier } from './types'

const hit = (tier: Tier | null) => ({ tier, points: tier ? TIER_INFO[tier].points : 0 })
const game = (...tiers: (Tier | null)[]) => tiers.map(hit)
const steps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])

describe('floors: how far an answer takes the lift', () => {
  it('gives equal scores the same height, regardless of answer mix or order', () => {
    const totals = new Map<number, number>()
    const visit = (played: ReturnType<typeof game>) => {
      const lift = liftAfter(played)
      expect(lift.floor).toBe(lift.score / POINTS_PER_FLOOR)
      expect(floorAfter(played)).toBe(lift.floor)
      expect(floorForScore(lift.score)).toBe(lift.floor)
      if (totals.has(lift.score)) expect(lift.floor).toBe(totals.get(lift.score))
      totals.set(lift.score, lift.floor)
      if (played.length < 4) for (const tier of [...TIERS, null]) visit([...played, hit(tier)])
    }
    visit([])
    expect(liftAfter(game('trap', 'trap')).floor).toBe(liftAfter(game('solid')).floor)
    expect(liftAfter(game('gem')).floor).toBeGreaterThan(liftAfter(game(...Array<Tier>(6).fill('trap'))).floor)
  })

  it('climbs one floor for every five points, and none for a miss', () => {
    expect(TIERS.map(floorsFor)).toEqual([2, 3, 6, 12, 17, 20])
    expect(floorsFor(null)).toBe(0)
  })

  it('leaves the points alone: the six tiers still score 10, 15, 30, 60, 85 and 100', () => {
    expect(TIERS.map((t) => TIER_INFO[t].points)).toEqual([10, 15, 30, 60, 85, 100])
    expect(MAX_SCORE).toBe(700)
  })

  it('starts on floor 0 and adds up every round', () => {
    expect(floorAfter([])).toBe(GROUND_FLOOR)
    expect(GROUND_FLOOR).toBe(0)
    expect(floorAfter(game('common'))).toBe(2)
    expect(floorAfter(game('gem'))).toBe(20)
    expect(floorAfter(game('rare', null, 'trap', 'ulu'))).toBe(12 + 0 + 3 + 17)
  })

  it('stays put on a miss', () => {
    expect(floorAfter(game(null, null, null))).toBe(GROUND_FLOOR)
    expect(floorAfter(game('solid', null))).toBe(floorAfter(game('solid')))
  })

  it('tops out at floor 140, seven gems up', () => {
    expect(TOP_FLOOR).toBe(140)
    expect(floorAfter(game(...Array<Tier>(ROUNDS_PER_DIVE).fill('gem')))).toBe(TOP_FLOOR)
  })

  it('shows floors as at least two digits', () => {
    expect(formatFloor(1)).toBe('01')
    expect(formatFloor(140)).toBe('140')
  })
})

describe('stages: which lift the score has unlocked', () => {
  it('unlocks each lift at its threshold', () => {
    const lifts: [number, string][] = [
      [0, 'hdb'],
      [99, 'hdb'],
      [100, 'upgraded'],
      [199, 'upgraded'],
      [200, 'condo'],
      [349, 'condo'],
      [350, 'cbd'],
      [499, 'cbd'],
      [500, 'marina'],
      [599, 'marina'],
      [600, 'penthouse'],
      [700, 'penthouse'],
    ]
    for (const [score, id] of lifts) expect(stageFor(score).id, `${score} points`).toBe(id)
    expect(STAGES.map((s) => s.min)).toEqual([0, 100, 200, 350, 500, 600])
    expect(stageIndex(0)).toBe(0)
    expect(stageIndex(MAX_SCORE)).toBe(STAGES.length - 1)
  })

  it('names the next lift up, and none after the penthouse', () => {
    expect(nextStage(0)?.name).toBe('Upgraded HDB Lift')
    expect(nextStage(349)?.name).toBe('CBD Office Tower')
    expect(nextStage(599)?.name).toBe('Sky Penthouse')
    expect(nextStage(600)).toBeNull()
  })

  it('reports an upgrade only for the answer that crosses a threshold', () => {
    expect(upgradeFor(0, 100)?.id).toBe('upgraded')
    expect(upgradeFor(90, 10)?.id).toBe('upgraded')
    expect(upgradeFor(90, 0)).toBeNull()
    expect(upgradeFor(100, 85)).toBeNull()
    expect(upgradeFor(340, 10)?.id).toBe('cbd')
    expect(upgradeFor(600, 100)).toBeNull()
  })

  it('never skips a lift: one answer unlocks at most one', () => {
    for (let score = 0; score <= MAX_SCORE; score += 5) {
      for (const tier of TIERS) {
        expect(stageIndex(score + TIER_INFO[tier].points) - stageIndex(score)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('liftAfter: where a game stands', () => {
  it('is the ground floor of the first lift before any answer', () => {
    expect(liftAfter([])).toEqual({ score: 0, floor: 0, stage: STAGES[0], climbed: 0 })
  })

  it('uses the same score for height and lift upgrades', () => {
    // Twenty floors and a new lift from one gem
    expect(liftAfter(game('gem'))).toMatchObject({ score: 100, floor: 20, stage: { id: 'upgraded' } })
    // Eighteen floors on trap answers, and still the first lift
    expect(liftAfter(game('trap', 'trap', 'trap', 'trap', 'trap', 'trap'))).toMatchObject({
      score: 90,
      floor: 18,
      stage: { id: 'hdb' },
    })
    // A miss changes neither
    expect(liftAfter(game('gem', null))).toMatchObject({ score: 100, floor: 20, stage: { id: 'upgraded' } })
  })

  it('counts the floors climbed since the current lift was unlocked', () => {
    expect(liftAfter(game('common', 'solid')).climbed).toBe(8)
    // The gem unlocks the second lift, which starts its own count
    expect(liftAfter(game('common', 'gem')).climbed).toBe(0)
    expect(liftAfter(game('common', 'gem', 'solid', null)).climbed).toBe(6)
    expect(liftAfter(game('gem', 'gem')).climbed).toBe(0)
  })

  it('reaches the penthouse on a perfect game', () => {
    expect(liftAfter(game('gem', 'gem', 'gem', 'gem', 'gem', 'gem', 'gem'))).toMatchObject({
      score: MAX_SCORE,
      floor: TOP_FLOOR,
      stage: { id: 'penthouse' },
    })
  })

  it('gives a resumed game the lift it left: the saved results are all it needs', () => {
    const played = game('rare', 'ulu', null, 'gem')
    const whole = liftAfter(played)
    // Stored and loaded again, as daily progress is
    const resumed = liftAfter(JSON.parse(JSON.stringify(played)))
    expect(resumed).toEqual(whole)
    expect(whole).toMatchObject({ score: 245, floor: 49, stage: { id: 'condo' } })
  })
})

describe('the ride', () => {
  it('takes longer the rarer the answer, and stays snappy', () => {
    const times = TIERS.map((t) => rideMs(t))
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(rideMs('common')).toBe(DOORS_MS + TRAVEL_MS.common + SETTLE_MS + ARRIVE_MS.common)
    // About 1.5 to 3 s for an ordinary answer, a little more for the rare ones
    expect(rideMs('common')).toBeGreaterThanOrEqual(1500)
    expect(rideMs('rare')).toBeLessThanOrEqual(3000)
    expect(rideMs('gem')).toBeLessThanOrEqual(3800)
  })

  it('adds the upgrade to the ride that unlocks a lift', () => {
    for (const tier of TIERS) expect(rideMs(tier, true) - rideMs(tier)).toBe(UPGRADE_MS)
    expect(UPGRADE_MS).toBeLessThanOrEqual(1500)
  })

  it('keeps a miss shorter than any ride, with no travel at all', () => {
    expect(rideMs(null)).toBe(MISS_MS)
    expect(rideMs(null, true)).toBe(MISS_MS)
    expect(MISS_MS).toBeLessThan(rideMs('common'))
  })

  it('leaves time to skip only after the grace period', () => {
    expect(SKIP_GRACE_MS).toBeLessThan(MISS_MS)
    expect(SKIP_GRACE_MS).toBeGreaterThanOrEqual(DOORS_MS)
  })

  for (const tier of TIERS) {
    it(`climbs from rest to rest, never back and never in a jump, for ${tier}`, () => {
      const frames = Array.from({ length: TRAVEL_MS[tier] + 1 }, (_, t) => rise(tier, t))
      expect(rise(tier, -100)).toBe(0)
      expect(frames[0]).toBe(0)
      expect(frames.at(-1)).toBeCloseTo(FLOORS[tier], 9)
      expect(rise(tier, TRAVEL_MS[tier] + 500)).toBe(FLOORS[tier])

      const speed = steps(frames)
      expect(Math.min(...speed)).toBeGreaterThanOrEqual(0)
      // At rest at both ends, and never faster than one floor per 40 ms, even on an express ride in between
      expect(speed[0]).toBeLessThan(0.0005)
      expect(speed.at(-1)).toBeLessThan(0.0005)
      expect(Math.max(...speed)).toBeLessThan(1 / 40)
    })
  }

  it('gets going quickly and brakes for longer', () => {
    for (const tier of TIERS) {
      const half = rise(tier, TRAVEL_MS[tier] / 2)
      expect(half).toBeGreaterThan(FLOORS[tier] * 0.55)
      expect(half).toBeLessThan(FLOORS[tier] * 0.8)
    }
  })

  it('ticks the indicator over halfway between floors, one floor at a time, ending on the right one', () => {
    for (const tier of TIERS) {
      const readings = Array.from({ length: TRAVEL_MS[tier] + 1 }, (_, t) => indicatorFloor(8, rise(tier, t)))
      expect(readings[0]).toBe(8)
      expect(readings.at(-1)).toBe(8 + FLOORS[tier])
      expect(new Set(steps(readings))).toEqual(new Set([0, 1]))
    }
    expect(indicatorFloor(8, 0.49)).toBe(8)
    expect(indicatorFloor(8, 0.5)).toBe(9)
  })

  it('scrolls scenery by its own rate, wrapping layers that repeat', () => {
    expect(scrollOffset({ rate: 14 }, 0)).toBe(0)
    expect(scrollOffset({ rate: 14 }, 2.5)).toBe(35)
    expect(scrollOffset({ rate: 120, period: 120 }, 3)).toBe(0)
    expect(scrollOffset({ rate: 120, period: 120 }, 3.25)).toBe(30)
    expect(scrollOffset({ rate: 3 }, 12)).toBe(36)
  })

  it('has something to say for every arrival', () => {
    for (const key of [...TIERS, 'miss'] as const) expect(ARRIVAL_LINES[key].length).toBeGreaterThan(0)
  })
})
