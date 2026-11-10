import type { Tier } from './types'

export interface TierInfo {
  label: string
  points: number
  blurb: string
  emoji: string
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  common: { label: 'Everybody Say', points: 10, emoji: '⚪', blurb: 'The first thing the whole kopitiam shouts.' },
  trap: { label: 'Act Smart', points: 15, emoji: '🟡', blurb: 'The "obscure" pick everyone thinks only they know.' },
  solid: { label: 'Can Lah', points: 30, emoji: '🟢', blurb: 'Solid. Not bad, not bad.' },
  rare: { label: 'Steady', points: 60, emoji: '🔵', blurb: 'Genuinely uncommon. Steady pom pi pi.' },
  ulu: { label: 'Damn Ulu', points: 85, emoji: '🟣', blurb: 'True deep cut. Very few get up here.' },
  gem: { label: 'Sibei Ulu', points: 100, emoji: '💎', blurb: 'The hand-picked gem. Top-floor stuff.' },
}

export const MISS_EMOJI = '❌'

export const ROUNDS_PER_DIVE = 7
export const SECONDS_PER_ROUND = 25
export const MAX_SCORE = ROUNDS_PER_DIVE * TIER_INFO.gem.points
