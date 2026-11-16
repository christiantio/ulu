/**
 * Extend the frozen daily schedule: `npm run schedule -- --days 30`
 * Appends days until the schedule reaches that many days past today (Singapore
 * time). Days already in the file never change.
 *
 * `npm run schedule -- --replan-from 2026-12-01` plans every day from that date
 * on again with the current bank and mix, for a change that should reach players
 * before the days already scheduled run out. Only days after today can be
 * planned again: run it just before deploying, from the first day the deploy
 * will serve.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, singaporeDateKey } from '../src/game/daily'
import { extendSchedule, replanSchedule, validateSchedule, type Schedule } from '../src/game/schedule'
import type { Pack } from '../src/game/types'

const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content')
const SCHEDULE_FILE = join(CONTENT_DIR, 'schedule.json')

const arg = (name: string) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}
const days = Number(arg('--days') ?? 30)
const replanFrom = arg('--replan-from')
const today = singaporeDateKey()
if (!Number.isInteger(days) || days < 0 || (replanFrom !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(replanFrom))) {
  console.error('Usage: npm run schedule -- [--days <number of days past today>] [--replan-from <YYYY-MM-DD>]')
  process.exit(1)
}
if (replanFrom !== undefined && replanFrom <= today) {
  console.error(`✗ Only days after today (${today}) can be planned again: today's dive may already be underway`)
  process.exit(1)
}

const prompts = readdirSync(join(CONTENT_DIR, 'packs'))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(join(CONTENT_DIR, 'packs', f), 'utf8')) as Pack).prompts)

const before: Schedule = existsSync(SCHEDULE_FILE) ? JSON.parse(readFileSync(SCHEDULE_FILE, 'utf8')) : {}
const until = addDays(today, days)
const after = replanFrom
  ? replanSchedule(before, prompts, replanFrom, until, today)
  : extendSchedule(before, prompts, until, today)

// Check before writing, so a bad schedule never lands in the file (which is append-only once committed)
const errors = validateSchedule(after, prompts, today)
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  console.error(`\n${errors.length} problem(s); schedule.json was not changed`)
  process.exit(1)
}

// One line per day keeps diffs readable
const lines = Object.keys(after)
  .sort()
  .map((date) => `  ${JSON.stringify(date)}: ${JSON.stringify(after[date])}`)
writeFileSync(SCHEDULE_FILE, `{\n${lines.join(',\n')}\n}\n`)

const last = Object.keys(after).sort().at(-1)
if (replanFrom) {
  const changed = Object.keys(after).filter((date) => date >= replanFrom && before[date]?.join() !== after[date].join())
  console.log(`✓ Planned the days from ${replanFrom} again (${changed.length} changed); the schedule now runs to ${last}`)
} else {
  console.log(`✓ Added ${Object.keys(after).length - Object.keys(before).length} day(s); the schedule now runs to ${last}`)
}
