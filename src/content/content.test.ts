import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addDays, dailyPrompts, singaporeDateKey } from '../game/daily'
import { extendSchedule, promptsForDate, validateSchedule, type Schedule } from '../game/schedule'
import type { Pack } from '../game/types'
import { validatePacks } from '../game/validate'

const dir = join(import.meta.dirname, 'packs')
const packs: Record<string, Pack> = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]),
)
const schedule: Schedule = JSON.parse(readFileSync(join(import.meta.dirname, 'schedule.json'), 'utf8'))

describe('content packs', () => {
  it('pass validation', () => {
    expect(validatePacks(packs)).toEqual([])
  })

  it('give a full dive every day for the next year', () => {
    const prompts = Object.values(packs).flatMap((p) => p.prompts)
    if (prompts.length < 7) return
    for (let d = 0; d < 365; d++) {
      const date = new Date(Date.UTC(2026, 9, 27 + d)).toISOString().slice(0, 10)
      expect(dailyPrompts(prompts, date)).toHaveLength(7)
    }
  })

  it('have a valid schedule that reaches two weeks ahead (run npm run schedule if not)', () => {
    const prompts = Object.values(packs).flatMap((p) => p.prompts)
    expect(validateSchedule(schedule, prompts, singaporeDateKey())).toEqual([])
  })

  it('recover if the schedule lapses and is backfilled late', () => {
    const prompts = Object.values(packs).flatMap((p) => p.prompts)
    const later = addDays(Object.keys(schedule).sort().at(-1)!, 6)
    const lapsed = extendSchedule(schedule, prompts, addDays(later, 30), later)
    expect(validateSchedule(lapsed, prompts, later)).toEqual([])
  })

  it('serve the scheduled prompts', () => {
    const prompts = Object.values(packs).flatMap((p) => p.prompts)
    for (const [date, ids] of Object.entries(schedule)) {
      expect(promptsForDate(prompts, date, schedule).map((p) => p.id)).toEqual(ids)
    }
  })
})
