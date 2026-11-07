// THROWAWAY PROTOTYPE (issue #17). Not production code.
//
// The Worker bundles the same packs and schedule as the app, so it can check that a prompt was really served
// on a date and that a submitted answer belongs to it. A content fix needs a Worker redeploy too (see the ADR).

import type { Pack, Prompt } from '../../../src/game/types'
import schedule from '../../../src/content/schedule.json'
import culture from '../../../src/content/packs/culture.json'
import food from '../../../src/content/packs/food.json'
import history from '../../../src/content/packs/history.json'
import language from '../../../src/content/packs/language.json'
import nature from '../../../src/content/packs/nature.json'
import places from '../../../src/content/packs/places.json'
import politics from '../../../src/content/packs/politics.json'
import transport from '../../../src/content/packs/transport.json'

const PACKS = [culture, food, history, language, nature, places, politics, transport] as Pack[]
const SCHEDULE: Record<string, string[]> = schedule
const BY_ID = new Map(PACKS.flatMap((pack) => pack.prompts).map((p) => [p.id, p]))

/** The prompt with this id, if it's scheduled on that Singapore date */
export function scheduledPrompt(date: string, id: string): Prompt | undefined {
  return SCHEDULE[date]?.includes(id) ? BY_ID.get(id) : undefined
}

export function scheduledIds(date: string): string[] {
  return SCHEDULE[date] ?? []
}

export function promptById(id: string): Prompt | undefined {
  return BY_ID.get(id)
}
