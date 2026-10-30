import { describe, expect, it } from 'vitest'
import { displayStreak, type Stats } from './storage'

function stats(overrides: Partial<Stats> = {}): Stats {
  return {
    played: 3,
    totalScore: 300,
    bestScore: 120,
    currentStreak: 3,
    maxStreak: 3,
    lastPlayed: '2026-10-28',
    gems: 0,
    ...overrides,
  }
}

describe('displayStreak', () => {
  it('shows the stored streak when the last dive was today', () => {
    expect(displayStreak(stats({ lastPlayed: '2026-10-30' }), '2026-10-30')).toBe(3)
  })

  it('keeps the streak while yesterday is still the last dive', () => {
    expect(displayStreak(stats({ lastPlayed: '2026-10-29' }), '2026-10-30')).toBe(3)
  })

  it('reads zero once a day has been missed', () => {
    expect(displayStreak(stats({ lastPlayed: '2026-10-28' }), '2026-10-30')).toBe(0)
  })

  it('reads zero before the first dive', () => {
    expect(displayStreak(stats({ played: 0, currentStreak: 0, lastPlayed: null }), '2026-10-30')).toBe(0)
  })
})
