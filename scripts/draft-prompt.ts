/**
 * Draft a new prompt with Claude, for a human to review before it ships.
 *
 *   npm run draft -- --category food "Name a kueh"
 *
 * Writes content/drafts/<id>.json and runs the validator over it. Nothing is
 * added to the game automatically: check every answer and tier, then move the
 * prompt into the matching pack under src/content/packs/.
 *
 * Credentials come from ANTHROPIC_API_KEY or an `ant auth login` profile.
 * This script is offline tooling only; the game itself never calls the API.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { CATEGORIES, TIERS, type Pack } from '../src/game/types'
import { validatePacks } from '../src/game/validate'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { category: { type: 'string', short: 'c' } },
})
const idea = positionals.join(' ').trim()
const category = values.category as (typeof CATEGORIES)[number] | undefined
if (!idea || !category || !CATEGORIES.includes(category)) {
  console.error(`Usage: npm run draft -- --category <${CATEGORIES.join('|')}> "Name a ..."`)
  process.exit(1)
}

const DraftSchema = z.object({
  id: z.string().describe('kebab-case id as <category>-<topic>, e.g. "transport-ccl-stations"'),
  text: z.string().describe('The prompt shown to players'),
  note: z.string().optional().describe('Optional rule clarification, e.g. "As of October 2026"'),
  answers: z.array(
    z.object({
      name: z.string(),
      aliases: z.array(z.string()).optional(),
      tier: z.enum(TIERS),
    }),
  ),
  reviewerNotes: z.string().describe('Anything a human reviewer should double-check'),
})

const SYSTEM = `You write content for Ulu, a Singapore trivia game. Players see a prompt and type one answer;
valid answers score by how obscure they are to a typical Singapore resident.

Tiers: common (the 1-4 answers everyone says first), trap (an "I'm so clever" pick lots of people
actually reach for; 0-2 of these), solid (well known), rare (known but rarely said first), ulu (true deep
cut), gem (exactly one: a real, verifiable deep cut with a fun factor).

Rules:
- List every valid answer for closed sets; be generous for open sets (unrecognised answers score 0).
- Aliases: local spellings, abbreviations Singaporeans use, Malay/Chinese/Tamil names in common use.
  Matching already ignores case, punctuation and spacing, and forgives small typos.
- Only include answers you are confident are correct. Flag anything time-sensitive in reviewerNotes.`

const client = new Anthropic()

const response = await client.beta.messages.parse({
  model: 'claude-opus-5-5',
  max_tokens: 16000,
  output_config: { effort: 'high', format: betaZodOutputFormat(DraftSchema) },
  // Route to another model if this one declines, rather than failing the draft
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
  system: SYSTEM,
  messages: [{ role: 'user', content: `Category: ${category}\nPrompt idea: ${idea}` }],
})

if (response.stop_reason === 'refusal' || !response.parsed_output) {
  console.error(`No draft produced (stop_reason: ${response.stop_reason})`)
  process.exit(1)
}

const { reviewerNotes, ...draft } = response.parsed_output
const prompt = { ...draft, category }
const pack: Pack = { name: 'Draft', asOf: new Date().toISOString().slice(0, 10), prompts: [prompt] }

const dir = join(import.meta.dirname, '..', 'content', 'drafts')
mkdirSync(dir, { recursive: true })
const file = join(dir, `${prompt.id}.json`)
writeFileSync(file, `${JSON.stringify({ ...pack, reviewerNotes }, null, 2)}\n`)

console.log(`Draft written to ${file}`)
console.log(`${prompt.answers.length} answers; gem: ${prompt.answers.find((a) => a.tier === 'gem')?.name ?? 'none'}`)
if (reviewerNotes) console.log(`\nReviewer notes:\n${reviewerNotes}`)

const errors = validatePacks({ [`${prompt.id}.json`]: pack })
if (errors.length) {
  console.log('\nFix before publishing:')
  for (const e of errors) console.log(`  ✗ ${e}`)
}
