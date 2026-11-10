/**
 * List the prompts whose facts are due a re-check: `npm run review:due`
 *
 * Prints a Markdown checklist of prompts whose `reviewBy` date has passed or falls within the next 31 days
 * (`-- --within <days>` to change that), and nothing at all when there are none. Pass pack files to check those
 * instead of the bank. The monthly reminder workflow (.github/workflows/review-reminder.yml) puts the output in
 * an issue.
 */
import { addDays, singaporeDateKey } from '../src/game/daily'
import { reviewsDue } from '../src/game/validate'
import { bankFiles, readPacks } from './read-packs'

const args = process.argv.slice(2)
const withinArg = args.indexOf('--within')
const within = withinArg === -1 ? 31 : Number(args[withinArg + 1])
if (!Number.isInteger(within) || within < 0) {
  console.error('--within needs a whole number of days, 0 or more')
  process.exit(1)
}

const given = args.filter((_, i) => withinArg === -1 || (i !== withinArg && i !== withinArg + 1))
const today = singaporeDateKey()
const due = reviewsDue(readPacks(given.length ? given : bankFiles()), today, within)

if (due.length) {
  const lines = [
    `These prompts are overdue for a fact review, or fall due by ${addDays(today, within)} (listed on ${today}).`,
    '',
    'For each one: open its sources, check the answer list and the note against them, fix anything that has',
    'changed in a content PR, and set the next `reviewBy`. Close this issue when they are all done. See',
    '[CONTRIBUTING.md](../blob/main/CONTRIBUTING.md#fact-reviews).',
    '',
  ]
  for (const { file, promptId, reviewBy, overdue, sources } of due) {
    const status = overdue ? `**overdue**, was due ${reviewBy}` : reviewBy === today ? '**due today**' : `due ${reviewBy}`
    lines.push(`- [ ] \`${promptId}\` (\`${file}\`): ${status}`)
    if (sources.length) for (const source of sources) lines.push(`  - ${source}`)
    else lines.push('  - No sources recorded. Add them when you review it.')
  }
  console.log(lines.join('\n'))
}
