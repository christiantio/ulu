import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { MAX_SCORE, ROUNDS_PER_DIVE, SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import { TIERS } from '../game/types'
import { LiftDirectory } from './ElevatorProgress'
import { TierLamp } from './TierLamp'

interface Props {
  /** The player's best score, which decides how many of the lifts are named */
  best?: number
  onClose: () => void
}

/**
 * The one place the rules are spelled out, so the game itself doesn't have to keep saying them.
 *
 * A native modal <dialog>: showModal() traps focus and makes the rest of the page inert. Focus goes back to
 * whatever opened it when it closes.
 */
export function HowToPlay({ best = 0, onClose }: Props) {
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
      <div className="modal__card card">
        <h2 id="howto-title">How to play</h2>
        <ol className="howto__steps">
          <li>
            <strong>{ROUNDS_PER_DIVE} questions</strong> every midnight, Singapore time, the same for everyone.
          </li>
          <li>
            Type <strong>one answer</strong> before the lift doors close, in <strong>{SECONDS_PER_ROUND} seconds</strong>.
            Not on our list? Try another: there's no penalty. Whatever is in the box when time runs out still counts.
          </li>
          <li>
            The first valid answer locks in. <strong>The more ulu it is, the more points</strong>, and the higher the
            lift goes.
          </li>
        </ol>

        <h3>Rarity</h3>
        <ul className="tier-list">
          {TIERS.map((tier) => (
            <li key={tier} className={`tier-list__row tier--${tier}`}>
              <span className="tier-list__lamp">
                <TierLamp tier={tier} />
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

        <h3>How high can you go?</h3>
        <p className="muted">
          Your score upgrades the lift on the way up, and a perfect {MAX_SCORE} goes all the way. Each lift is named
          here once you've reached it.
        </p>
        <LiftDirectory best={best} />

        <button ref={buttonRef} className="btn btn--primary btn--block" onClick={onClose}>
          Can, let's go
        </button>
      </div>
    </dialog>
  )
}
