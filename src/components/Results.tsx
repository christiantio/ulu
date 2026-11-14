import { useState } from 'react'
import { track } from '../analytics'
import { liftAfter, type StageId } from '../game/elevator'
import { MAX_SCORE, TIER_INFO } from '../game/scoring'
import { shareText } from '../game/share'
import { singaporeDateKey } from '../game/daily'
import { UNLIMITED_DATE } from '../game/report'
import { displayStreak, type Stats } from '../game/storage'
import type { Prompt, RoundResult } from '../game/types'
import { AnswerGroups } from './AllAnswers'
import { Countdown } from './Countdown'
import { CountUp } from './CountUp'
import { ElevatorScene } from './elevator/ElevatorScene'
import { ProblemLinks, RejectedGuesses } from './Report'
import { TierLamp } from './TierLamp'

interface Props {
  title: string
  results: RoundResult[]
  /** The dive's prompts, for each row's text, gem, answer list and report links */
  prompts: readonly Prompt[]
  stats?: Stats
  isDaily: boolean
  /** The daily dive's date, which is earlier than today if it was finished past midnight */
  dateKey?: string | null
  onHome: () => void
  onUnlimited: () => void
}

/** What the results call each lift. Nothing here is a consolation prize: the first lift is home */
const HEADLINES: Record<StageId, string> = {
  hdb: 'Heartland hero',
  upgraded: 'Moving on up',
  condo: 'Condo life',
  cbd: 'High flyer',
  marina: 'Room with a view',
  penthouse: 'Top of the world',
}
/** From the Marina Bay lift up, the results get confetti */
const CELEBRATE_FROM = 500

/**
 * The end of a game. The sign over the lift has the score and the lift it reached; Share is at the lift's foot,
 * with the next game beside it and the way home at the top, so none of them needs scrolling to. Each question is
 * one row on the card beyond, which opens to its gem, the guesses that weren't on the list, and every answer
 */
export function Results({ title, results, prompts, stats, isDaily, dateKey, onHome, onUnlimited }: Props) {
  const [copied, setCopied] = useState(false)
  const byId = new Map(prompts.map((p) => [p.id, p]))
  const { score, floor, stage, climbed } = liftAfter(results)
  const perfect = score >= MAX_SCORE
  const reportDate = isDaily && dateKey ? dateKey : UNLIMITED_DATE

  const share = async () => {
    const text = shareText(results, title, window.location.origin)
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        track('share_tapped', { method: 'share' })
        await navigator.share({ text })
        return
      }
      track('share_tapped', { method: 'copy' })
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Share sheet dismissed or clipboard blocked; nothing else to do
    }
  }

  return (
    <main className={`results ${perfect ? 'results--perfect' : ''}`}>
      <ElevatorScene score={score} floor={floor} climbed={climbed} size="finale" celebrate={score >= CELEBRATE_FROM} />

      <div className="stack results__stack">
        {/* Where the game had its way back */}
        <div className="results__top">
          <button className="btn btn--chip btn--small" onClick={onHome}>
            <span aria-hidden="true">← </span>Home
          </button>
        </div>

        <div className="stack__sky" />
        <div className="stack__gap" />

        <div className="results__summary board">
          <p className="results__title">{title}</p>
          <h1 className="results__headline">{perfect ? 'Perfect climb' : HEADLINES[stage.id]}</h1>
          <div className="results__score">
            <span className="results__number">
              <CountUp value={score} from={0} ms={900} />
            </span>
            <span className="results__max">/ {MAX_SCORE}</span>
          </div>
          <p className="results__reached">
            <strong>{stage.name}.</strong>{' '}
            {perfect ? 'All the way up. The doors open, and he blows another bubble.' : stage.blurb}
          </p>

          <ol className="results__lamps" aria-label="Your seven answers">
            {results.map((r, i) => (
              <li key={r.promptId} className={`results__lamp ${r.tier ? `tier--${r.tier}` : 'verdict--miss'}`}>
                <TierLamp tier={r.tier} />
                <span className="visually-hidden">
                  Question {i + 1}: {r.tier ? TIER_INFO[r.tier].label : 'Time up'}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="dock results__dock">
          <button className="btn btn--primary btn--big results__share" onClick={share}>
            {copied ? 'Copied! Go paste in the group chat' : 'Share result'}
          </button>
          <button className="btn btn--secondary btn--big" onClick={onUnlimited}>
            {isDaily ? (
              <>
                <span aria-hidden="true">∞</span> Unlimited
              </>
            ) : (
              'Play again'
            )}
          </button>
        </div>

        <div className="results__more extras">
          <ol className="breakdown card" aria-label="Your answers">
            {results.map((r) => {
              const prompt = byId.get(r.promptId)
              const gem = prompt?.answers.find((a) => a.tier === 'gem')
              return (
                <li key={r.promptId} className={`breakdown__row ${r.tier ? `tier--${r.tier}` : 'verdict--miss'}`}>
                  <details className="breakdown__details">
                    {/* Read out as e.g. "Name a kueh, Kueh Lapis, Everybody Say, 10 points" */}
                    <summary className="breakdown__summary">
                      <span className="breakdown__lamp">
                        <TierLamp tier={r.tier} />
                      </span>
                      <span className="breakdown__body">
                        <span className="breakdown__prompt">{prompt?.text ?? r.promptId}</span>
                        <span className="breakdown__answer">{r.answer ?? <em>No answer</em>}</span>
                      </span>
                      <span className="breakdown__points">
                        <span className="visually-hidden">{r.tier ? TIER_INFO[r.tier].label : 'Time up'}, </span>
                        {r.points}
                        <span className="visually-hidden"> points</span>
                      </span>
                    </summary>
                    {prompt && (
                      <div className="breakdown__more">
                        {gem && r.tier !== 'gem' && (
                          <p className="breakdown__gem">
                            <TierLamp tier="gem" /> The gem: <strong>{gem.name}</strong>
                          </p>
                        )}
                        <RejectedGuesses
                          guesses={r.attempts}
                          date={reportDate}
                          promptId={prompt.id}
                          context={`for ${prompt.text}`}
                          compact
                        />
                        <AnswerGroups prompt={prompt} yours={r.answer} />
                        <ProblemLinks date={reportDate} promptId={prompt.id} context={`for ${prompt.text}`} />
                      </div>
                    )}
                  </details>
                </li>
              )
            })}
          </ol>

          {isDaily && stats && (
            <div className="stats">
              <Stat label="Played" value={stats.played} />
              <Stat label="Streak" value={displayStreak(stats, singaporeDateKey())} />
              <Stat label="Best" value={stats.bestScore} />
              <Stat label="Gems" value={stats.gems} />
            </div>
          )}

          {isDaily && (
            <p className="results__next float center">
              {/* Finished past midnight: the next game is already out, so don't count down to tomorrow's */}
              {dateKey && dateKey !== singaporeDateKey() ? "Today's climb is ready" : <>Next climb in <Countdown /></>}
            </p>
          )}
        </div>
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
