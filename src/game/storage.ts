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

/** A saved round result, as older builds may have written it */
type StoredRoundResult = Omit<RoundResult, 'attempts'> & { attempts?: unknown }

/** Today's saved progress, or null if the saved dive is from another day */
export function loadDaily(dateKey: string): DailyProgress | null {
  const saved = read<Omit<DailyProgress, 'results'> & { results: StoredRoundResult[] }>(DAILY_KEY)
  if (saved?.dateKey !== dateKey) return null
  // Results saved before rejected guesses were kept have no attempts
  const results = (Array.isArray(saved.results) ? saved.results : []).map(
    (r): RoundResult => ({
      ...r,
      attempts: Array.isArray(r.attempts) ? r.attempts.filter((a): a is string => typeof a === 'string') : [],
    }),
  )
  return { ...saved, results }
}

/**
 * Save a dive's progress. Progress for a later date is kept, so a tab still finishing yesterday's dive past
 * midnight can't wipe out today's dive from another tab
 */
export function saveDaily(progress: DailyProgress): void {
  const saved = read<DailyProgress>(DAILY_KEY)
  if (saved && saved.dateKey > progress.dateKey) return
  write(DAILY_KEY, progress)
}

export function loadStats(): Stats {
  return { ...EMPTY_STATS, ...read<Stats>(STATS_KEY) }
}

/**
 * Fold a finished daily dive into the stats. Ignores repeat calls for a day, and a dive older than the last
 * one recorded (finished late in another tab), which would otherwise rewind the streak
 */
export function recordDive(dateKey: string, results: RoundResult[]): Stats {
  const stats = loadStats()
  if (stats.lastPlayed !== null && dateKey <= stats.lastPlayed) return stats

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

/** The streak as of today. It's broken once a day passes without a dive, even before the next dive is recorded */
export function displayStreak(stats: Stats, todayKey: string): number {
  if (stats.lastPlayed === null) return 0
  const gap = daysBetween(stats.lastPlayed, todayKey)
  return gap === 0 || gap === 1 ? stats.currentStreak : 0
}

export function hasSeenHelp(): boolean {
  return read<boolean>(SEEN_HELP_KEY) === true
}

export function markHelpSeen(): void {
  write(SEEN_HELP_KEY, true)
}
