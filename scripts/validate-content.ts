/**
 * Validate every content pack: `npm run validate`
 * Checks the daily schedule too, unless you pass file paths to check only those packs.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { singaporeDateKey } from '../src/game/daily'
import { validateSchedule, type Schedule } from '../src/game/schedule'
import { validatePacks } from '../src/game/validate'
import type { Pack } from '../src/game/types'

const PACK_DIR = join(import.meta.dirname, '..', 'src', 'content', 'packs')
const SCHEDULE_FILE = join(import.meta.dirname, '..', 'src', 'content', 'schedule.json')

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(PACK_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(PACK_DIR, f))

const packs: Record<string, Pack> = {}
for (const file of files) {
  try {
    packs[basename(file)] = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    console.error(`✗ ${basename(file)}: could not parse JSON (${(err as Error).message})`)
    process.exit(1)
  }
}

const errors = validatePacks(packs)
// The schedule refers to every pack, so only check it against the full bank
if (!process.argv.slice(2).length) {
  const schedule: Schedule = JSON.parse(readFileSync(SCHEDULE_FILE, 'utf8'))
  const prompts = Object.values(packs).flatMap((p) => p.prompts ?? [])
  errors.push(...validateSchedule(schedule, prompts, singaporeDateKey()).map((e) => `schedule.json: ${e}`))
}
const promptCount = Object.values(packs).reduce((n, p) => n + (p.prompts?.length ?? 0), 0)

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  console.error(`\n${errors.length} problem(s) in ${files.length} pack(s)`)
  process.exit(1)
}
console.log(`✓ ${promptCount} prompts in ${files.length} pack(s) are valid`)
