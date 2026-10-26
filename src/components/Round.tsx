import { useEffect, useRef, useState, type FormEvent } from 'react'
import { matchAnswer } from '../game/match'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult } from '../game/types'

interface Props {
  prompt: Prompt
  /** Epoch ms when time runs out */
  deadline: number
  onResult: (result: RoundResult) => void
}

/** One prompt: the timer, the input box and retrying unrecognised answers */
export function Round({ prompt, deadline, onResult }: Props) {
  const [input, setInput] = useState('')
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()))
  const [rejected, setRejected] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
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

  return (
    <section className="round">
      <div className="timer" aria-hidden>
        <div
          className={`timer__bar ${seconds <= 5 ? 'timer__bar--urgent' : ''}`}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>
      <div className="round__clock" aria-live="off">
        {seconds}s
      </div>

      <h2 className="round__prompt">{prompt.text}</h2>
      {prompt.note && <p className="round__note">{prompt.note}</p>}

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
        />
        <button className="btn btn--primary" type="submit" disabled={!input.trim()}>
          Go
        </button>
      </form>
      <p className="round__feedback" role="status">
        {rejected ? (
          <>
            <strong>“{rejected}”</strong> not on our list leh. Try another one!
          </>
        ) : (
          'First valid answer locks in. Go ulu or go home.'
        )}
      </p>
    </section>
  )
}
