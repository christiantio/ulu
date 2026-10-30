import { useState } from 'react'
import { Countdown } from './components/Countdown'
import { Game } from './components/Game'
import { HowToPlay } from './components/HowToPlay'
import { Results } from './components/Results'
import { ALL_PROMPTS, SCHEDULE, promptById } from './content'
import { diveNumber, singaporeDateKey } from './game/daily'
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
  | { kind: 'daily' }
  | { kind: 'unlimited'; prompts: Prompt[]; round: number }
  | { kind: 'results'; results: RoundResult[]; daily: boolean }

/** Today's prompts, preferring the saved set so a content update mid-day can't swap them */
function todaysDive(dateKey: string) {
  const saved = loadDaily(dateKey)
  if (saved) {
    const prompts = saved.promptIds.map(promptById)
    if (prompts.every((p) => p !== undefined)) return { prompts: prompts as Prompt[], saved }
  }
  return { prompts: promptsForDate(ALL_PROMPTS, dateKey, SCHEDULE), saved: null }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [showHelp, setShowHelp] = useState(() => !hasSeenHelp())
  const [stats, setStats] = useState<Stats>(loadStats)
  const [unlimitedRound, setUnlimitedRound] = useState(0)
  const [lastUnlimited, setLastUnlimited] = useState<string[]>([])

  const dateKey = singaporeDateKey()
  const dive = todaysDive(dateKey)
  const dailyTitle = `Ulu #${diveNumber(dateKey)}`
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

  const finishDaily = (results: RoundResult[]) => {
    setStats(recordDive(dateKey, results))
    setScreen({ kind: 'results', results, daily: true })
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
              <span>{dailyTitle}</span>
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
                  onClick={() => setScreen({ kind: 'results', results: played, daily: true })}
                >
                  See today's results
                </button>
                <p className="muted small center">
                  Next dive in <Countdown />
                </p>
              </>
            ) : (
              <button className="btn btn--primary btn--block btn--big" onClick={() => setScreen({ kind: 'daily' })}>
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
        <Game
          title={dailyTitle}
          prompts={dive.prompts}
          initialResults={played}
          initialStartedAt={dive.saved?.startedAt}
          onProgress={(results, startedAt) =>
            saveDaily({ dateKey, promptIds: dive.prompts.map((p) => p.id), results, startedAt })
          }
          onFinish={finishDaily}
          onQuit={() => setScreen({ kind: 'home' })}
        />
      )}

      {screen.kind === 'unlimited' && (
        <Game
          key={screen.round}
          title="Unlimited"
          prompts={screen.prompts}
          onFinish={(results) => setScreen({ kind: 'results', results, daily: false })}
          onQuit={() => setScreen({ kind: 'home' })}
        />
      )}

      {screen.kind === 'results' && (
        <Results
          title={screen.daily ? dailyTitle : 'Ulu Unlimited'}
          results={screen.results}
          stats={stats}
          isDaily={screen.daily}
          onHome={() => setScreen({ kind: 'home' })}
          onUnlimited={startUnlimited}
        />
      )}

      {showHelp && <HowToPlay onClose={closeHelp} />}
    </>
  )
}
