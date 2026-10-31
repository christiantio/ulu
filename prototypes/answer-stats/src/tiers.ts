// THROWAWAY PROTOTYPE (issue #17). Not production code.
//
// Data-driven tier suggestions. Pure: no I/O, no Worker APIs, so it can move into src/game/ later as-is.
// The formula is explained with a worked example in docs/adr/001-answer-stats-backend.md.

import type { Tier } from '../../../src/game/types'

export interface TierOptions {
  /** Below this many plays the editorial tiers are returned untouched */
  minPlays: number
  /** How many pseudo-plays the editorial prior is worth */
  priorWeight: number
  /** Relative weight of each editorial tier in the prior */
  priorWeights: Record<Tier, number>
  /** Posterior share of plays at or above which an answer is `common` */
  commonShare: number
  /** ... `solid`, and the share at which an editorially deep answer becomes a `trap` */
  solidShare: number
  /** ... `rare`; anything below is `ulu` */
  rareShare: number
  /** Every prompt needs at least this many easy (common/trap/solid) answers, as validate.ts checks */
  minEasy: number
}

export const DEFAULT_TIER_OPTIONS: TierOptions = {
  minPlays: 100,
  priorWeight: 100,
  priorWeights: { common: 8, trap: 4, solid: 3, rare: 1, ulu: 0.3, gem: 0.3 },
  commonShare: 0.1,
  solidShare: 0.03,
  rareShare: 0.01,
  minEasy: 3,
}

export interface AnswerInput {
  name: string
  /** The editorial tier from the pack */
  tier: Tier
}

export type TierFlag =
  /** The gem is picked by enough players to be a trap. A human should choose another gem */
  | 'gem-too-popular'
  /** Data alone left too few easy answers, so this one was lifted to `solid` to keep the prompt valid */
  | 'promoted-for-easy-minimum'

export interface TierSuggestion {
  name: string
  editorial: Tier
  suggested: Tier
  count: number
  /** Observed share of plays (misses included in the denominator) */
  share: number
  /** Share after blending in the editorial prior */
  posterior: number
  flags: TierFlag[]
}

export interface TierResult {
  /** `editorial` while the prompt has fewer than `minPlays` plays */
  source: 'editorial' | 'data'
  plays: number
  suggestions: TierSuggestion[]
}

const EASY: readonly Tier[] = ['common', 'trap', 'solid']
const DEEP: readonly Tier[] = ['trap', 'rare', 'ulu']

/**
 * Suggest tiers for one prompt from its play counts, summed over every daily dive it appeared in.
 *
 * - `counts` is keyed by canonical answer name; answers nobody gave can be left out.
 * - `plays` counts every daily play of the prompt, misses included, so shares match "X% of players found this".
 *
 * The result is a suggestion for a human-reviewed content PR, never applied live.
 */
export function recomputeTiers(
  answers: readonly AnswerInput[],
  counts: Readonly<Record<string, number>>,
  plays: number,
  options: TierOptions = DEFAULT_TIER_OPTIONS,
): TierResult {
  const given = answers.reduce((sum, a) => sum + (counts[a.name] ?? 0), 0)
  if (given > plays) throw new Error(`answer counts (${given}) exceed plays (${plays})`)

  if (plays < options.minPlays) {
    return {
      source: 'editorial',
      plays,
      suggestions: answers.map((a) => {
        const count = counts[a.name] ?? 0
        return { name: a.name, editorial: a.tier, suggested: a.tier, count, share: share(count, plays), posterior: NaN, flags: [] }
      }),
    }
  }

  // The prior spreads the observed hit rate (1 - miss rate) across answers in proportion to their tier weights
  const hitRate = given / plays
  const totalWeight = answers.reduce((sum, a) => sum + options.priorWeights[a.tier], 0)
  const prior = (tier: Tier) => (hitRate * options.priorWeights[tier]) / totalWeight

  const suggestions: TierSuggestion[] = answers.map((a) => {
    const count = counts[a.name] ?? 0
    const posterior = (count + options.priorWeight * prior(a.tier)) / (plays + options.priorWeight)
    const flags: TierFlag[] = []
    let suggested: Tier
    if (a.tier === 'gem') {
      // The gem is hand-picked for fun and validate.ts needs exactly one, so data never moves it; it only flags it
      suggested = 'gem'
      if (posterior >= options.solidShare) flags.push('gem-too-popular')
    } else if (DEEP.includes(a.tier) && posterior >= options.solidShare) {
      // Listed as obscure (or already a trap) but heavily picked
      suggested = 'trap'
    } else if (posterior >= options.commonShare) suggested = 'common'
    else if (posterior >= options.solidShare) suggested = 'solid'
    else if (posterior >= options.rareShare) suggested = 'rare'
    else suggested = 'ulu'
    return { name: a.name, editorial: a.tier, suggested, count, share: share(count, plays), posterior, flags }
  })

  // Keep the prompt valid: lift the most-picked non-easy answers to solid until there are enough easy ones
  const easy = suggestions.filter((s) => EASY.includes(s.suggested)).length
  suggestions
    .filter((s) => !EASY.includes(s.suggested) && s.suggested !== 'gem')
    .sort((a, b) => b.posterior - a.posterior)
    .slice(0, Math.max(0, options.minEasy - easy))
    .forEach((s) => {
      s.suggested = 'solid'
      s.flags.push('promoted-for-easy-minimum')
    })

  return { source: 'data', plays, suggestions }
}

function share(count: number, plays: number): number {
  return plays === 0 ? 0 : count / plays
}
