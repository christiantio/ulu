import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { buzz } from '../haptics'
import { checkAnswer } from '../game/match'
import { normalize } from '../game/normalize'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Answer, Prompt, RoundResult } from '../game/types'

/** How the clock is doing: steady, amber for the last ten seconds, red for the last five */
export type Pace = 'steady' | 'low' | 'urgent'

interface Props {
  prompt: Prompt
  /** Epoch ms when time runs out */
  deadline: number
  onResult: (result: RoundResult) => void
  /** Called on every tick with the share of the time that's left, from 1 down to 0: the lift's doors close with it */
  onClock?: (left: number, pace: Pace) => void
  /** Called when a guess is refused, so the lift can show it */
  onRefuse?: () => void
}

const paceFor = (seconds: number): Pace => (seconds <= 5 ? 'urgent' : seconds <= 10 ? 'low' : 'steady')

/** Seconds remaining at which the time left is announced to screen readers */
const TIME_WARNINGS = [10, 5]

/** Why the last guess didn't lock in */
type Feedback =
  | { kind: 'unknown'; guess: string }
  /** It fits more than one answer */
  | { kind: 'ambiguous'; guess: string }
  /** A known wrong answer, and why */
  | { kind: 'decoy'; guess: string; why: string }

/**
 * One question. The sign over the lift carries the clock, the question and what the lift made of the last guess;
 * the answer box sits at the lift's foot
 */
export function Round({ prompt, deadline, onResult, onClock, onRefuse }: Props) {
  const [input, setInput] = useState('')
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [shake, setShake] = useState(0)
  // Only warn for thresholds still ahead when the round mounted, so a resumed round with 7s left doesn't say "10"
  const [startSeconds] = useState(() => Math.ceil(Math.max(0, deadline - Date.now()) / 1000))
  const promptId = useId()
  const noteId = useId()
  const done = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Keep the latest input for the timeout handler without restarting the timer
  const lastInput = useRef('')
  lastInput.current = input
  // Every unrecognised guess, kept in a ref so the timeout handler sees the latest list
  const attempts = useRef<string[]>([])
  // The latest callback, so a new one from the game doesn't restart the timer
  const clock = useRef(onClock)
  clock.current = onClock

  const finish = (result: RoundResult) => {
    if (done.current) return
    done.current = true
    buzz(result.tier ? 'lock' : 'timeUp')
    onResult(result)
  }

  const lockIn = (guess: string, answer: Answer) =>
    finish({
      promptId: prompt.id,
      input: guess,
      attempts: attempts.current,
      answer: answer.name,
      tier: answer.tier,
      points: TIER_INFO[answer.tier].points,
    })

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, deadline - Date.now())
      setRemaining(left)
      clock.current?.(Math.min(left / (SECONDS_PER_ROUND * 1000), 1), paceFor(Math.ceil(left / 1000)))
      if (left === 0) {
        // The buzzer. An answer that was typed in time counts, even if Go wasn't pressed in time: whatever is in
        // the box is judged as if it had been entered. Anything else in there is a miss, as before
        const typed = lastInput.current.trim()
        const verdict = typed !== '' && !done.current ? checkAnswer(typed, prompt) : null
        if (verdict?.kind === 'match') {
          lockIn(typed, verdict.answer)
        } else {
          finish({ promptId: prompt.id, input: typed, attempts: attempts.current, answer: null, tier: null, points: 0 })
        }
      }
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, prompt.id])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const guess = input.trim()
    if (!guess || done.current) return
    const verdict = checkAnswer(guess, prompt)
    if (verdict.kind !== 'match') {
      if (verdict.kind === 'none') {
        // One entry per distinct guess: "Bedok" and "bedok!" count once. Text that normalises to nothing (e.g.
        // only Chinese characters) is compared as typed. Only unrecognised guesses are kept: these are the ones a
        // player can report as missing. A decoy has already been judged, and an ambiguous guess wasn't refused
        const key = (text: string) => normalize(text) || text.toLowerCase()
        if (!attempts.current.some((a) => key(a) === key(guess))) attempts.current = [...attempts.current, guess]
        setFeedback({ kind: 'unknown', guess })
      } else if (verdict.kind === 'decoy') {
        setFeedback({ kind: 'decoy', guess, why: verdict.decoy.why })
      } else {
        setFeedback({ kind: 'ambiguous', guess })
      }
      setShake((n) => n + 1)
      buzz('refuse')
      onRefuse?.()
      // An ambiguous guess stays in the box, so the player can add to it
      if (verdict.kind !== 'ambiguous') setInput('')
      inputRef.current?.focus()
      return
    }
    lockIn(guess, verdict.answer)
  }

  const seconds = Math.ceil(remaining / 1000)
  const fraction = remaining / (SECONDS_PER_ROUND * 1000)
  const warning = TIME_WARNINGS.filter((t) => seconds <= t && startSeconds > t).at(-1)
  // The lights go amber for the last ten seconds and red for the last five
  const pace = paceFor(seconds)

  return (
    <div className="round">
      <section className="round__board board">
        <div className="round__time">
          {/* A strip of lift lights that go out as the time runs down */}
          <div className="timer" aria-hidden>
            <div className={`timer__bar timer__bar--${pace}`} style={{ transform: `scaleX(${fraction})` }} />
          </div>
          <div className={`round__clock round__clock--${pace}`} role="timer" aria-live="off">
            {/* Keyed by the second once it's urgent, so each of the last five ticks */}
            <span key={pace === 'urgent' ? seconds : pace} className="round__digits" aria-hidden="true">
              {String(seconds).padStart(2, '0')}
            </span>
            <span className="visually-hidden">{seconds} seconds left</span>
          </div>
        </div>
        {/* Present (empty) from mount so screen readers pick up the change at each threshold */}
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {warning ? `${warning} seconds left` : ''}
        </p>

        <h2 className="round__prompt" id={promptId}>
          {prompt.text}
        </h2>
        {prompt.note && (
          <p className="round__note" id={noteId}>
            {prompt.note}
          </p>
        )}

        {/* What the lift made of the last guess. Until there is one, how the round works */}
        <p className={`round__feedback ${feedback ? 'round__feedback--refused' : ''}`} role="status">
          {feedback ? (
            // Keyed so the same rejected answer twice is still announced again
            <span key={shake}>
              <strong>“{feedback.guess}”</strong>{' '}
              {feedback.kind === 'unknown' && 'not on our list leh. Try another one — no points lost!'}
              {feedback.kind === 'ambiguous' && 'could be more than one answer. Which one? Type a bit more.'}
              {feedback.kind === 'decoy' && `doesn't count. ${feedback.why}`}
            </span>
          ) : (
            'First valid answer locks in. The rarer it is, the higher you go.'
          )}
        </p>
      </section>

      <form className="round__form dock" onSubmit={submit}>
        <div className="round__entry">
          <input
            ref={inputRef}
            key={shake}
            className={`round__input ${shake ? 'shake' : ''}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Choosing a composed character or holding Enter must not lock an answer in.
              if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.repeat)) e.preventDefault()
            }}
            placeholder="Type your answer…"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="Your answer"
            aria-describedby={prompt.note ? `${promptId} ${noteId}` : promptId}
          />
          <button className="btn btn--primary" type="submit" disabled={!input.trim()}>
            Go
          </button>
        </div>
      </form>
    </div>
  )
}
