import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadDaily, loadStats, recordDive, saveDaily, type DailyProgress } from './storage'
import type { RoundResult } from './types'

/** Just enough of the Storage API for storage.ts, kept in memory */
function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
  }
}

const results = (points: number[]): RoundResult[] =>
  points.map((p, i) => ({
    promptId: `p${i}`,
    input: 'x',
    answer: p ? 'x' : null,
    tier: p === 100 ? 'gem' : p ? 'solid' : null,
    points: p,
  }))

const progress = (dateKey: string, rounds: number): DailyProgress => ({
  dateKey,
  promptIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  results: results(Array.from({ length: rounds }, () => 30)),
  startedAt: null,
})

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recordDive', () => {
  it('counts a dive once per day and builds a streak on consecutive days', () => {
    expect(recordDive('2026-11-04', results([100, 30, 0]))).toMatchObject({
      played: 1,
      totalScore: 130,
      bestScore: 130,
      currentStreak: 1,
      lastPlayed: '2026-11-04',
      gems: 1,
    })
    // A repeat call for the same day changes nothing
    expect(recordDive('2026-11-04', results([100, 100]))).toMatchObject({ played: 1, totalScore: 130 })
    expect(recordDive('2026-11-05', results([30]))).toMatchObject({ played: 2, currentStreak: 2, maxStreak: 2 })
    expect(loadStats()).toMatchObject({ played: 2, currentStreak: 2, lastPlayed: '2026-11-05' })
  })

  it('restarts the streak after a missed day', () => {
    recordDive('2026-11-04', results([30]))
    expect(recordDive('2026-11-06', results([30]))).toMatchObject({ currentStreak: 1, maxStreak: 1 })
  })

  it('ignores a dive older than the last one recorded, so a late finish in another tab cannot rewind the stats', () => {
    recordDive('2026-11-04', results([30]))
    const before = recordDive('2026-11-05', results([60]))
    expect(recordDive('2026-11-04', results([100]))).toEqual(before)
    expect(loadStats()).toEqual(before)
    expect(before).toMatchObject({ played: 2, currentStreak: 2, lastPlayed: '2026-11-05' })
  })
})

describe('saveDaily', () => {
  it("saves and resumes a day's progress", () => {
    saveDaily(progress('2026-11-04', 2))
    saveDaily(progress('2026-11-04', 3))
    expect(loadDaily('2026-11-04')?.results).toHaveLength(3)
    expect(loadDaily('2026-11-05')).toBeNull()
  })

  it('moves on to a new day', () => {
    saveDaily(progress('2026-11-04', 7))
    saveDaily(progress('2026-11-05', 1))
    expect(loadDaily('2026-11-05')?.results).toHaveLength(1)
  })

  it("doesn't overwrite a later day's progress with an earlier day's", () => {
    saveDaily(progress('2026-11-05', 7))
    saveDaily(progress('2026-11-04', 7))
    expect(loadDaily('2026-11-05')?.results).toHaveLength(7)
    expect(loadDaily('2026-11-04')).toBeNull()
  })
})
