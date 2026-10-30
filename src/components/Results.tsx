import { useState } from 'react'
import { promptById } from '../content'
import { MAX_SCORE, MISS_EMOJI, TIER_INFO, destinationFor } from '../game/scoring'
import { shareText, totalScore } from '../game/share'
import { singaporeDateKey } from '../game/daily'
import { displayStreak, type Stats } from '../game/storage'
import type { RoundResult } from '../game/types'
import { Countdown } from './Countdown'
import { RouteLine } from './RouteLine'

interface Props {
  title: string
  results: RoundResult[]
  stats?: Stats
  isDaily: boolean
  onHome: () => void
  onUnlimited: () => void
}

export function Results({ title, results, stats, isDaily, onHome, onUnlimited }: Props) {
  const [copied, setCopied] = useState(false)
  const score = totalScore(results)
  const destination = destinationFor(score)

  const share = async () => {
    const text = shareText(results, title, window.location.origin)
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Share sheet dismissed or clipboard blocked; nothing else to do
    }
  }

  return (
    <main className="results">
      <p className="results__title">{title}</p>
      <div className="results__score">
        <span className="results__number">{score}</span>
        <span className="muted">/ {MAX_SCORE}</span>
      </div>
      <p className="results__destination">
        You reached <strong>{destination.name}</strong>
      </p>
      <p className="muted">{destination.blurb}</p>

      <RouteLine score={score} />

      <ol className="breakdown">
        {results.map((r) => {
          const prompt = promptById(r.promptId)
          const gem = prompt?.answers.find((a) => a.tier === 'gem')
          return (
            <li key={r.promptId} className={`breakdown__row ${r.tier ? `tier--${r.tier}` : 'verdict--miss'}`}>
              <span className="breakdown__emoji">{r.tier ? TIER_INFO[r.tier].emoji : MISS_EMOJI}</span>
              <span className="breakdown__body">
                <span className="breakdown__prompt">{prompt?.text ?? r.promptId}</span>
                <span className="breakdown__answer">
                  {r.answer ?? <em>No answer</em>}
                  {gem && r.tier !== 'gem' && <span className="muted"> · 💎 {gem.name}</span>}
                </span>
              </span>
              <span className="breakdown__points">{r.points}</span>
            </li>
          )
        })}
      </ol>

      <button className="btn btn--primary btn--block btn--big" onClick={share}>
        {copied ? 'Copied! Go paste in the group chat' : 'Share result'}
      </button>

      {isDaily && stats && (
        <div className="stats">
          <Stat label="Played" value={stats.played} />
          <Stat label="Streak" value={displayStreak(stats, singaporeDateKey())} />
          <Stat label="Best" value={stats.bestScore} />
          <Stat label="Gems" value={stats.gems} />
        </div>
      )}

      {isDaily && (
        <p className="muted center">
          Next dive in <Countdown />
        </p>
      )}

      <div className="results__actions">
        <button className="btn btn--ghost" onClick={onHome}>
          Home
        </button>
        <button className="btn btn--secondary" onClick={onUnlimited}>
          {isDaily ? 'Play unlimited' : 'Play again'}
        </button>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}
