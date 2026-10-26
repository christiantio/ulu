/**
 * Validate every content pack: `npm run validate`
 * Optionally pass file paths to check only those packs.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { validatePacks } from '../src/game/validate'
import type { Pack } from '../src/game/types'

const PACK_DIR = join(import.meta.dirname, '..', 'src', 'content', 'packs')

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
const promptCount = Object.values(packs).reduce((n, p) => n + (p.prompts?.length ?? 0), 0)

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  console.error(`\n${errors.length} problem(s) in ${files.length} pack(s)`)
  process.exit(1)
}
console.log(`✓ ${promptCount} prompts in ${files.length} pack(s) are valid`)
