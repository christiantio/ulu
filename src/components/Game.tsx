import { useState } from 'react'
import { MISS_EMOJI, SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import { totalScore } from '../game/share'
import type { Prompt, RoundResult } from '../game/types'
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
}

type Phase = { kind: 'ready' } | { kind: 'playing'; startedAt: number } | { kind: 'reveal' }

export function Game({ title, prompts, initialResults = [], initialStartedAt, onProgress, onFinish, onQuit }: Props) {
  const [results, setResults] = useState<RoundResult[]>(initialResults)
  const [phase, setPhase] = useState<Phase>(() =>
    initialStartedAt ? { kind: 'playing', startedAt: initialStartedAt } : { kind: 'ready' },
  )

  const index = phase.kind === 'reveal' ? results.length - 1 : results.length
  const prompt = prompts[index]
  const score = totalScore(results)

  const start = () => {
    const startedAt = Date.now()
    setPhase({ kind: 'playing', startedAt })
    onProgress?.(results, startedAt)
  }

  const handleResult = (result: RoundResult) => {
    const next = [...results, result]
    setResults(next)
    setPhase({ kind: 'reveal' })
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
          <strong>{score}</strong> pts
        </div>
      </header>

      <ol className="pips" aria-label="Rounds">
        {prompts.map((p, i) => {
          const r = results[i]
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

      {phase.kind === 'reveal' && prompt && (
        <Reveal
          key={prompt.id}
          prompt={prompt}
          result={results[index]}
          isLast={results.length >= prompts.length}
          onNext={handleNext}
        />
      )}
    </main>
  )
}
