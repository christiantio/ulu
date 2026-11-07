import { MAX_SCORE, MISS_EMOJI, TIER_INFO, destinationFor } from './scoring'
import type { RoundResult } from './types'

export function totalScore(results: readonly RoundResult[]): number {
  return results.reduce((sum, r) => sum + r.points, 0)
}

/** Plain-text result for pasting into chats; never reveals the answers */
export function shareText(results: readonly RoundResult[], title: string, url: string): string {
  const score = totalScore(results)
  const grid = results.map((r) => (r.tier ? TIER_INFO[r.tier].emoji : MISS_EMOJI)).join('')
  return [`${title} 🇸🇬 ${score}/${MAX_SCORE}`, grid, `Reached ${destinationFor(score).name}`, url].join('\n')
}
