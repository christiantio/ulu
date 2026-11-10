/**
 * Draft one prompt with Claude, for a person to review before it ships.
 *
 *   npm run draft -- --category world "Name a country the equator passes through"
 *   npm run draft -- --category food "Name a kueh" --no-search
 *   npm run draft -- --category world "Name a ..." --prompts     (print what would be sent; no API call)
 *
 * It runs the pipeline in scripts/generate/: compile the answers, fact-check them (with web search unless
 * --no-search), estimate what players would type, and turn that into tiers. The draft and the evidence behind
 * it land in content/drafts/<id>.json. Nothing is added to the game: check every answer and tier against
 * docs/writing-prompts.md, then move the prompt into its pack under src/content/packs/.
 *
 * Credentials come from ANTHROPIC_API_KEY or an `ant auth login` profile.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { singaporeDateKey } from '../src/game/daily'
import { CATEGORIES, scopeOf, type Category } from '../src/game/types'
import { CHECK, CHECK_SUMMARY, LIST, PANEL, PANELS } from './generate/brief'
import { claude, explain } from './generate/llm'
import { asPack, draftPrompt, summarise } from './generate/pipeline'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    category: { type: 'string', short: 'c' },
    'no-search': { type: 'boolean', default: false },
    prompts: { type: 'boolean', default: false },
  },
})
const idea = positionals.join(' ').trim()
const category = values.category as Category | undefined
if (!idea || !category || !CATEGORIES.includes(category)) {
  console.error(`Usage: npm run draft -- --category <${CATEGORIES.join('|')}> "Name a ..." [--no-search] [--prompts]`)
  process.exit(1)
}
const today = singaporeDateKey()

if (values.prompts) {
  const section = (title: string, body: string) => console.log(`\n━━ ${title} ━━\n\n${body}`)
  section('1. list (system)', LIST(scopeOf(category)))
  section('1. list (user)', `Category: ${category}\nPrompt idea: ${idea}\nToday's date: ${today}`)
  section('2. check (system; the user message is the draft list)', CHECK(today))
  section('2b. check summary (system; the user message is the draft and the report)', CHECK_SUMMARY)
  for (const panel of PANELS) section(`3. panel: ${panel.id} (system; the user message is the checked list)`, PANEL(panel.who))
  process.exit(0)
}

try {
  const draft = await draftPrompt(claude(), {
    category,
    idea,
    today,
    search: !values['no-search'],
    onStage: (stage) => console.log(`… ${stage}`),
  })

  const dir = join(import.meta.dirname, '..', 'content', 'drafts')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${draft.prompt.id}.json`)
  // A pack with the evidence alongside, so `npm run validate -- <file>` works on it as it is
  writeFileSync(file, `${JSON.stringify({ ...asPack(draft.prompt, today), review: draft.review }, null, 2)}\n`)

  console.log(`\n${summarise(draft)}\n\nDraft written to ${file}`)
  console.log('Next: check every answer, tier and decoy (docs/writing-prompts.md), then move the prompt into its pack.')
} catch (error) {
  console.error(`\nNo draft produced. ${explain(error)}`)
  process.exit(1)
}
