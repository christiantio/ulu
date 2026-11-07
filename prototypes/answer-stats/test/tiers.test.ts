import { describe, expect, it } from 'vitest'
import type { Tier } from '../../../src/game/types'
import { recomputeTiers, type AnswerInput } from '../src/tiers'

// The worked example from docs/adr/001-answer-stats-backend.md: 500 plays, 50 misses
const ANSWERS: AnswerInput[] = [
  { name: 'A', tier: 'common' },
  { name: 'B', tier: 'common' },
  { name: 'C', tier: 'common' },
  { name: 'T', tier: 'trap' },
  { name: 'D', tier: 'solid' },
  { name: 'E', tier: 'solid' },
  { name: 'F', tier: 'solid' },
  { name: 'R1', tier: 'rare' },
  { name: 'R2', tier: 'rare' },
  { name: 'R3', tier: 'rare' },
  { name: 'U', tier: 'ulu' },
  { name: 'G', tier: 'gem' },
]
const COUNTS = { A: 128, B: 90, C: 10, T: 40, D: 50, E: 30, F: 2, R1: 45, R2: 12, R3: 3, U: 0, G: 40 }
const EASY: Tier[] = ['common', 'trap', 'solid']

const byName = (result: ReturnType<typeof recomputeTiers>) =>
  Object.fromEntries(result.suggestions.map((s) => [s.name, s]))

describe('recomputeTiers', () => {
  it('keeps editorial tiers until a prompt has enough plays', () => {
    const result = recomputeTiers(ANSWERS, { A: 50, R1: 40 }, 99)
    expect(result.source).toBe('editorial')
    expect(result.suggestions.map((s) => s.suggested)).toEqual(ANSWERS.map((a) => a.tier))
    expect(byName(result).R1.share).toBeCloseTo(40 / 99)
  })

  it('matches the worked example in the ADR', () => {
    const result = recomputeTiers(ANSWERS, COUNTS, 500)
    expect(result.source).toBe('data')
    const s = byName(result)
    expect(Object.fromEntries(result.suggestions.map((x) => [x.name, x.suggested]))).toEqual({
      A: 'common',
      B: 'common',
      C: 'solid', // listed common, but only 2% said it
      T: 'trap',
      D: 'solid',
      E: 'solid',
      F: 'rare',
      R1: 'trap', // listed rare, picked by 9%: detected as a trap
      R2: 'rare',
      R3: 'ulu',
      U: 'ulu',
      G: 'gem',
    })
    // (45 + 100 × 0.9 × 1/40.6) / (500 + 100)
    expect(s.R1.posterior).toBeCloseTo(0.0787, 4)
    expect(s.R1.share).toBeCloseTo(0.09)
    // The gem never moves, but a popular one is flagged for a human
    expect(s.G.flags).toEqual(['gem-too-popular'])
  })

  it('pulls thin data towards the editorial prior', () => {
    // One player in 100 said the ulu answer: alone that's a 1% "rare" share, but the prior keeps it ulu
    const result = recomputeTiers(ANSWERS, { A: 60, U: 1 }, 100)
    expect(byName(result).U.share).toBe(0.01)
    expect(byName(result).U.suggested).toBe('ulu')
  })

  it('always leaves exactly one gem and at least 3 easy answers', () => {
    // Everybody says A, so data alone would leave a single easy answer
    const result = recomputeTiers(ANSWERS, { A: 4000 }, 4000)
    const tiers = result.suggestions.map((s) => s.suggested)
    expect(tiers.filter((t) => t === 'gem')).toHaveLength(1)
    expect(tiers.filter((t) => EASY.includes(t)).length).toBeGreaterThanOrEqual(3)
    const promoted = result.suggestions.filter((s) => s.flags.includes('promoted-for-easy-minimum'))
    expect(promoted.map((s) => s.name)).toEqual(['B', 'C'])
    expect(promoted.every((s) => s.suggested === 'solid')).toBe(true)
  })

  it('rejects counts that add up to more than the plays', () => {
    expect(() => recomputeTiers(ANSWERS, { A: 300, B: 300 }, 500)).toThrow(/exceed plays/)
  })
})
