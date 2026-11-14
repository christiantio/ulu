import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { liftAfter, prefersReducedMotion, upgradeFor } from '../game/elevator'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult } from '../game/types'
import { CountUp } from './CountUp'
import { LiftMeter } from './ElevatorProgress'
import { KeyHint } from './KeyHint'
import { TierLamp } from './TierLamp'
import { loadBackdrops } from './elevator/backdrops'
import { ElevatorScene } from './elevator/ElevatorScene'
import { Reveal } from './Reveal'
import { Round, type Pace } from './Round'

interface Props {
  title: string
  prompts: Prompt[]
  /** Rounds already played (when resuming a daily dive) */
  initialResults?: RoundResult[]
  /** When the current round started, if it was already underway */
  initialStartedAt?: number | null
  /** Called whenever a round starts or ends, so progress can be saved */
  onProgress?: (results: RoundResult[], startedAt: number | null) => void
  onFinish: (results: RoundResult[]) => void
  onQuit: () => void
  /** The dive's date for answer reports, or "unlimited" */
  reportDate?: string
}

/**
 * A game, played in the lift's world. The lift fills the window, and every phase lays the same three things over
 * it: the status along the top, a sign hung over the lift, and the controls at its foot (see "The stage" in
 * styles.css). The world takes part: the doors close with the clock, the lift shudders at a refused guess, and
 * an answer is a ride.
 *
 * After a round, the lift rides up before the reveal, unless motion is reduced
 */
type Phase = { kind: 'ready' } | { kind: 'playing'; startedAt: number } | { kind: 'ride' } | { kind: 'reveal' }

export function Game({
  title,
  prompts,
  initialResults = [],
  initialStartedAt,
  onProgress,
  onFinish,
  onQuit,
  reportDate,
}: Props) {
  const [results, setResults] = useState<RoundResult[]>(initialResults)
  const [phase, setPhase] = useState<Phase>(() =>
    initialStartedAt ? { kind: 'playing', startedAt: initialStartedAt } : { kind: 'ready' },
  )

  const finished = phase.kind === 'ride' || phase.kind === 'reveal'
  const index = finished ? results.length - 1 : results.length
  const prompt = prompts[index]
  const riding = phase.kind === 'ride'
  // The score, floor, pips and lift don't give the result away until the ride lands
  const shown = useMemo(() => (riding ? results.slice(0, -1) : results), [riding, results])
  const lift = useMemo(() => liftAfter(shown), [shown])
  const before = useMemo(() => liftAfter(results.slice(0, -1)), [results])
  const last = results[index]
  const gained = phase.kind === 'reveal' ? (last?.points ?? 0) : 0
  const upgrade = phase.kind === 'reveal' && last ? upgradeFor(before.score, last.points) : null

  // The clock reaches the world as a custom property and an attribute on the game, set straight on the element:
  // it changes ten times a second, and nothing in React needs to know
  const root = useRef<HTMLElement>(null)
  const showClock = useCallback((left: number, pace: Pace) => {
    const el = root.current
    if (!el) return
    el.style.setProperty('--clock', left.toFixed(3))
    el.dataset.pace = pace
  }, [])
  // Guesses the lift has refused this game: each one jolts the car
  const [refusals, setRefusals] = useState(0)
  const refuse = useCallback(() => setRefusals((n) => n + 1), [])

  // The later lifts' scenery loads now, while the first question is being read: the first can't be unlocked sooner
  useEffect(() => {
    void loadBackdrops()
  }, [])

  // Each phase starts at the top, where the lift is: a phone may have scrolled to keep the answer box in view
  useEffect(() => {
    if (window.scrollY > 0) window.scrollTo({ top: 0 })
  }, [phase.kind])

  const start = () => {
    const startedAt = Date.now()
    showClock(1, 'steady')
    setPhase({ kind: 'playing', startedAt })
    onProgress?.(results, startedAt)
  }

  const handleResult = (result: RoundResult) => {
    const next = [...results, result]
    // The doors stay where the clock left them, and the ride shuts them from there. A miss is the clock running
    // out, so they're shut already
    if (root.current) {
      delete root.current.dataset.pace
      if (!result.tier) root.current.style.setProperty('--clock', '0')
    }
    setResults(next)
    setPhase({ kind: prefersReducedMotion() ? 'reveal' : 'ride' })
    onProgress?.(next, null)
  }

  const handleNext = () => {
    if (results.length >= prompts.length) onFinish(results)
    else start()
  }

  return (
    <main ref={root} className={`game game--${phase.kind}`}>
      <ElevatorScene
        score={lift.score}
        floor={lift.floor}
        climbed={lift.climbed}
        ride={riding ? last : null}
        onRideDone={() => setPhase({ kind: 'reveal' })}
        jolt={phase.kind === 'playing' ? refusals : 0}
      />

      <div className="stack game__stack">
        {/* One row: the way back, a lamp for each round, and the score. The floor is the lift's to show */}
        <header className="game__top hud">
          <button className="btn btn--chip btn--small hud__back" onClick={onQuit} aria-label="Back to home">
            ← {title}
          </button>

          <ol className="pips" aria-label="Rounds">
            {prompts.map((p, i) => {
              const r = shown[i]
              const current = i === index
              // The one the lift has just lit
              const fresh = current && phase.kind === 'reveal'
              const label = r
                ? `Round ${i + 1}: ${r.tier ? TIER_INFO[r.tier].label : 'Time up'}, ${r.points} points`
                : `Round ${i + 1}${current ? '' : ', not played yet'}`
              return (
                <li
                  key={p.id}
                  className={`pip ${current ? 'pip--current' : ''} ${fresh ? 'pip--fresh' : ''}`}
                  aria-current={current ? 'step' : undefined}
                >
                  {r ? <TierLamp tier={r.tier} /> : <span className="lamp lamp--off" aria-hidden="true" />}
                  <span className="visually-hidden">{label}</span>
                </li>
              )
            })}
          </ol>

          <p className="hud__score game__score">
            <span className="visually-hidden">Score </span>
            {gained > 0 && (
              <span key={index} className="game__gain" aria-hidden="true">
                +{gained}
              </span>
            )}
            <strong>
              <CountUp value={lift.score} />
            </strong>
            <LiftMeter score={lift.score} />
          </p>
        </header>

        {/* The sky over the sign, and the room the lift stands in between the sign and the controls */}
        <div className="stack__sky" />
        <div className="stack__gap" />

        {phase.kind === 'ready' && prompt && (
          <>
            <section className="ready board">
              <p className="board__label">
                Question {index + 1} of {prompts.length}
              </p>
              <p className="ready__brief">Answer before the doors close.</p>
              <p className="board__note">You have {SECONDS_PER_ROUND} seconds. The clock starts when you press the button.</p>
            </section>
            <div className="dock">
              <button className="btn btn--primary btn--block btn--big" onClick={start}
                onKeyDown={(e) => { if (e.repeat) e.preventDefault() }} autoFocus>
                Going up{' '}
                <span className="ready__arrow" aria-hidden="true">
                  ▲
                </span>
                <KeyHint>Enter</KeyHint>
              </button>
            </div>
          </>
        )}

        {phase.kind === 'playing' && prompt && (
          <Round
            key={prompt.id}
            prompt={prompt}
            deadline={phase.startedAt + SECONDS_PER_ROUND * 1000}
            onResult={handleResult}
            onClock={showClock}
            onRefuse={refuse}
          />
        )}

        {riding && prompt && (
          <section className="riding board">
            <p className="riding__prompt">{prompt.text}</p>
            <p className="riding__answer">
              <span className="board__label">{last.answer ? 'Locked in' : 'Too late'}</span>{' '}
              {last.answer ?? 'The doors have closed'}
            </p>
          </section>
        )}

        {phase.kind === 'reveal' && prompt && (
          <Reveal
            key={prompt.id}
            prompt={prompt}
            result={last}
            isLast={results.length >= prompts.length}
            reportDate={reportDate}
            floor={lift.floor}
            upgrade={upgrade}
            onNext={handleNext}
          />
        )}
      </div>
    </main>
  )
}
