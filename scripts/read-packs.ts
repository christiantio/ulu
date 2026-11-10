/** Reading pack files from disk, shared by the content scripts */
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Pack } from '../src/game/types'

export const CONTENT_DIR = join(import.meta.dirname, '..', 'src', 'content')
const PACK_DIR = join(CONTENT_DIR, 'packs')

/** Every pack in the bank, as file paths */
export function bankFiles(): string[] {
  return readdirSync(PACK_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(PACK_DIR, f))
}

/** The packs in these files, keyed by file name. Prints the problem and exits if one isn't valid JSON */
export function readPacks(files: string[]): Record<string, Pack> {
  const packs: Record<string, Pack> = {}
  for (const file of files) {
    try {
      packs[basename(file)] = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      console.error(`✗ ${basename(file)}: could not parse JSON (${(err as Error).message})`)
      process.exit(1)
    }
  }
  return packs
}
