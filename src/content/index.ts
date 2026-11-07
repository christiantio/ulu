import { promptsForDate } from '../game/schedule'
import { ROUNDS_PER_DIVE } from '../game/scoring'
import type { DiveFile, Prompt } from '../game/types'
import { loadBank } from './bank-loader'

export { loadBank, type Bank } from './bank-loader'

/** A day's dive file, emitted at build time and served in dev by scripts/dives.ts */
export const diveUrl = (dateKey: string) => `${import.meta.env.BASE_URL}dives/${dateKey}.json`

function isDiveFile(data: unknown, dateKey: string): data is DiveFile {
  const file = data as Partial<DiveFile> | null
  return (
    file?.date === dateKey &&
    Array.isArray(file.prompts) &&
    file.prompts.length === ROUNDS_PER_DIVE &&
    file.prompts.every((p) => typeof p?.id === 'string' && Array.isArray(p.answers))
  )
}

/**
 * A day's prompts, from its dive file. A date with no file (one the schedule doesn't have) loads the bank and
 * gets the seeded fallback. A failed request (offline, a server error) rejects, so the caller can offer a retry
 * instead of downloading the whole bank.
 */
export async function loadDive(dateKey: string): Promise<Prompt[]> {
  const res = await fetch(diveUrl(dateKey))
  if (res.ok) {
    // A host that answers unknown paths with index.html sends a 200 that isn't a dive file: treat it as missing
    const data: unknown = await res.json().catch(() => null)
    if (isDiveFile(data, dateKey)) return data.prompts
  } else if (res.status !== 404) {
    throw new Error(`Couldn't load ${diveUrl(dateKey)}: HTTP ${res.status}`)
  }
  const bank = await loadBank()
  return promptsForDate(bank.ALL_PROMPTS, dateKey, bank.SCHEDULE)
}
