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
  ulu: { label: 'Damn Ulu', points: 85, emoji: '🟣', blurb: 'True deep cut. Very few go this far.' },
  gem: { label: 'Sibei Ulu', points: 100, emoji: '💎', blurb: 'The hand-picked gem. End of the line.' },
}

export const MISS_EMOJI = '❌'

export const ROUNDS_PER_DIVE = 7
export const SECONDS_PER_ROUND = 25
export const MAX_SCORE = ROUNDS_PER_DIVE * TIER_INFO.gem.points

/**
 * The score is framed as a journey out from the CBD: the more points, the
 * more ulu the place you end up at.
 */
export const DESTINATIONS = [
  { min: 0, name: 'Raffles Place', blurb: 'Still stuck in the CBD.' },
  { min: 100, name: 'Bishan', blurb: 'Heartland, but very central.' },
  { min: 200, name: 'Sengkang', blurb: 'Now we are going places.' },
  { min: 300, name: 'Woodlands', blurb: 'Can see Johor already.' },
  { min: 400, name: 'Lim Chu Kang', blurb: 'Farms, cemeteries and not much else.' },
  { min: 500, name: 'Pulau Ubin', blurb: 'Bumboat-only territory.' },
  { min: 600, name: 'Pulau Tekong', blurb: 'Only NS boys come here.' },
  { min: 700, name: 'Pedra Branca', blurb: 'The most ulu point in Singapore. Perfect dive.' },
] as const

export type Destination = (typeof DESTINATIONS)[number]

export function destinationFor(score: number): Destination {
  return DESTINATIONS.findLast((d) => score >= d.min) ?? DESTINATIONS[0]
}
