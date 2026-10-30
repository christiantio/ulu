import { useEffect, useState } from 'react'
import { Countdown } from './components/Countdown'
import { Game } from './components/Game'
import { HowToPlay } from './components/HowToPlay'
import { Results } from './components/Results'
import { ALL_PROMPTS, SCHEDULE, promptById } from './content'
import { diveNumber, msUntilNextDive, singaporeDateKey } from './game/daily'
import { promptsForDate, unlimitedPrompts } from './game/schedule'
import { ROUNDS_PER_DIVE } from './game/scoring'
import { totalScore } from './game/share'
import {
  displayStreak,
  hasSeenHelp,
  loadDaily,
  loadStats,
  markHelpSeen,
  recordDive,
  saveDaily,
  type Stats,
} from './game/storage'
import type { Prompt, RoundResult } from './game/types'

type Screen =
  | { kind: 'home' }
  // A daily keeps the date it started on, so a dive in progress at midnight can still be finished
  | { kind: 'daily'; dateKey: string }
  | { kind: 'unlimited'; prompts: Prompt[]; round: number }
  | { kind: 'results'; results: RoundResult[]; dateKey: string | null }

/** A day's prompts, preferring the saved set so a content update mid-day can't swap them */
function diveFor(dateKey: string) {
  const saved = loadDaily(dateKey)
  if (saved) {
    const prompts = saved.promptIds.map(promptById)
    if (prompts.every((p) => p !== undefined)) return { prompts: prompts as Prompt[], saved }
  }
  return { prompts: promptsForDate(ALL_PROMPTS, dateKey, SCHEDULE), saved: null }
}

/** Today's Singapore date, kept current past midnight and whenever the tab comes back into view */
function useSingaporeDateKey(): string {
  const [dateKey, setDateKey] = useState(singaporeDateKey)
  useEffect(() => {
    const refresh = () => setDateKey(singaporeDateKey())
    let timer = 0
    const arm = () => {
      timer = window.setTimeout(() => {
        refresh()
        arm()
      }, msUntilNextDive() + 1000)
    }
    arm()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return dateKey
}

const diveTitle = (dateKey: string) => `Ulu #${diveNumber(dateKey)}`

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [showHelp, setShowHelp] = useState(() => !hasSeenHelp())
  const [stats, setStats] = useState<Stats>(loadStats)
  const [unlimitedRound, setUnlimitedRound] = useState(0)
  const [lastUnlimited, setLastUnlimited] = useState<string[]>([])

  const dateKey = useSingaporeDateKey()
  const dive = diveFor(dateKey)
  const played = dive.saved?.results ?? []
  const dailyDone = played.length >= ROUNDS_PER_DIVE

  const closeHelp = () => {
    markHelpSeen()
    setShowHelp(false)
  }

  const startUnlimited = () => {
    const daily = dive.prompts.map((p) => p.id)
    const prompts = unlimitedPrompts(ALL_PROMPTS, SCHEDULE, dateKey, { daily, recent: lastUnlimited })
    setLastUnlimited(prompts.map((p) => p.id))
    setUnlimitedRound((n) => n + 1)
    setScreen({ kind: 'unlimited', prompts, round: unlimitedRound + 1 })
  }

  const finishDaily = (diveDate: string, results: RoundResult[]) => {
    setStats(recordDive(diveDate, results))
    setScreen({ kind: 'results', results, dateKey: diveDate })
  }

  if (ALL_PROMPTS.length === 0) {
    return (
      <main className="home">
        <p>No prompts loaded yet. Add packs under src/content/packs.</p>
      </main>
    )
  }

  return (
    <>
      {screen.kind === 'home' && (
        <main className="home">
          <h1 className="wordmark">
            ulu<span className="wordmark__dot">.</span>
          </h1>
          <p className="tagline">How ulu can you go?</p>
          <p className="muted">
            Name the thing nobody else will think of. Seven Singapore prompts a day; the more obscure your answer, the
            further out of town you go.
          </p>

          <div className="home__card">
            <div className="home__dive">
              <span>{diveTitle(dateKey)}</span>
              <span className="muted">
                {new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-SG', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
            {dailyDone ? (
              <>
                <p className="home__done">
                  Done for today: <strong>{totalScore(played)}</strong> pts
                </p>
                <button
                  className="btn btn--primary btn--block btn--big"
                  onClick={() => setScreen({ kind: 'results', results: played, dateKey })}
                >
                  See today's results
                </button>
                <p className="muted small center">
                  Next dive in <Countdown />
                </p>
              </>
            ) : (
              <button className="btn btn--primary btn--block btn--big" onClick={() => setScreen({ kind: 'daily', dateKey })}>
                {played.length ? `Continue dive (${played.length}/${ROUNDS_PER_DIVE})` : "Start today's dive"}
              </button>
            )}
          </div>

          <div className="home__links">
            <button className="btn btn--secondary btn--block" onClick={startUnlimited}>
              ∞ Unlimited
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => setShowHelp(true)}>
              How to play
            </button>
          </div>

          {stats.played > 0 && (
            <p className="muted small center">
              {stats.played} dives · {displayStreak(stats, dateKey)} day streak · best {stats.bestScore}
            </p>
          )}
        </main>
      )}

      {screen.kind === 'daily' && (
        <DailyGame
          dateKey={screen.dateKey}
          onFinish={(results) => finishDaily(screen.dateKey, results)}
          onQuit={() => setScreen({ kind: 'home' })}
        />
      )}

      {screen.kind === 'unlimited' && (
        <Game
          key={screen.round}
          title="Unlimited"
          prompts={screen.prompts}
          onFinish={(results) => setScreen({ kind: 'results', results, dateKey: null })}
          onQuit={() => setScreen({ kind: 'home' })}
        />
      )}

      {screen.kind === 'results' && (
        <Results
          title={screen.dateKey ? diveTitle(screen.dateKey) : 'Ulu Unlimited'}
          results={screen.results}
          stats={stats}
          isDaily={screen.dateKey !== null}
          onHome={() => setScreen({ kind: 'home' })}
          onUnlimited={startUnlimited}
        />
      )}

      {showHelp && <HowToPlay onClose={closeHelp} />}
    </>
  )
}

interface DailyGameProps {
  dateKey: string
  onFinish: (results: RoundResult[]) => void
  onQuit: () => void
}

/** The daily dive for one date; the prompts are fixed when it mounts so they can't change mid-dive */
function DailyGame({ dateKey, onFinish, onQuit }: DailyGameProps) {
  const [dive] = useState(() => diveFor(dateKey))
  return (
    <Game
      title={diveTitle(dateKey)}
      prompts={dive.prompts}
      initialResults={dive.saved?.results ?? []}
      initialStartedAt={dive.saved?.startedAt}
      onProgress={(results, startedAt) =>
        saveDaily({ dateKey, promptIds: dive.prompts.map((p) => p.id), results, startedAt })
      }
      onFinish={onFinish}
      onQuit={onQuit}
    />
  )
}
