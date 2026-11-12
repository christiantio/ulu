import { useEffect, useRef, useState } from 'react'
import { scoreBucket, track } from './analytics'
import { Countdown } from './components/Countdown'
import { ElevatorProgress } from './components/ElevatorProgress'
import { ElevatorScene } from './components/elevator/ElevatorScene'
import { Game } from './components/Game'
import { HowToPlay } from './components/HowToPlay'
import { Logo } from './components/Logo'
import { PrivacyNote } from './components/PrivacyNote'
import { Results } from './components/Results'
import { loadBank, loadDive, type Bank } from './content'
import { diveNumber, msUntilNextDive, singaporeDateKey } from './game/daily'
import { liftAfter } from './game/elevator'
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
  // A daily keeps the date it started on and the prompts loaded for it, so a dive in progress at midnight can
  // still be finished
  | { kind: 'daily'; dateKey: string; prompts: Prompt[] }
  | { kind: 'loading-unlimited'; failed: boolean }
  | { kind: 'unlimited'; prompts: Prompt[]; round: number }
  | { kind: 'results'; results: RoundResult[]; prompts: Prompt[]; dateKey: string | null }

const sameIds = (ids: readonly string[], prompts: readonly Prompt[]) =>
  ids.length === prompts.length && ids.every((id, i) => prompts[i].id === id)

/** A day's prompts, preferring the saved set so a content update mid-day can't swap them */
async function diveFor(dateKey: string): Promise<Prompt[]> {
  const prompts = await loadDive(dateKey)
  const saved = loadDaily(dateKey)
  if (!saved || sameIds(saved.promptIds, prompts)) return prompts
  const bank = await loadBank()
  const savedPrompts = saved.promptIds.map(bank.promptById)
  return savedPrompts.every((p) => p !== undefined) ? (savedPrompts as Prompt[]) : prompts
}

type DiveState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; prompts: Prompt[] }

/** A date's prompts, fetched again when the date changes or on retry. An answer for an earlier date is dropped */
function useDive(dateKey: string): DiveState {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; prompts: Prompt[] | null } | null>(null)
  const key = `${dateKey}#${attempt}`
  useEffect(() => {
    let current = true
    diveFor(dateKey).then(
      (prompts) => {
        if (current) setLoaded({ key, prompts })
      },
      () => {
        if (current) setLoaded({ key, prompts: null })
      },
    )
    return () => {
      current = false
    }
  }, [dateKey, key])
  if (loaded?.key !== key) return { status: 'loading' }
  if (!loaded.prompts) return { status: 'error', retry: () => setAttempt((n) => n + 1) }
  return { status: 'ready', prompts: loaded.prompts }
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
  const helpButton = useRef<HTMLButtonElement>(null)
  const helpWasOpen = useRef(showHelp)
  const [lastUnlimited, setLastUnlimited] = useState<string[]>([])
  const completedDives = useRef(new Set<string>())
  // Loaded the first time Unlimited starts, then kept so the next game starts straight away
  const bank = useRef<Bank | null>(null)
  // Bumped by every Unlimited start and by going home, so a bank that arrives late can't start a stale game
  const unlimitedRequest = useRef(0)

  const dateKey = useSingaporeDateKey()
  const today = useDive(dateKey)
  const saved = loadDaily(dateKey)
  const played = saved?.results ?? []
  const dailyDone = played.length >= ROUNDS_PER_DIVE
  // The home screen's lift is wherever today's game has got to: the ground floor, until the first answer
  const lift = liftAfter(played)

  // HowToPlay hands focus back to whatever opened it, but Safari doesn't focus buttons on click (and the first
  // visit opens it with nothing focused), so fall back to the How to play button
  useEffect(() => {
    if (showHelp) helpWasOpen.current = true
    else if (helpWasOpen.current && document.activeElement === document.body) helpButton.current?.focus()
  }, [showHelp])

  // Every screen starts at the top, where its sign is: the last one may have been scrolled down to its cards
  useEffect(() => {
    if (window.scrollY > 0) window.scrollTo({ top: 0 })
  }, [screen.kind])

  const openHelp = () => {
    setShowHelp(true)
    track('howto_opened')
  }

  const closeHelp = () => {
    markHelpSeen()
    setShowHelp(false)
  }

  const goHome = () => {
    unlimitedRequest.current++
    setScreen({ kind: 'home' })
  }

  const playUnlimited = (loaded: Bank) => {
    // Keep today's prompts out whether or not today's dive file has loaded: the saved set and the scheduled one
    const daily = [
      ...(loadDaily(dateKey)?.promptIds ?? []),
      ...promptsForDate(loaded.ALL_PROMPTS, dateKey, loaded.SCHEDULE).map((p) => p.id),
    ]
    const prompts = unlimitedPrompts(loaded.ALL_PROMPTS, loaded.SCHEDULE, dateKey, { daily, recent: lastUnlimited })
    setLastUnlimited(prompts.map((p) => p.id))
    setUnlimitedRound((n) => n + 1)
    setScreen({ kind: 'unlimited', prompts, round: unlimitedRound + 1 })
    track('unlimited_started')
  }

  /** The bank is only downloaded here, the first time Unlimited starts */
  const startUnlimited = () => {
    const request = ++unlimitedRequest.current
    if (bank.current) return playUnlimited(bank.current)
    setScreen({ kind: 'loading-unlimited', failed: false })
    loadBank().then(
      (loaded) => {
        // Kept even if the player has left, so the next start is immediate
        bank.current = loaded
        if (request === unlimitedRequest.current) playUnlimited(loaded)
      },
      () => {
        if (request === unlimitedRequest.current) setScreen({ kind: 'loading-unlimited', failed: true })
      },
    )
  }

  /** Fold a finished dive into the stats. Safe to call more than once: recordDive ignores repeats */
  const recordDaily = (diveDate: string, results: RoundResult[]) => {
    const played = loadStats().played
    const next = recordDive(diveDate, results)
    setStats(next)
    // Counted once per dive: only when it reached the stats, and only once per session in case storage is blocked
    if (next.played > played && !completedDives.current.has(diveDate)) {
      completedDives.current.add(diveDate)
      track('dive_completed', { score: scoreBucket(totalScore(results)) })
    }
  }

  const finishDaily = (diveDate: string, prompts: Prompt[], results: RoundResult[]) => {
    recordDaily(diveDate, results)
    setScreen({ kind: 'results', results, prompts, dateKey: diveDate })
  }

  // Backstop for a finished dive that never reached the stats, e.g. progress saved by an older build that only
  // recorded the dive from the results screen. Reads storage itself so it only depends on primitives
  const unrecorded = screen.kind === 'home' && dailyDone && (stats.lastPlayed === null || stats.lastPlayed < dateKey)
  useEffect(() => {
    if (!unrecorded) return
    const saved = loadDaily(dateKey)
    if (saved) setStats(recordDive(dateKey, saved.results))
  }, [unrecorded, dateKey])

  return (
    <>
      {screen.kind === 'home' && (
        <main className="home">
          <ElevatorScene score={lift.score} floor={lift.floor} climbed={lift.climbed} size="hero" />

          <div className="stack home__stack">
            <div className="home__brand">
              <h1 className="wordmark">
                <Logo />
                <span className="visually-hidden">Ulu</span>
              </h1>
              <p className="tagline float">How ulu can you go?</p>
              {played.length > 0 && <ElevatorProgress score={lift.score} floor={lift.floor} compact />}
            </div>

            <div className="stack__sky" />

            <div className="home__panel">
              <div className="home__card" aria-busy={today.status === 'loading'}>
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
                <p className="home__copy">7 Singapore questions. The rarer your answers, the higher you rise.</p>
                {dailyDone && (
                  <p className="home__done float">
                    Done for today: <strong>{totalScore(played)}</strong> pts
                  </p>
                )}
                {today.status === 'loading' && (
                  <p className="home__status float center" role="status">
                    Loading today's questions…
                  </p>
                )}
                {today.status === 'error' && (
                  <>
                    <p className="home__status float center" role="alert">
                      Couldn't load today's questions. Check your connection and try again.
                    </p>
                    <button className="btn btn--primary btn--block" onClick={today.retry}>
                      Retry
                    </button>
                  </>
                )}
                {today.status === 'ready' &&
                  (today.prompts.length === 0 ? (
                    <p className="home__status float">No prompts loaded yet. Add packs under src/content/packs.</p>
                  ) : dailyDone ? (
                    <button
                      className="btn btn--primary btn--block btn--big"
                      onClick={() => setScreen({ kind: 'results', results: played, prompts: today.prompts, dateKey })}
                    >
                      See today's results
                    </button>
                  ) : (
                    <button
                      className="btn btn--primary btn--block btn--big btn--cta"
                      onClick={() => setScreen({ kind: 'daily', dateKey, prompts: today.prompts })}
                    >
                      {played.length || saved?.startedAt
                        ? `Continue climbing (${played.length}/${ROUNDS_PER_DIVE})`
                        : 'Start climbing'}
                    </button>
                  ))}
                {dailyDone && (
                  <p className="float small center">
                    Next climb in <Countdown />
                  </p>
                )}
              </div>

              <div className="home__links">
                <button className="btn btn--secondary" onClick={startUnlimited}>
                  <span aria-hidden="true">∞</span> Unlimited
                </button>
                <button ref={helpButton} className="btn btn--secondary" onClick={openHelp}>
                  How to play
                </button>
              </div>

              {stats.played > 0 && (
                <p className="home__stats float small center">
                  {stats.played} played · {displayStreak(stats, dateKey)} day streak · best {stats.bestScore}
                </p>
              )}

              <PrivacyNote />
            </div>
          </div>
        </main>
      )}

      {screen.kind === 'daily' && (
        <DailyGame
          dateKey={screen.dateKey}
          prompts={screen.prompts}
          onComplete={(results) => recordDaily(screen.dateKey, results)}
          onFinish={(results) => finishDaily(screen.dateKey, screen.prompts, results)}
          onQuit={goHome}
        />
      )}

      {screen.kind === 'loading-unlimited' && (
        <main className="waiting" aria-busy={!screen.failed}>
          {screen.failed ? (
            <>
              <p className="home__status center" role="alert">
                Couldn't load Unlimited. Check your connection and try again.
              </p>
              <button className="btn btn--primary btn--block" onClick={startUnlimited}>
                Retry
              </button>
            </>
          ) : (
            <p className="home__status muted center" role="status">
              Loading Unlimited…
            </p>
          )}
          <button className="btn btn--ghost btn--block" onClick={goHome}>
            Home
          </button>
        </main>
      )}

      {screen.kind === 'unlimited' && (
        <Game
          key={screen.round}
          title="Unlimited"
          prompts={screen.prompts}
          onFinish={(results) => setScreen({ kind: 'results', results, prompts: screen.prompts, dateKey: null })}
          onQuit={goHome}
        />
      )}

      {screen.kind === 'results' && (
        <Results
          title={screen.dateKey ? diveTitle(screen.dateKey) : 'Ulu Unlimited'}
          results={screen.results}
          prompts={screen.prompts}
          stats={stats}
          isDaily={screen.dateKey !== null}
          dateKey={screen.dateKey}
          onHome={goHome}
          onUnlimited={startUnlimited}
        />
      )}

      {showHelp && <HowToPlay onClose={closeHelp} />}
    </>
  )
}

interface DailyGameProps {
  dateKey: string
  prompts: Prompt[]
  /** Called as soon as the last result is saved, so the dive counts even if the results screen is skipped */
  onComplete: (results: RoundResult[]) => void
  onFinish: (results: RoundResult[]) => void
  onQuit: () => void
}

/**
 * The daily dive for one date. Its prompts come with the screen, loaded before it started, so they can't change
 * mid-dive. The saved progress is read once, when it mounts
 */
function DailyGame({ dateKey, prompts, onComplete, onFinish, onQuit }: DailyGameProps) {
  const [saved] = useState(() => loadDaily(dateKey))
  return (
    <Game
      title={diveTitle(dateKey)}
      prompts={prompts}
      reportDate={dateKey}
      initialResults={saved?.results ?? []}
      initialStartedAt={saved?.startedAt}
      onProgress={(results, startedAt) => {
        saveDaily({ dateKey, promptIds: prompts.map((p) => p.id), results, startedAt })
        // Round 1 starting is the only progress with no results and a start time, so this fires once per dive
        if (results.length === 0 && startedAt !== null) track('dive_started')
        if (results.length >= prompts.length) onComplete(results)
      }}
      onFinish={onFinish}
      onQuit={onQuit}
    />
  )
}
