import { useState } from 'react'
import { prefersReducedMotion } from '../game/journey'
import { MISS_EMOJI, SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import { totalScore } from '../game/share'
import type { Prompt, RoundResult } from '../game/types'
import { Journey } from './Journey'
import { Reveal } from './Reveal'
import { Round } from './Round'
import { RouteLine } from './RouteLine'

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

/** After a round, the journey (the ride out of town) plays before the reveal, unless motion is reduced */
type Phase = { kind: 'ready' } | { kind: 'playing'; startedAt: number } | { kind: 'journey' } | { kind: 'reveal' }

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

  const finished = phase.kind === 'journey' || phase.kind === 'reveal'
  const index = finished ? results.length - 1 : results.length
  const prompt = prompts[index]
  // The header, pips and route don't give the result away until the ride lands
  const shown = phase.kind === 'journey' ? results.slice(0, -1) : results
  const score = totalScore(shown)
  const gained = phase.kind === 'reveal' ? (results[index]?.points ?? 0) : 0

  const start = () => {
    const startedAt = Date.now()
    setPhase({ kind: 'playing', startedAt })
    onProgress?.(results, startedAt)
  }

  const handleResult = (result: RoundResult) => {
    const next = [...results, result]
    setResults(next)
    setPhase({ kind: prefersReducedMotion() ? 'reveal' : 'journey' })
    onProgress?.(next, null)
  }

  const handleNext = () => {
    if (results.length >= prompts.length) onFinish(results)
    else start()
  }

  return (
    <main className="game">
      <header className="game__header">
        <button className="btn btn--ghost btn--small" onClick={onQuit} aria-label="Back to home">
          ← {title}
        </button>
        <div className="game__score">
          {gained > 0 && (
            <span key={index} className="game__gain" aria-hidden="true">
              +{gained}
            </span>
          )}
          {/* Keyed by the score, so the bump replays each time it goes up */}
          <strong key={score} className={phase.kind === 'reveal' ? 'game__points--bump' : undefined}>
            {score}
          </strong>{' '}
          pts
        </div>
      </header>

      <ol className="pips" aria-label="Rounds">
        {prompts.map((p, i) => {
          const r = shown[i]
          const current = i === index
          const label = r
            ? `Round ${i + 1}: ${r.tier ? TIER_INFO[r.tier].label : 'Time up'}, ${r.points} points`
            : `Round ${i + 1}${current ? '' : ', not played yet'}`
          return (
            <li
              key={p.id}
              className={`pip ${current ? 'pip--current' : ''} ${r ? 'pip--done' : ''}`}
              aria-current={current ? 'step' : undefined}
            >
              <span aria-hidden="true">{r ? (r.tier ? TIER_INFO[r.tier].emoji : MISS_EMOJI) : i + 1}</span>
              <span className="visually-hidden">{label}</span>
            </li>
          )
        })}
      </ol>

      <RouteLine score={score} compact />

      {phase.kind === 'ready' && prompt && (
        <section className="ready">
          <p className="ready__round">
            Prompt {index + 1} of {prompts.length}
          </p>
          <p className="muted">
            You have {SECONDS_PER_ROUND} seconds. The clock starts when you tap below.
          </p>
          <button className="btn btn--primary btn--block btn--big" onClick={start} autoFocus>
            {index === 0 ? 'Start dive' : 'Go'}
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

      {phase.kind === 'journey' && prompt && (
        <Journey key={prompt.id} prompt={prompt} result={results[index]} onDone={() => setPhase({ kind: 'reveal' })} />
      )}

      {phase.kind === 'reveal' && prompt && (
        <Reveal
          key={prompt.id}
          prompt={prompt}
          result={results[index]}
          isLast={results.length >= prompts.length}
          reportDate={reportDate}
          onNext={handleNext}
        />
      )}
    </main>
  )
}
