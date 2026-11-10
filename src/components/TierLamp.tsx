import type { Tier } from '../game/types'

/**
 * A lift-button lamp in a tier's colour, in place of an emoji. Decorative: the tier's name is always next to it.
 * The gem's is a diamond, and a miss is an unlit button with a cross, so they don't depend on colour alone
 */
export function TierLamp({ tier }: { tier: Tier | null }) {
  return <span className={`lamp lamp--${tier ?? 'miss'}`} aria-hidden="true" />
}
