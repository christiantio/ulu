import { ROUNDS_PER_DIVE } from './scoring'
import type { Category, Prompt } from './types'

/** Dive #1 is on this Singapore date */
export const LAUNCH_DATE = '2026-10-27'

/** Today's date in Singapore as YYYY-MM-DD, whatever the device timezone */
export function singaporeDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Whole days between two YYYY-MM-DD keys */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** The YYYY-MM-DD key `days` days after `dateKey` */
export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/** 1-based dive number for a date key (can be ≤ 0 before launch) */
export function diveNumber(dateKey: string): number {
  return daysBetween(LAUNCH_DATE, dateKey) + 1
}

/** Milliseconds until the next Singapore midnight */
export function msUntilNextDive(now: Date = new Date()): number {
  const sgNow = now.getTime() + 8 * 3_600_000 // Singapore has no DST
  const nextMidnight = Math.floor(sgNow / 86_400_000 + 1) * 86_400_000
  return nextMidnight - sgNow
}

/** FNV-1a string hash, used to seed the generator */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Small seeded PRNG returning floats in [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function groupByCategory(prompts: readonly Prompt[]): Map<Category, Prompt[]> {
  const groups = new Map<Category, Prompt[]>()
  for (const p of [...prompts].sort((a, b) => a.id.localeCompare(b.id))) {
    groups.set(p.category, [...(groups.get(p.category) ?? []), p])
  }
  return groups
}

/**
 * The seeded prompts for a given day. Everyone gets the same set for the same
 * Singapore date. Each category walks through its own fixed shuffled order,
 * one step per day, so a prompt only repeats once its category has cycled.
 * Each day draws from different categories while there are enough of them.
 *
 * The game reads days from the frozen schedule (see schedule.ts); this is
 * only the fallback for an unscheduled date, because changing a category's
 * prompt count reshuffles its whole order.
 */
export function dailyPrompts(prompts: readonly Prompt[], dateKey: string): Prompt[] {
  const day = daysBetween(LAUNCH_DATE, dateKey)
  const groups = groupByCategory(prompts)
  const rand = mulberry32(hashString(`ulu:${dateKey}`))
  const categories = shuffle([...groups.keys()].sort(), rand)

  const picked: Prompt[] = []
  // Pass 0 takes one prompt per category, later passes only fill gaps when
  // there are fewer categories than rounds.
  for (let pass = 0; picked.length < ROUNDS_PER_DIVE && pass < prompts.length; pass++) {
    for (const category of categories) {
      if (picked.length >= ROUNDS_PER_DIVE) break
      const group = groups.get(category)!
      if (pass >= group.length) continue
      const order = shuffle(group, mulberry32(hashString(`ulu:${category}`)))
      const index = (((day + pass * 7) % order.length) + order.length) % order.length
      const prompt = order[index]
      if (!picked.includes(prompt)) picked.push(prompt)
    }
  }
  return picked
}

/** A random set for Unlimited mode, still one prompt per category where possible */
export function randomPrompts(prompts: readonly Prompt[], rand: () => number = Math.random): Prompt[] {
  const groups = groupByCategory(prompts)
  const firsts = shuffle([...groups.values()].map((g) => shuffle(g, rand)[0]), rand)
  const rest = shuffle(
    prompts.filter((p) => !firsts.includes(p)),
    rand,
  )
  return [...firsts, ...rest].slice(0, ROUNDS_PER_DIVE)
}
