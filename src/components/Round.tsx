import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { matchAnswer } from '../game/match'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult } from '../game/types'

interface Props {
  prompt: Prompt
  /** Epoch ms when time runs out */
  deadline: number
  onResult: (result: RoundResult) => void
}

/** Seconds remaining at which the time left is announced to screen readers */
const TIME_WARNINGS = [10, 5]

/** One prompt: the timer, the input box and retrying unrecognised answers */
export function Round({ prompt, deadline, onResult }: Props) {
  const [input, setInput] = useState('')
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))
  const [rejected, setRejected] = useState<string | null>(null)
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

  const finish = (result: RoundResult) => {
    if (done.current) return
    done.current = true
    onResult(result)
  }

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, deadline - Date.now())
      setRemaining(left)
      if (left === 0) {
        finish({ promptId: prompt.id, input: lastInput.current.trim(), answer: null, tier: null, points: 0 })
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
    const match = matchAnswer(guess, prompt)
    if (!match) {
      setRejected(guess)
      setShake((n) => n + 1)
      setInput('')
      inputRef.current?.focus()
      return
    }
    const { answer } = match
    finish({
      promptId: prompt.id,
      input: guess,
      answer: answer.name,
      tier: answer.tier,
      points: TIER_INFO[answer.tier].points,
    })
  }

  const seconds = Math.ceil(remaining / 1000)
  const fraction = remaining / (SECONDS_PER_ROUND * 1000)
  const warning = TIME_WARNINGS.filter((t) => seconds <= t && startSeconds > t).at(-1)

  return (
    <section className="round">
      <div className="timer" aria-hidden>
        <div
          className={`timer__bar ${seconds <= 5 ? 'timer__bar--urgent' : ''}`}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <div className="round__clock" role="timer" aria-live="off">
        <span aria-hidden="true">{seconds}s</span>
        <span className="visually-hidden">{seconds} seconds left</span>
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

      <form className="round__form" onSubmit={submit}>
        <input
          ref={inputRef}
          key={shake}
          className={`round__input ${shake ? 'shake' : ''}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
      </form>
      <p className="round__feedback" role="status">
        {rejected ? (
          // Keyed so the same rejected answer twice is still announced again
          <span key={shake}>
            <strong>“{rejected}”</strong> not on our list leh. Try another one!
          </span>
        ) : (
          'First valid answer locks in. Go ulu or go home.'
        )}
      </p>
    </section>
  )
}
