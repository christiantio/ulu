import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { DESTINATIONS, ROUNDS_PER_DIVE, SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import { TIERS } from '../game/types'

/**
 * A native modal <dialog>: showModal() traps focus and makes the rest of the page inert. Focus goes back to
 * whatever opened it when it closes.
 */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Captured during the first render, before the dialog takes focus
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      // jsdom has no showModal; fall back to a plain open dialog there
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    buttonRef.current?.focus()
    // No dialog.close() here: unmounting removes it from the top layer, and close() would fire onClose
    return () => {
      if (opener && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [opener])

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    onClose()
  }

  // Clicks on the dialog element itself (not the card inside it) are on the backdrop
  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="howto-title"
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={onBackdropClick}
    >
      <div className="modal__card">
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
              <span className="tier-list__emoji" aria-hidden="true">
                {TIER_INFO[tier].emoji}
              </span>
              <span className="tier-list__label">{TIER_INFO[tier].label}</span>
              <span className="tier-list__blurb">{TIER_INFO[tier].blurb}</span>
              <span className="tier-list__points">
                {TIER_INFO[tier].points}
                <span className="visually-hidden"> points</span>
              </span>
            </li>
          ))}
        </ul>

        <h3>How far can you go?</h3>
        <p className="muted">
          Your score takes you out of town, from {DESTINATIONS[0].name} all the way to{' '}
          {DESTINATIONS[DESTINATIONS.length - 1].name} for a perfect 700. New dive every midnight, Singapore time.
        </p>

        <button ref={buttonRef} className="btn btn--primary btn--block" onClick={onClose}>
          Can, let's go
        </button>
      </div>
    </dialog>
  )
}
