import { useEffect } from 'react'
import { DESTINATIONS, ROUNDS_PER_DIVE, SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import { TIERS } from '../game/types'

export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="howto-title" onClick={onClose}>
      <div className="modal__card" onClick={(e) => e.stopPropagation()}>
        <h2 id="howto-title">How to play</h2>
        <ol className="howto__steps">
          <li>
            Every day there are <strong>{ROUNDS_PER_DIVE} prompts</strong>, the same for everyone in Singapore.
          </li>
          <li>
            Type <strong>one answer</strong> per prompt within <strong>{SECONDS_PER_ROUND} seconds</strong>. If
            we don't recognise it, you can try again while the clock runs.
          </li>
          <li>
            The first valid answer locks in. <strong>The more ulu it is, the more points.</strong> Run out of time
            and you score nothing.
          </li>
        </ol>

        <h3>Rarity</h3>
        <ul className="tier-list">
          {TIERS.map((tier) => (
            <li key={tier} className={`tier-list__row tier--${tier}`}>
              <span className="tier-list__emoji">{TIER_INFO[tier].emoji}</span>
              <span className="tier-list__label">{TIER_INFO[tier].label}</span>
              <span className="tier-list__blurb">{TIER_INFO[tier].blurb}</span>
              <span className="tier-list__points">{TIER_INFO[tier].points}</span>
            </li>
          ))}
        </ul>

        <h3>How far can you go?</h3>
        <p className="muted">
          Your score takes you out of town, from {DESTINATIONS[0].name} all the way to{' '}
          {DESTINATIONS[DESTINATIONS.length - 1].name} for a perfect 700. New dive every midnight, Singapore time.
        </p>

        <button className="btn btn--primary btn--block" onClick={onClose} autoFocus>
          Can, let's go
        </button>
      </div>
    </div>
  )
}
