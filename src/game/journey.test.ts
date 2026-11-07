import { describe, expect, it } from 'vitest'
import {
  ARRIVE_MS,
  DEPART_MS,
  FIRST_LEG_MS,
  GEM_ARRIVE_MS,
  LAST_LEG_MS,
  LEAVE_MS,
  MISS_HOLD_MS,
  ONE_STOP_MS,
  PASS_LEG_MS,
  STOPS,
  journeyMs,
  leaving,
  position,
  stopsFor,
  travelMs,
} from './journey'
import { TIERS } from './types'

/** Position at every ms of a ride */
const samples = (stops: number) => Array.from({ length: travelMs(stops) + 1 }, (_, t) => position(t, stops))

describe('journey', () => {
  it('has one stop per tier, in order out of town', () => {
    expect(STOPS).toEqual(TIERS)
    expect(TIERS.map(stopsFor)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('takes longer the more ulu the answer, and the gem lingers longest', () => {
    const times = TIERS.map((t) => journeyMs(t))
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(new Set(times).size).toBe(TIERS.length)
    expect(journeyMs('common')).toBe(DEPART_MS + ONE_STOP_MS + ARRIVE_MS)
    expect(journeyMs('gem')).toBe(DEPART_MS + FIRST_LEG_MS + 4 * PASS_LEG_MS + LAST_LEG_MS + GEM_ARRIVE_MS)
    expect(journeyMs(null)).toBe(DEPART_MS + LEAVE_MS + MISS_HOLD_MS)
    // Seven a day: even the gem's ride stays short
    expect(journeyMs('gem')).toBeLessThan(6000)
  })

  for (const stops of [1, 2, 3, 6]) {
    it(`starts and ends at rest, never rolls back and never jumps, on a ${stops}-stop ride`, () => {
      const xs = samples(stops)
      expect(position(-100, stops)).toBe(0)
      expect(xs[0]).toBe(0)
      expect(xs.at(-1)).toBe(stops)
      expect(position(travelMs(stops) + 500, stops)).toBe(stops)
      const steps = xs.slice(1).map((x, i) => x - xs[i])
      expect(Math.min(...steps)).toBeGreaterThanOrEqual(0)
      // Under 0.005 stations a ms: no teleporting between legs
      expect(Math.max(...steps)).toBeLessThan(0.005)
      // Gentle at both ends
      expect(steps[0]).toBeLessThan(0.0002)
      expect(steps.at(-1)).toBeLessThan(0.0002)
    })
  }

  it('reaches each station it passes at the end of a leg', () => {
    expect(position(FIRST_LEG_MS, 6)).toBeCloseTo(1, 9)
    for (let k = 1; k <= 4; k++) expect(position(FIRST_LEG_MS + k * PASS_LEG_MS, 6)).toBeCloseTo(1 + k, 9)
  })

  it('slows down at each station it passes, as if it might stop, and speeds up between them', () => {
    const speed = (t: number) => position(t + 1, 6) - position(t - 1, 6)
    for (let k = 0; k < 4; k++) {
      const station = FIRST_LEG_MS + k * PASS_LEG_MS
      const between = station + PASS_LEG_MS / 2
      expect(speed(station)).toBeLessThan(speed(between) * 0.5)
      expect(speed(station)).toBeGreaterThan(0)
    }
  })

  it('pulls a missed train out of the station slowly, then fast, until it is gone', () => {
    expect(leaving(-10)).toBe(0)
    expect(leaving(0)).toBe(0)
    expect(leaving(LEAVE_MS)).toBe(1)
    expect(leaving(LEAVE_MS * 2)).toBe(1)
    expect(leaving(LEAVE_MS / 2)).toBeLessThan(0.5)
  })
})
