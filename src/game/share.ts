import { liftAfter } from './elevator'
import { MAX_SCORE, MISS_EMOJI, TIER_INFO } from './scoring'
import type { RoundResult } from './types'

export function totalScore(results: readonly RoundResult[]): number {
  return results.reduce((sum, r) => sum + r.points, 0)
}

/** Plain-text result for pasting into chats; never reveals the answers */
export function shareText(results: readonly RoundResult[], title: string, url: string): string {
  const { score, floor, stage } = liftAfter(results)
  const grid = results.map((r) => (r.tier ? TIER_INFO[r.tier].emoji : MISS_EMOJI)).join('')
  return [`${title} 🇸🇬 ${score}/${MAX_SCORE}`, grid, `Floor ${floor} · ${stage.name}`, url].join('\n')
}
