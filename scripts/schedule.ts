/**
 * Extend the frozen daily schedule: `npm run schedule -- --days 30`
 * Appends days until the schedule reaches that many days past today (Singapore
 * time). Days already in the file never change.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays, singaporeDateKey } from '../src/game/daily'
import { extendSchedule, validateSchedule, type Schedule } from '../src/game/schedule'
import type { Pack } from '../src/game/types'

const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content')
const SCHEDULE_FILE = join(CONTENT_DIR, 'schedule.json')

const daysArg = process.argv.indexOf('--days')
const days = daysArg === -1 ? 30 : Number(process.argv[daysArg + 1])
if (!Number.isInteger(days) || days < 0) {
  console.error('Usage: npm run schedule -- --days <number of days past today>')
  process.exit(1)
}

const prompts = readdirSync(join(CONTENT_DIR, 'packs'))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(join(CONTENT_DIR, 'packs', f), 'utf8')) as Pack).prompts)

const today = singaporeDateKey()
const before: Schedule = existsSync(SCHEDULE_FILE) ? JSON.parse(readFileSync(SCHEDULE_FILE, 'utf8')) : {}
const after = extendSchedule(before, prompts, addDays(today, days), today)

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

const added = Object.keys(after).length - Object.keys(before).length
console.log(`✓ Added ${added} day(s); the schedule now runs to ${Object.keys(after).sort().at(-1)}`)
