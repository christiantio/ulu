/**
 * Turn the panels' estimates of what players type into tiers. Pure code, so the same numbers always give the
 * same tiers and the rules can be read and tested.
 *
 * The cut-offs are the ones ADR 001 proposes for real answer counts (docs/adr/001-answer-stats-backend.md),
 * so a draft's tiers and the tiers later recomputed from real plays are on the same scale. Until that backend
 * exists, a panel's estimate is only an informed guess: it gives the reviewer numbers to argue with.
 */
import { MIN_EASY_ANSWERS } from '../../src/game/validate'
import type { Tier } from '../../src/game/types'

export interface PanelResult {
  /** This panel's share of all players, 0 to 1 */
  weight: number
  /** Players who score nothing, in the same units as `picks` */
  misses: number
  answers: readonly { name: string; picks: number; cleverPick: boolean }[]
  gemCandidates: readonly { name: string }[]
}

export interface Estimate {
  name: string
  /** Estimated share of all players who lock in this answer, 0 to 1 */
  share: number
  /** Share of the panels (by weight) that called it a clever pick */
  clever: number
  /** Panels that proposed it as the gem, plus one if the list stage did */
  gemVotes: number
  tier: Tier
  /** Why the tier isn't simply what the share says, if it isn't */
  flag?: string
}

/** A share at or above this is `common`, and so on down. Below RARE is `ulu` */
export const SHARE = { common: 0.1, solid: 0.03, rare: 0.01 } as const
export const MAX_COMMON = 4
export const MAX_TRAPS = 2
/** A clever pick is a trap when at least this share of players go for it */
const TRAP_SHARE = SHARE.solid
/** A gem that this many players find isn't a deep cut */
const GEM_MAX_SHARE = SHARE.solid

function tierForShare(share: number): Tier {
  if (share >= SHARE.common) return 'common'
  if (share >= SHARE.solid) return 'solid'
  if (share >= SHARE.rare) return 'rare'
  return 'ulu'
}

/**
 * Combine the panels into one estimate per answer and assign tiers that pass content validation: one to four
 * commons, at most two traps, at least three easy answers, exactly one gem.
 *
 * `names` is the answer list after fact-checking. A name a panel left out counts as zero picks for that panel;
 * a name a panel invented is ignored.
 */
export function assignTiers(
  names: readonly string[],
  panels: readonly PanelResult[],
  listGemCandidates: readonly string[] = [],
): Estimate[] {
  const totalWeight = panels.reduce((sum, p) => sum + p.weight, 0) || 1
  const estimates: Estimate[] = names.map((name) => {
    let share = 0
    let clever = 0
    let gemVotes = listGemCandidates.includes(name) ? 1 : 0
    for (const panel of panels) {
      const weight = panel.weight / totalWeight
      const players = panel.misses + panel.answers.reduce((sum, a) => sum + Math.max(0, a.picks), 0) || 1
      const mine = panel.answers.find((a) => a.name === name)
      if (mine) {
        share += (weight * Math.max(0, mine.picks)) / players
        if (mine.cleverPick) clever += weight
      }
      if (panel.gemCandidates.some((g) => g.name === name)) gemVotes++
    }
    return { name, share, clever, gemVotes, tier: tierForShare(share) }
  })
  if (estimates.length === 0) return estimates

  const byShare = [...estimates].sort((a, b) => b.share - a.share)

  // Traps: the clever picks most players reach for. Most of the panels (by weight) have to agree
  const traps = byShare.filter((e) => e.clever > 0.5 && e.share >= TRAP_SHARE).slice(0, MAX_TRAPS)
  for (const e of traps) {
    e.tier = 'trap'
    e.flag = 'trap: the panels expect many players to pick this thinking it is obscure'
  }

  // Commons: between one and MAX_COMMON
  const commons = byShare.filter((e) => e.tier === 'common')
  for (const e of commons.slice(MAX_COMMON)) {
    e.tier = 'solid'
    e.flag = `over ${SHARE.common * 100}% share, but only ${MAX_COMMON} answers can be common`
  }
  if (commons.length === 0) {
    const top = byShare.find((e) => e.tier !== 'trap') ?? byShare[0]
    top.tier = 'common'
    top.flag = 'the most picked answer, made common so the prompt has one'
  }

  // The gem: the candidate with the most votes among the deep cuts, then the rarer one. Never a common or a trap
  const free = estimates.filter((e) => e.tier !== 'common' && e.tier !== 'trap')
  const deep = free.filter((e) => e.share < GEM_MAX_SHARE)
  const pool = deep.length ? deep : free.length ? free : estimates
  const gem = [...pool].sort((a, b) => b.gemVotes - a.gemVotes || a.share - b.share)[0]
  gem.tier = 'gem'
  gem.flag = gem.gemVotes > 0 ? `gem: proposed by ${gem.gemVotes} stage(s)` : 'gem: nobody proposed one, so this is the rarest answer. Pick a better one'

  // At least MIN_EASY_ANSWERS easy answers, so there are several ways onto the board
  const easy = () => estimates.filter((e) => e.tier === 'common' || e.tier === 'trap' || e.tier === 'solid').length
  for (const e of byShare) {
    if (easy() >= MIN_EASY_ANSWERS) break
    if (e.tier === 'rare' || e.tier === 'ulu') {
      e.tier = 'solid'
      e.flag = 'promoted to solid so the prompt has enough easy answers'
    }
  }
  return estimates
}
