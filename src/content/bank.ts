/**
 * The whole question bank and the daily schedule. Only Unlimited and the fallback for an unscheduled date need
 * them, so the app loads this module lazily through loadBank() and it becomes its own chunk. Nothing in the
 * entry chunk may import it statically (npm run check:bundle fails if question data reaches the entry).
 */
import type { Schedule } from '../game/schedule'
import type { Pack, Prompt } from '../game/types'
import schedule from './schedule.json'

const modules = import.meta.glob<Pack>('./packs/*.json', { eager: true, import: 'default' })

export const PACKS: Pack[] = Object.values(modules)

export const ALL_PROMPTS: Prompt[] = PACKS.flatMap((pack) => pack.prompts)

export const SCHEDULE: Schedule = schedule

const byId = new Map(ALL_PROMPTS.map((p) => [p.id, p]))

export function promptById(id: string): Prompt | undefined {
  return byId.get(id)
}
