import { describe, expect, it } from 'vitest'
import {
  ARRIVE_MS,
  BOAT_X,
  CATCH_UP_MS,
  CHANGE_MS,
  DEPART_MS,
  FIRST_ISLAND,
  FIRST_LEG_MS,
  GEM_ARRIVE_MS,
  LEAVE_MS,
  MISS_HOLD_MS,
  ONE_STOP_MS,
  PASS_LEG_MS,
  STATION_X,
  STOPS,
  TERMINAL_X,
  frame,
  journeyMs,
  leaving,
  reached,
  schedule,
  stopsFor,
  travelMs,
  type Frame,
} from './journey'
import { TIERS, type Tier } from './types'

/** A frame for every ms of a ride */
const frames = (tier: Tier) => Array.from({ length: travelMs(tier) + 1 }, (_, t) => frame(tier, t))
const steps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i])

describe('journey', () => {
  it('has one stop per tier, in order out of town, with the island stops past the end of the MRT', () => {
    expect(STOPS).toEqual(TIERS)
    expect(TIERS.map(stopsFor)).toEqual([1, 2, 3, 4, 5, 6])
    expect(steps([...STATION_X]).every((d) => d > 0)).toBe(true)
    expect(STATION_X[FIRST_ISLAND - 1]).toBeLessThan(TERMINAL_X)
    expect(TERMINAL_X).toBeLessThan(BOAT_X)
    expect(BOAT_X).toBeLessThan(STATION_X[FIRST_ISLAND])
  })

  it('takes longer the more ulu the answer, and stays short enough for seven a day', () => {
    const times = TIERS.map((t) => journeyMs(t))
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(new Set(times).size).toBe(TIERS.length)
    expect(journeyMs('common')).toBe(DEPART_MS + ONE_STOP_MS + ARRIVE_MS)
    expect(journeyMs('gem')).toBe(DEPART_MS + travelMs('gem') + GEM_ARRIVE_MS)
    expect(journeyMs(null)).toBe(DEPART_MS + LEAVE_MS + MISS_HOLD_MS)
    expect(journeyMs('gem')).toBeLessThan(7500)
  })

  it('only changes to the bumboat for the island stops', () => {
    for (const tier of TIERS) {
      const { change, boat } = schedule(tier)
      const island = stopsFor(tier) >= FIRST_ISLAND
      expect(change).toBe(island ? CHANGE_MS : 0)
      expect(boat > 0).toBe(island)
      expect(new Set(frames(tier).map((f) => f.mode))).toEqual(new Set<Frame['mode']>(island ? ['train', 'change', 'boat'] : ['train']))
    }
  })

  for (const tier of TIERS) {
    it(`starts and ends at rest, never rolls back and never jumps, for ${tier}`, () => {
      const fs = frames(tier)
      const end = STATION_X[stopsFor(tier)]
      expect(frame(tier, -100)).toEqual({ camera: 0, vehicle: 0, mode: 'train' })
      expect(fs.at(-1)).toEqual({ camera: end, vehicle: end, mode: stopsFor(tier) >= FIRST_ISLAND ? 'boat' : 'train' })
      expect(frame(tier, travelMs(tier) + 500).camera).toBe(end)

      // The view moves smoothly the whole way, the change of vehicle included
      const camera = steps(fs.map((f) => f.camera))
      expect(Math.min(...camera)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...camera)).toBeLessThan(1.6)
      expect(camera[0]).toBeLessThan(0.05)
      expect(camera.at(-1)).toBeLessThan(0.05)
      // And so does each vehicle
      for (const mode of ['train', 'boat'] as const) {
        const own = steps(fs.filter((f) => f.mode === mode).map((f) => f.vehicle))
        if (own.length) expect(Math.min(...own)).toBeGreaterThanOrEqual(0)
        if (own.length) expect(Math.max(...own)).toBeLessThan(1.6)
      }
    })
  }

  it('reaches each station it passes at the end of a leg, and counts it then', () => {
    for (let k = 1; k < FIRST_ISLAND; k++) {
      const at = FIRST_LEG_MS + (k - 1) * PASS_LEG_MS
      expect(frame('gem', at).vehicle).toBeCloseTo(STATION_X[k], 6)
      expect(reached('gem', frame('gem', at).vehicle)).toBe(k)
      expect(reached('gem', frame('gem', at - 40).vehicle)).toBe(k - 1)
    }
    // Never past the answer's own station
    expect(reached('solid', 99_999)).toBe(3)
  })

  it('slows down at each station it passes, as if it might stop, and speeds up between them', () => {
    const speed = (t: number) => frame('gem', t + 1).vehicle - frame('gem', t - 1).vehicle
    for (let k = 0; k < 3; k++) {
      const station = FIRST_LEG_MS + k * PASS_LEG_MS
      expect(speed(station)).toBeLessThan(speed(station + PASS_LEG_MS / 2) * 0.5)
      expect(speed(station)).toBeGreaterThan(0)
    }
  })

  it('stops the train at the terminal, then the bumboat pulls away from the jetty with the view easing onto it', () => {
    const { train } = schedule('gem')
    // The train comes to rest at the end of the line and stays for the change
    expect(frame('gem', train - 1).vehicle).toBeCloseTo(TERMINAL_X, 1)
    for (const t of [train, train + CHANGE_MS / 2, train + CHANGE_MS - 1]) {
      expect(frame('gem', t)).toEqual({ camera: TERMINAL_X, vehicle: TERMINAL_X, mode: 'change' })
    }
    // The bumboat sets off from its mooring, ahead of the view, which catches up and settles on it
    const boat = train + CHANGE_MS
    expect(frame('gem', boat)).toEqual({ camera: TERMINAL_X, vehicle: BOAT_X, mode: 'boat' })
    const leads = Array.from({ length: CATCH_UP_MS + 1 }, (_, t) => {
      const f = frame('gem', boat + t)
      return f.vehicle - f.camera
    })
    expect(Math.max(...steps(leads))).toBeLessThanOrEqual(1e-9)
    expect(leads.at(-1)).toBeCloseTo(0, 9)
    const after = frame('gem', boat + CATCH_UP_MS + 200)
    expect(after.vehicle).toBe(after.camera)
  })

  it('pulls a missed train out of the station slowly, then fast, until it is gone', () => {
    expect(leaving(-10)).toBe(0)
    expect(leaving(0)).toBe(0)
    expect(leaving(LEAVE_MS)).toBe(1)
    expect(leaving(LEAVE_MS * 2)).toBe(1)
    expect(leaving(LEAVE_MS / 2)).toBeLessThan(0.5)
  })
})
