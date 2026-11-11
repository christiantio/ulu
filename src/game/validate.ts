import { matchProblems } from './match'
import { normalize } from './normalize'
import { CATEGORIES, TIERS, type Pack, type Tier } from './types'

export const MIN_ANSWERS = 12
/** Players need several easy ways in, otherwise the prompt is just frustrating */
export const MIN_EASY_ANSWERS = 3
const EASY_TIERS: Tier[] = ['common', 'trap', 'solid']

/**
 * Check packs against the content rules. Returns a list of human-readable
 * problems; an empty list means everything is valid.
 */
export function validatePacks(packs: Record<string, Pack>): string[] {
  const errors: string[] = []
  const seenIds = new Map<string, string>()

  for (const [file, pack] of Object.entries(packs)) {
    if (!pack.name) errors.push(`${file}: pack is missing "name"`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.asOf ?? ''))
      errors.push(`${file}: pack "asOf" must be an ISO date (YYYY-MM-DD)`)
    if (!Array.isArray(pack.prompts) || pack.prompts.length === 0) {
      errors.push(`${file}: pack has no prompts`)
      continue
    }

    for (const prompt of pack.prompts) {
      const where = `${file} › ${prompt.id || '(no id)'}`

      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(prompt.id ?? ''))
        errors.push(`${where}: id must be kebab-case`)
      const dupe = seenIds.get(prompt.id)
      if (dupe) errors.push(`${where}: id already used in ${dupe}`)
      seenIds.set(prompt.id, file)

      if (!CATEGORIES.includes(prompt.category))
        errors.push(`${where}: unknown category "${prompt.category}"`)
      if (!prompt.text?.trim()) errors.push(`${where}: missing text`)
      if (!Array.isArray(prompt.answers)) {
        errors.push(`${where}: missing answers`)
        continue
      }

      if (prompt.answers.length < MIN_ANSWERS)
        errors.push(`${where}: only ${prompt.answers.length} answers (min ${MIN_ANSWERS})`)

      const gems = prompt.answers.filter((a) => a.tier === 'gem')
      if (gems.length !== 1) errors.push(`${where}: needs exactly 1 gem, found ${gems.length}`)

      const easy = prompt.answers.filter((a) => EASY_TIERS.includes(a.tier)).length
      if (easy < MIN_EASY_ANSWERS)
        errors.push(`${where}: only ${easy} common/trap/solid answers (min ${MIN_EASY_ANSWERS})`)

      // Every name and alias must normalize to a key owned by exactly one answer
      const owners = new Map<string, string>()
      for (const answer of prompt.answers) {
        if (!answer.name?.trim()) errors.push(`${where}: answer with empty name`)
        if (!TIERS.includes(answer.tier))
          errors.push(`${where} › ${answer.name}: unknown tier "${answer.tier}"`)

        for (const label of [answer.name, ...(answer.aliases ?? [])]) {
          const key = normalize(label ?? '')
          if (!key) {
            errors.push(`${where} › ${answer.name}: "${label}" normalizes to nothing`)
            continue
          }
          const owner = owners.get(key)
          if (owner && owner !== answer.name)
            errors.push(`${where}: "${label}" (${answer.name}) collides with ${owner}`)
          owners.set(key, answer.name)
        }
      }

      const fillerOk =
        prompt.filler === undefined ||
        (Array.isArray(prompt.filler) && prompt.filler.every((f) => typeof f === 'string' && normalize(f)))
      if (!fillerOk) errors.push(`${where}: "filler" must be a list of words`)
      if (prompt.partial !== undefined && typeof prompt.partial !== 'boolean')
        errors.push(`${where}: "partial" must be true or false`)

      const decoys = prompt.decoys ?? []
      if (!Array.isArray(decoys)) {
        errors.push(`${where}: "decoys" must be a list`)
        continue
      }
      for (const decoy of decoys) {
        if (!decoy.name?.trim()) errors.push(`${where}: decoy with empty name`)
        if (!decoy.why?.trim()) errors.push(`${where} › ${decoy.name}: decoy needs a "why" to show the player`)
        for (const label of [decoy.name, ...(decoy.aliases ?? [])]) {
          if (!normalize(label ?? '')) errors.push(`${where} › ${decoy.name}: "${label}" normalizes to nothing`)
        }
      }
      // Answers that only differ in ways matching ignores, and decoys that would match an answer
      if (fillerOk && prompt.answers.every((a) => a.name?.trim()) && decoys.every((d) => d.name?.trim()))
        errors.push(...matchProblems(prompt).errors.map((e) => `${where}: ${e}`))
    }
  }

  return errors
}
