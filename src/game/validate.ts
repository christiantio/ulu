import { addDays } from './daily'
import { normalize } from './normalize'
import { CATEGORIES, TIERS, type Pack, type Tier } from './types'

export const MIN_ANSWERS = 12
/** Players need several easy ways in, otherwise the prompt is just frustrating */
export const MIN_EASY_ANSWERS = 3
const EASY_TIERS: Tier[] = ['common', 'trap', 'solid']

/** A real calendar date written YYYY-MM-DD: 2026-02-30 is not one */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !/^https?:\/\/\S+$/.test(value)) return false
  return URL.canParse(value)
}

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

      if (prompt.sources !== undefined) {
        if (!Array.isArray(prompt.sources) || prompt.sources.length === 0)
          errors.push(`${where}: "sources" must be a list of at least one URL`)
        else
          for (const source of prompt.sources)
            if (!isHttpUrl(source)) errors.push(`${where}: source "${source}" must be an absolute http(s) URL`)
      }
      if (prompt.reviewBy !== undefined && !isIsoDate(prompt.reviewBy))
        errors.push(`${where}: "reviewBy" must be a real date (YYYY-MM-DD), found "${prompt.reviewBy}"`)

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
    }
  }

  return errors
}

/** A prompt whose answer list needs checking against its sources, now or soon */
export interface ReviewDue {
  file: string
  promptId: string
  reviewBy: string
  /** The review date is before today */
  overdue: boolean
  sources: string[]
}

/**
 * Prompts whose review date is on or before `today`, or within `withinDays` days after it, earliest first.
 * `today` is a Singapore date key. A malformed review date is left to validatePacks
 */
export function reviewsDue(packs: Record<string, Pack>, today: string, withinDays = 0): ReviewDue[] {
  const until = addDays(today, withinDays)
  const due: ReviewDue[] = []
  for (const [file, pack] of Object.entries(packs)) {
    for (const prompt of pack.prompts ?? []) {
      if (!isIsoDate(prompt.reviewBy) || prompt.reviewBy > until) continue
      due.push({
        file,
        promptId: prompt.id,
        reviewBy: prompt.reviewBy,
        overdue: prompt.reviewBy < today,
        sources: Array.isArray(prompt.sources) ? prompt.sources : [],
      })
    }
  }
  return due.sort((a, b) => a.reviewBy.localeCompare(b.reviewBy) || a.promptId.localeCompare(b.promptId))
}

/**
 * Things about the packs that need attention but aren't wrong: a review date that has arrived, and a note that
 * says "as of" on a prompt with no review date. Unlike validatePacks, the answer depends on today's date, so
 * these never fail a build
 */
export function reviewWarnings(packs: Record<string, Pack>, today: string): string[] {
  const warnings = reviewsDue(packs, today).map(({ file, promptId, reviewBy, overdue }) =>
    overdue
      ? `${file} › ${promptId}: was due for review on ${reviewBy}`
      : `${file} › ${promptId}: is due for review today (${reviewBy})`,
  )
  for (const [file, pack] of Object.entries(packs)) {
    for (const prompt of pack.prompts ?? []) {
      if (prompt.reviewBy === undefined && /\bas of\b/i.test(prompt.note ?? ''))
        warnings.push(`${file} › ${prompt.id}: the note says "as of" but the prompt has no reviewBy date`)
    }
  }
  return warnings
}
