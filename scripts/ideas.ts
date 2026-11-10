/**
 * Ask Claude for prompt ideas, for the team to choose from.
 *
 *   npm run ideas -- --scope world
 *   npm run ideas -- --scope world --category science --count 10 --theme "things with a Singapore decoy"
 *   npm run ideas -- --scope sg --prompts          (print what would be sent; no API call)
 *
 * It only proposes. Ideas the model itself rates as too niche are dropped and listed separately. The rest land
 * in content/ideas/<date>-<scope>.json, each with the `npm run draft` command that develops it.
 *
 * Credentials come from ANTHROPIC_API_KEY or an `ant auth login` profile.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { singaporeDateKey } from '../src/game/daily'
import { CATEGORIES, scopeOf, type Category, type Pack, type Scope } from '../src/game/types'
import { IDEAS } from './generate/brief'
import { claude, explain } from './generate/llm'
import { MIN_ACCESSIBILITY, ideasRequest, proposeIdeas } from './generate/pipeline'

const { values } = parseArgs({
  options: {
    scope: { type: 'string', short: 's' },
    category: { type: 'string', short: 'c' },
    count: { type: 'string', default: '15' },
    theme: { type: 'string' },
    prompts: { type: 'boolean', default: false },
  },
})
const scope = values.scope as Scope | undefined
const count = Number(values.count)
const only = values.category as Category | undefined
const categories = CATEGORIES.filter((c) => scopeOf(c) === scope && (!only || c === only))
if ((scope !== 'sg' && scope !== 'world') || !Number.isInteger(count) || count < 1 || categories.length === 0) {
  console.error('Usage: npm run ideas -- --scope <sg|world> [--category <category in that scope>] [--count 15] [--theme "..."] [--prompts]')
  process.exit(1)
}

const packDir = join(import.meta.dirname, '..', 'src', 'content', 'packs')
const existing = readdirSync(packDir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(join(packDir, f), 'utf8')) as Pack).prompts.map((p) => p.text))
const request = { scope, categories, count, theme: values.theme, existing }

if (values.prompts) {
  console.log(`━━ ideas (system) ━━\n\n${IDEAS(scope)}\n\n━━ ideas (user) ━━\n\n${ideasRequest(request)}`)
  process.exit(0)
}

try {
  console.log(`… asking for ${count} ${scope} ideas in ${categories.join(', ')}`)
  const { kept, dropped } = await proposeIdeas(claude(), request)

  for (const idea of kept) {
    console.log(`\n${idea.text}  [${idea.category}, ${idea.setType}, about ${idea.size} answers, ${idea.accessibility}/100 can answer]`)
    console.log(`  Easy: ${idea.easyAnswers.join(', ')}`)
    console.log(`  Deep: ${idea.deepCuts.join(', ')}   Gem: ${idea.gem}`)
    if (idea.twist) console.log(`  Twist: ${idea.twist}`)
    if (idea.risks) console.log(`  Risks: ${idea.risks}`)
    console.log(`  npm run draft -- --category ${idea.category} ${JSON.stringify(idea.text)}`)
  }
  if (dropped.length) {
    console.log(`\nDropped as too niche (under ${MIN_ACCESSIBILITY}/100):`)
    for (const idea of dropped) console.log(`  ${idea.accessibility}/100  ${idea.text}`)
  }

  const dir = join(import.meta.dirname, '..', 'content', 'ideas')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${singaporeDateKey()}-${scope}.json`)
  writeFileSync(file, `${JSON.stringify({ kept, dropped }, null, 2)}\n`)
  console.log(`\n${kept.length} idea(s) written to ${file}`)
} catch (error) {
  console.error(`\nNo ideas produced. ${explain(error)}`)
  process.exit(1)
}
