import { LAUNCH_DATE, addDays, dailyPrompts, daysBetween, hashString, mulberry32, randomPrompts, shuffle } from './daily'
import { ROUNDS_PER_DIVE } from './scoring'
import type { Prompt } from './types'

/**
 * The frozen daily schedule: Singapore date → the ids of that day's prompts.
 * Lives in src/content/schedule.json and only ever grows, so adding, editing
 * or reordering prompts can't change a day that's already scheduled.
 */
export type Schedule = Record<string, string[]>

/** The schedule must reach at least this many days past today */
export const MIN_DAYS_AHEAD = 14
/** A prompt can't come back within this many days. Raise it as the bank grows */
export const MIN_REPEAT_GAP = 7

/** A day's prompts: the scheduled ones, or the seeded fallback if the date isn't scheduled */
export function promptsForDate(prompts: readonly Prompt[], dateKey: string, schedule: Schedule): Prompt[] {
  const ids = schedule[dateKey]
  if (ids) {
    const byId = new Map(prompts.map((p) => [p.id, p]))
    const scheduled = ids.map((id) => byId.get(id))
    if (scheduled.every((p) => p !== undefined)) return scheduled as Prompt[]
  }
  return dailyPrompts(prompts, dateKey)
}

/**
 * Prompts for an Unlimited game. It replays prompts from past dives, which
 * players have already had their chance at, and skips the previous game's
 * prompts. Today's dive is never included. While the archive is too small to
 * fill a game, it draws from the rest of the bank.
 */
export function unlimitedPrompts(
  prompts: readonly Prompt[],
  schedule: Schedule,
  today: string,
  avoid: { daily: readonly string[]; recent: readonly string[] },
  rand: () => number = Math.random,
): Prompt[] {
  const past = new Set(Object.keys(schedule).flatMap((date) => (date < today ? schedule[date] : [])))
  const fresh = (p: Prompt) => !avoid.recent.includes(p.id)
  const pools = [
    prompts.filter((p) => past.has(p.id) && fresh(p)),
    prompts.filter((p) => past.has(p.id)),
    prompts.filter(fresh),
    prompts,
  ]
  const enough = (pool: readonly Prompt[]) => pool.filter((p) => !avoid.daily.includes(p.id)).length >= ROUNDS_PER_DIVE
  return randomPrompts(pools.find(enough) ?? prompts, avoid.daily, rand)
}

/**
 * Append days to the schedule until `until`, leaving existing days untouched.
 * A missing day up to `today` gets the seeded prompts, since that's what the
 * game served for it. Later days take the least recently used prompts, one
 * per category while there are enough categories.
 */
export function extendSchedule(schedule: Schedule, prompts: readonly Prompt[], until: string, today: string): Schedule {
  const out: Schedule = { ...schedule }
  const lastUsed = new Map<string, number>()
  const sorted = [...prompts].sort((a, b) => a.id.localeCompare(b.id))

  for (let day = 0; ; day++) {
    const dateKey = addDays(LAUNCH_DATE, day)
    if (dateKey > until && !(dateKey in schedule)) break

    if (!out[dateKey]) {
      out[dateKey] =
        dateKey <= today ? dailyPrompts(prompts, dateKey).map((p) => p.id) : leastRecentlyUsed(sorted, dateKey, lastUsed)
    }
    for (const id of out[dateKey]) lastUsed.set(id, day)
  }
  return out
}

function leastRecentlyUsed(sorted: readonly Prompt[], dateKey: string, lastUsed: Map<string, number>): string[] {
  const rand = mulberry32(hashString(`ulu:schedule:${dateKey}`))
  // A random tie-break so prompts that rested equally long come up in a varied order
  const rank = new Map(shuffle(sorted, rand).map((p, i) => [p.id, i]))
  const rested = (p: Prompt) => lastUsed.get(p.id) ?? -Infinity
  const byRest = [...sorted].sort((a, b) => rested(a) - rested(b) || rank.get(a.id)! - rank.get(b.id)!)

  const picked: Prompt[] = []
  while (picked.length < ROUNDS_PER_DIVE && picked.length < sorted.length) {
    const fresh = byRest.filter((p) => !picked.includes(p))
    const newCategory = fresh.find((p) => !picked.some((q) => q.category === p.category))
    picked.push(newCategory ?? fresh[0])
  }
  return shuffle(picked, rand).map((p) => p.id)
}

/**
 * Check the schedule against the prompts. Returns human-readable problems; empty means valid.
 *
 * Every day must list existing prompts, with no gaps, and the schedule must reach far enough ahead. The
 * repeat-gap and category checks only apply to days after `today`: earlier days have already been served and
 * the file is append-only, so they can't be fixed. If the schedule ever lapses, the seeded fallback served
 * on those days can repeat prompts early, and that mustn't keep validation red forever. Past days still
 * count as history when checking a future day's repeats.
 */
export function validateSchedule(schedule: Schedule, prompts: readonly Prompt[], today: string): string[] {
  const errors: string[] = []
  const byId = new Map(prompts.map((p) => [p.id, p]))
  const categoryCount = new Set(prompts.map((p) => p.category)).size
  const lastSeen = new Map<string, string>()
  const dates = Object.keys(schedule).sort()

  if (dates[0] !== LAUNCH_DATE) errors.push(`schedule must start on ${LAUNCH_DATE}, starts on ${dates[0]}`)

  dates.forEach((dateKey, i) => {
    if (i > 0 && daysBetween(dates[i - 1], dateKey) !== 1)
      errors.push(`schedule skips from ${dates[i - 1]} to ${dateKey}`)

    const ids = schedule[dateKey]
    if (ids.length !== ROUNDS_PER_DIVE) errors.push(`${dateKey}: has ${ids.length} prompts, needs ${ROUNDS_PER_DIVE}`)
    if (new Set(ids).size !== ids.length) errors.push(`${dateKey}: lists a prompt twice`)

    const day = ids.map((id) => byId.get(id))
    ids.forEach((id, j) => {
      if (!day[j]) errors.push(`${dateKey}: "${id}" is scheduled but no longer exists (don't delete or rename it)`)
    })
    const editable = dateKey > today
    const categories = new Set(day.filter((p) => p !== undefined).map((p) => p.category)).size
    if (editable && day.every((p) => p !== undefined) && categories < Math.min(categoryCount, ids.length))
      errors.push(`${dateKey}: only uses ${categories} categories`)

    for (const id of ids) {
      const previous = lastSeen.get(id)
      if (editable && previous && daysBetween(previous, dateKey) < MIN_REPEAT_GAP)
        errors.push(`${dateKey}: "${id}" repeats ${daysBetween(previous, dateKey)} days after ${previous}`)
      lastSeen.set(id, dateKey)
    }
  })

  const last = dates.at(-1)
  if (!last || daysBetween(today, last) < MIN_DAYS_AHEAD)
    errors.push(`schedule ends ${last ?? 'never'}, needs to reach ${addDays(today, MIN_DAYS_AHEAD)}: run npm run schedule`)

  return errors
}
