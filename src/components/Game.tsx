import { useEffect, useMemo, useState } from 'react'
import { formatFloor, liftAfter, prefersReducedMotion, upgradeFor } from '../game/elevator'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult } from '../game/types'
import { CountUp } from './CountUp'
import { ElevatorProgress } from './ElevatorProgress'
import { loadBackdrops } from './elevator/backdrops'
import { ElevatorScene } from './elevator/ElevatorScene'
import { Reveal } from './Reveal'
import { Round } from './Round'

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

/** After a round, the lift rides up before the reveal, unless motion is reduced */
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
    setPhase({ kind: 'playing', startedAt })
    onProgress?.(results, startedAt)
  }

  const handleResult = (result: RoundResult) => {
    const next = [...results, result]
    setResults(next)
    setPhase({ kind: prefersReducedMotion() ? 'reveal' : 'ride' })
    onProgress?.(next, null)
  }

  const handleNext = () => {
    if (results.length >= prompts.length) onFinish(results)
    else start()
  }

  return (
    <main className={`game game--${phase.kind}`}>
      <div className="game__top">
        <header className="hud">
          <button className="btn btn--ghost btn--small" onClick={onQuit} aria-label="Back to home">
            ← {title}
          </button>
          <dl className="hud__stats">
            <div className="hud__stat">
              <dt>Floor</dt>
              <dd>{formatFloor(lift.floor)}</dd>
            </div>
            <div className="hud__stat game__score">
              <dt>Score</dt>
              <dd>
                {gained > 0 && (
                  <span key={index} className="game__gain" aria-hidden="true">
                    +{gained}
                  </span>
                )}
                <strong>
                  <CountUp value={lift.score} />
                </strong>
              </dd>
            </div>
          </dl>
        </header>

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
                className={`pip ${current ? 'pip--current' : ''} ${r ? `pip--done pip--${r.tier ?? 'miss'}` : ''} ${fresh ? 'pip--fresh' : ''}`}
                aria-current={current ? 'step' : undefined}
              >
                <span aria-hidden="true">{r && !r.tier ? '×' : i + 1}</span>
                <span className="visually-hidden">{label}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="game__lift">
        <ElevatorScene
          score={lift.score}
          floor={lift.floor}
          climbed={lift.climbed}
          ride={riding ? last : null}
          onRideDone={() => setPhase({ kind: 'reveal' })}
        >
          <ElevatorProgress score={lift.score} floor={lift.floor} compact />
        </ElevatorScene>
      </div>

      <div className="game__panel">
        {phase.kind === 'ready' && prompt && (
          <section className="ready card">
            <p className="ready__round">
              Question {index + 1} of {prompts.length}
            </p>
            <p className="muted">You have {SECONDS_PER_ROUND} seconds. The clock starts when you press the button.</p>
            <button className="btn btn--primary btn--block btn--big" onClick={start} autoFocus>
              Going up{' '}
              <span className="ready__arrow" aria-hidden="true">
                ▲
              </span>
            </button>
          </section>
        )}

        {phase.kind === 'playing' && prompt && (
          <Round
            key={prompt.id}
            prompt={prompt}
            deadline={phase.startedAt + SECONDS_PER_ROUND * 1000}
            onResult={handleResult}
          />
        )}

        {riding && prompt && (
          <section className="riding card">
            <p className="reveal__prompt">{prompt.text}</p>
            {last.answer && (
              <p className="riding__answer">
                <span className="muted">Locked in</span> {last.answer}
              </p>
            )}
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
