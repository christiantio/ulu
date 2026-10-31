/**
 * Check the production build: `npm run build && npm run check:bundle` (pass another dist directory to check it)
 *
 * - The entry JS (the module script in index.html plus anything it preloads) stays under a size budget.
 * - The entry has no question data: no prompt id, prompt text or gem name from any pack. The bank belongs in its
 *   own lazily loaded chunk and today's prompts in dives/<date>.json.
 * - Every scheduled date has its dive file, with that day's prompts in schedule order.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { gzipSync } from 'node:zlib'
import { singaporeDateKey } from '../src/game/daily'
import type { DiveFile } from '../src/game/types'
import { diveFileName, readContent } from './dives'

/** Raise these deliberately, in the PR that needs it, and say why */
export const ENTRY_BUDGET = { raw: 300_000, gzip: 95_000 }

const root = join(import.meta.dirname, '..')
const dist = process.argv[2] ?? join(root, 'dist')
const errors: string[] = []
const kB = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`
const sizes = (buf: Buffer) => ({ raw: buf.length, gzip: gzipSync(buf).length })

// The entry: the module script and the chunks index.html tells the browser to preload with it
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const entryFiles = [
  ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((m) => join(dist, m[1].replace(/^(\.?\/)+/, '').replace(/^.*?(?=assets\/)/, '')))
if (entryFiles.length === 0) errors.push('index.html has no module script')
const entry = Buffer.concat(entryFiles.map((f) => readFileSync(f)))
const entrySize = sizes(entry)

if (entrySize.raw > ENTRY_BUDGET.raw)
  errors.push(`entry JS is ${kB(entrySize.raw)}, over the ${kB(ENTRY_BUDGET.raw)} budget`)
if (entrySize.gzip > ENTRY_BUDGET.gzip)
  errors.push(`entry JS is ${kB(entrySize.gzip)} gzipped, over the ${kB(ENTRY_BUDGET.gzip)} budget`)

// Question data in the entry. Strings that the app's own code also uses (a gem that's also a route destination,
// say) can't tell anything, so they're skipped and listed
const { prompts, schedule } = readContent(join(root, 'src', 'content'))
const appSource = sourceFiles(join(root, 'src'))
  .filter((f) => !f.includes(`${join('src', 'content')}`) && !/\.test\.tsx?$/.test(f))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')
const markers = prompts.flatMap((p) => [p.id, p.text, ...p.answers.filter((a) => a.tier === 'gem').map((a) => a.name)])
const skipped = markers.filter((m) => appSource.includes(m))
const entryText = entry.toString('utf8')
const leaked = markers.filter((m) => !skipped.includes(m) && entryText.includes(m))
if (leaked.length > 0)
  errors.push(
    `entry JS contains question data (${leaked.length} prompt ids, texts or gems), e.g. ${leaked
      .slice(0, 5)
      .map((m) => JSON.stringify(m))
      .join(', ')}. Load it from src/content/bank.ts through loadBank() instead`,
  )

// One dive file per scheduled date
const today = singaporeDateKey()
let largest = { date: '', raw: 0, gzip: 0 }
let todays: { raw: number; gzip: number } | null = null
for (const [date, ids] of Object.entries(schedule)) {
  const file = join(dist, diveFileName(date))
  if (!existsSync(file)) {
    errors.push(`${relative(dist, file)} is missing`)
    continue
  }
  const buf = readFileSync(file)
  const dive = JSON.parse(buf.toString('utf8')) as DiveFile
  if (dive.date !== date || dive.prompts.map((p) => p.id).join() !== ids.join())
    errors.push(`${relative(dist, file)} doesn't match the schedule`)
  const size = sizes(buf)
  if (size.raw > largest.raw) largest = { date, ...size }
  if (date === today) todays = size
}

const show = (size: { raw: number; gzip: number }) => `${kB(size.raw)} raw, ${kB(size.gzip)} gzipped`
console.log(`Entry JS (${entryFiles.map((f) => relative(dist, f)).join(', ')}):`)
console.log(`  ${show(entrySize)} (budget ${show(ENTRY_BUDGET)})`)
console.log(`  checked for ${markers.length - skipped.length} prompt ids, texts and gem names`)
if (skipped.length) {
  console.log(`  skipped, as the app's own code uses them: ${skipped.map((m) => JSON.stringify(m)).join(', ')}`)
}
if (todays) console.log(`Today's dive file (${diveFileName(today)}): ${show(todays)}`)
if (largest.date) console.log(`Largest dive file (${diveFileName(largest.date)}): ${show(largest)}`)

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  process.exit(1)
}
const days = Object.keys(schedule).length
console.log(`✓ The entry is within budget with no question data, and all ${days} dive files are there`)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const path = join(dir, d.name)
    if (d.isDirectory()) return sourceFiles(path)
    return ['.ts', '.tsx'].includes(extname(d.name)) ? [path] : []
  })
}
