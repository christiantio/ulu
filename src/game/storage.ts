import { daysBetween } from './daily'
import type { RoundResult } from './types'

/**
 * Everything lives in localStorage on the player's device. Reads and writes
 * are wrapped so private browsing or blocked storage never breaks the game.
 */

const DAILY_KEY = 'ulu:daily'
const STATS_KEY = 'ulu:stats'
const SEEN_HELP_KEY = 'ulu:seen-help'

export interface DailyProgress {
  dateKey: string
  promptIds: string[]
  results: RoundResult[]
  /** When the in-progress round started, so a reload can't reset the clock */
  startedAt: number | null
}

export interface Stats {
  played: number
  totalScore: number
  bestScore: number
  currentStreak: number
  maxStreak: number
  lastPlayed: string | null
  gems: number
}

const EMPTY_STATS: Stats = {
  played: 0,
  totalScore: 0,
  bestScore: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayed: null,
  gems: 0,
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable; the game still works, it just won't remember
  }
}

/** Today's saved progress, or null if the saved dive is from another day */
export function loadDaily(dateKey: string): DailyProgress | null {
  const saved = read<DailyProgress>(DAILY_KEY)
  return saved?.dateKey === dateKey ? saved : null
}

export function saveDaily(progress: DailyProgress): void {
  write(DAILY_KEY, progress)
}

export function loadStats(): Stats {
  return { ...EMPTY_STATS, ...read<Stats>(STATS_KEY) }
}

/** Fold a finished daily dive into the stats; ignores repeat calls for a day */
export function recordDive(dateKey: string, results: RoundResult[]): Stats {
  const stats = loadStats()
  if (stats.lastPlayed === dateKey) return stats

  const score = results.reduce((sum, r) => sum + r.points, 0)
  const continues = stats.lastPlayed !== null && daysBetween(stats.lastPlayed, dateKey) === 1
  const currentStreak = continues ? stats.currentStreak + 1 : 1
  const next: Stats = {
    played: stats.played + 1,
    totalScore: stats.totalScore + score,
    bestScore: Math.max(stats.bestScore, score),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    lastPlayed: dateKey,
    gems: stats.gems + results.filter((r) => r.tier === 'gem').length,
  }
  write(STATS_KEY, next)
  return next
}

export function hasSeenHelp(): boolean {
  return read<boolean>(SEEN_HELP_KEY) === true
}

export function markHelpSeen(): void {
  write(SEEN_HELP_KEY, true)
}
