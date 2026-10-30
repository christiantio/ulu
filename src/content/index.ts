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
