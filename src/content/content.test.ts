import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dailyPrompts } from '../game/daily'
import type { Pack } from '../game/types'
import { validatePacks } from '../game/validate'

const dir = join(import.meta.dirname, 'packs')
const packs: Record<string, Pack> = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]),
)

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
})
