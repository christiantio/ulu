/**
 * Validate every content pack: `npm run validate`
 * Checks the daily schedule too, unless you pass file paths to check only those packs.
 *
 * Errors (✗) fail the run. Warnings (⚠) don't: they flag prompts whose facts are due a re-check.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { singaporeDateKey } from '../src/game/daily'
import { validateSchedule, type Schedule } from '../src/game/schedule'
import { reviewWarnings, validatePacks } from '../src/game/validate'
import { bankFiles, CONTENT_DIR, readPacks } from './read-packs'

const given = process.argv.slice(2)
const files = given.length ? given : bankFiles()
const packs = readPacks(files)
const today = singaporeDateKey()

const errors = validatePacks(packs)
// The schedule refers to every pack, so only check it against the full bank
if (!given.length) {
  const schedule: Schedule = JSON.parse(readFileSync(join(CONTENT_DIR, 'schedule.json'), 'utf8'))
  const prompts = Object.values(packs).flatMap((p) => p.prompts ?? [])
  errors.push(...validateSchedule(schedule, prompts, today).map((e) => `schedule.json: ${e}`))
}
const warnings = reviewWarnings(packs, today)
const promptCount = Object.values(packs).reduce((n, p) => n + (p.prompts?.length ?? 0), 0)
const warningCount = `${warnings.length} warning(s)`

for (const w of warnings) {
  console.warn(`⚠ ${w}`)
  // In GitHub Actions, a workflow command puts the warning in the run's annotations as well as its log
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Prompt review::${w}`)
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  console.error(`\n${errors.length} problem(s) and ${warningCount} in ${files.length} pack(s)`)
  process.exit(1)
}
if (warnings.length) console.log('')
console.log(
  `✓ ${promptCount} prompts in ${files.length} pack(s) are valid` + (warnings.length ? `, with ${warningCount}` : ''),
)
