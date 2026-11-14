// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
import { ALL_PROMPTS, SCHEDULE } from './content/bank'
import { loadBank } from './content/bank-loader'
import { dailyPrompts, mulberry32 } from './game/daily'
import { promptsForDate } from './game/schedule'
import { SECONDS_PER_ROUND } from './game/scoring'
import type { DailyProgress, Stats } from './game/storage'
import type { Prompt, RoundResult } from './game/types'
import { fetched, serveDives, settle } from './test/dives'
import { stubReducedMotion } from './test/motion'

// The real loader, watched, so a test can tell when the bank was asked for
vi.mock('./content/bank-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./content/bank-loader')>()
  return { ...actual, loadBank: vi.fn(actual.loadBank) }
})

// Dive #15. All seven of its prompts already ran on earlier days, so only the daily exclusion keeps them out of
// Unlimited (#6)
const TODAY = '2026-11-10'
const TOMORROW = '2026-11-11'
const NOON = Date.parse('2026-11-10T04:00:00Z') // 12:00 in Singapore
const BEFORE_MIDNIGHT = Date.parse('2026-11-10T15:59:00Z') // 23:59 in Singapore

const today = promptsForDate(ALL_PROMPTS, TODAY, SCHEDULE)
const tomorrow = promptsForDate(ALL_PROMPTS, TOMORROW, SCHEDULE)

const common = (p: Prompt) => p.answers.find((a) => a.tier === 'common')!

const hit = (p: Prompt): RoundResult => ({
  promptId: p.id,
  input: common(p).name,
  attempts: [],
  answer: common(p).name,
  tier: 'common',
  points: 10,
})

type User = ReturnType<typeof userEvent.setup>

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const read = <T,>(key: string): T | null => JSON.parse(localStorage.getItem(key) ?? 'null')
const statsLine = () => screen.getByText(/ played · /).textContent
const promptHeading = () => screen.getByRole('heading', { level: 2 }).textContent
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const diveUrl = (date: string) => `/dives/${date}.json`

function saveProgress(progress: Partial<DailyProgress>) {
  const full: DailyProgress = { dateKey: TODAY, promptIds: today.map((p) => p.id), results: [], startedAt: null, ...progress }
  localStorage.setItem('ulu:daily', JSON.stringify(full))
}

function saveStats(stats: Partial<Stats>) {
  localStorage.setItem('ulu:stats', JSON.stringify(stats))
}

/** Render the app and let today's dive file load */
async function renderApp() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const view = render(<App />)
  await settle()
  return { user, ...view }
}

/** The picture on the current screen: which lift it shows, and what its indicator reads */
const scene = () => document.querySelector('.scene') as HTMLElement

/** Start the round, from the ready screen if it's showing; check its prompt; answer with its first common answer */
async function playRound(user: User, expected: Prompt) {
  const ready = screen.queryByRole('button', { name: 'Going up' })
  if (ready) await user.click(ready)
  expect(promptHeading()).toBe(expected.text)
  await user.type(screen.getByRole('textbox', { name: 'Your answer' }), `${common(expected).name}{Enter}`)
  expect(screen.getByText('Everybody Say', { selector: '.verdict__label' })).toBeDefined()
}

async function playDive(user: User, prompts: Prompt[], from = 0) {
  for (let i = from; i < prompts.length; i++) {
    await playRound(user, prompts[i])
    if (i < prompts.length - 1) await user.click(button(/Next question/))
  }
}

/** Let every round of an Unlimited game time out, ending on its results */
async function timeOutGame(user: User) {
  const seen: string[] = []
  for (let i = 0; i < 7; i++) {
    if (i === 0) await user.click(button('Going up'))
    seen.push(promptHeading()!)
    advance(SECONDS_PER_ROUND * 1000)
    await user.click(button(i < 6 ? /Next question/ : 'See results'))
  }
  return seen
}

let setItem: MockInstance<Storage['setItem']>
const statsWrites = () => setItem.mock.calls.filter(([key]) => key === 'ulu:stats').length
let fetch: ReturnType<typeof serveDives>

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(NOON)
  // Testing Library only recognises Jest's fake timers: without this, its async wrapper waits on a faked setTimeout
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  localStorage.clear()
  localStorage.setItem('ulu:seen-help', 'true')
  setItem = vi.spyOn(Storage.prototype, 'setItem')
  // Report links go to the GitHub issue form, whatever the local .env says
  vi.stubEnv('VITE_REPORT_URL', '')
  fetch = serveDives()
  vi.mocked(loadBank).mockClear()
  // Rounds go straight to their reveal. The lift's ride after each answer is tested in Game and ElevatorScene
  stubReducedMotion()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('test setup', () => {
  it('fakes Date and uses a scheduled day', () => {
    expect(Date.now()).toBe(NOON)
    expect(new Date().toISOString()).toBe('2026-11-10T04:00:00.000Z')
    expect(today.map((p) => p.id)).toEqual(SCHEDULE[TODAY])
    expect(tomorrow.map((p) => p.id)).toEqual(SCHEDULE[TOMORROW])
  })
})

describe('App daily flow', () => {
  it("plays today's dive, saving progress after every round and recording stats exactly once", async () => {
    const { user, unmount } = await renderApp()
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(screen.queryByText(/ played · /)).toBeNull()
    // The title screen: the boy waiting in the HDB lift on the ground floor, and what the game is
    expect(screen.getByRole('heading', { level: 1, name: 'Ulu' })).toBeDefined()
    expect(screen.getByText('How ulu can you go?')).toBeDefined()
    expect(screen.getByText('7 Singapore questions. The rarer your answers, the higher you rise.')).toBeDefined()
    expect(scene().dataset.lift).toBe('hdb')
    expect(scene().dataset.floor).toBe('00')
    expect(scene().querySelector('.boy--idle')).not.toBeNull()

    await user.click(button('Start climbing'))
    await playRound(user, today[0])
    expect(read<DailyProgress>('ulu:daily')).toEqual({
      dateKey: TODAY,
      promptIds: SCHEDULE[TODAY],
      results: [hit(today[0])],
      startedAt: null,
    })

    // A reload picks the dive back up where it was left, with the lift two floors up
    unmount()
    const again = await renderApp()
    expect(scene().dataset.floor).toBe('02')
    await again.user.click(button('Continue climbing (1/7)'))
    expect(screen.getByText('Question 2 of 7')).toBeDefined()
    await again.user.click(button('Going up'))
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ results: [hit(today[0])], startedAt: Date.now() })
    await again.user.type(screen.getByRole('textbox', { name: 'Your answer' }), `${common(today[1]).name}{Enter}`)
    await again.user.click(button(/Next question/))
    await playDive(again.user, today, 2)
    expect(read<DailyProgress>('ulu:daily')?.results).toEqual(today.map(hit))

    // Recorded as soon as the last round ends, before the results screen
    expect(statsWrites()).toBe(1)
    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, totalScore: 70, currentStreak: 1, lastPlayed: TODAY })

    await again.user.click(button('See results'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(screen.getByRole('img', { name: '70 of 700 points, HDB Lift' })).toBeDefined()
    await again.user.click(button('Home'))
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')
    expect(screen.queryByRole('button', { name: /Start climbing|Continue climbing/ })).toBeNull()

    await again.user.click(button("See today's results"))
    for (const p of today) expect(screen.getByText(p.text)).toBeDefined()
    await again.user.click(button('Home'))
    again.unmount()
    await renderApp()
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')
    expect(statsWrites()).toBe(1)

    // Each visit fetched only today's dive, and never the bank
    expect(fetched(fetch)).toEqual([diveUrl(TODAY), diveUrl(TODAY), diveUrl(TODAY)])
    expect(loadBank).not.toHaveBeenCalled()
  })

  it('resumes a round in progress with its original deadline after a reload', async () => {
    const { user, unmount } = await renderApp()
    await user.click(button('Start climbing'))
    await user.click(button('Going up'))
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ results: [], startedAt: NOON })
    advance(10_000)

    unmount()
    const again = await renderApp()
    // No round finished yet, but round 1 is underway, so it's a dive to continue and the clock carries on
    await again.user.click(button('Continue climbing (0/7)'))
    // Straight back into the same prompt, without a ready screen and without a fresh clock
    expect(screen.queryByRole('button', { name: 'Going up' })).toBeNull()
    expect(promptHeading()).toBe(today[0].text)
    expect(within(screen.getByRole('timer')).getByText(`${SECONDS_PER_ROUND - 10} seconds left`)).toBeDefined()

    advance((SECONDS_PER_ROUND - 10) * 1000)
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({
      results: [{ promptId: today[0].id, tier: null, points: 0 }],
      startedAt: null,
    })
  })

  it('times out a round whose deadline passed while the app was closed', async () => {
    saveProgress({ results: [hit(today[0]), hit(today[1])], startedAt: NOON - 60_000 })
    const { user } = await renderApp()
    await user.click(button('Continue climbing (2/7)'))
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(screen.getByText('Round 3: Time up, 0 points')).toBeDefined()
    expect(read<DailyProgress>('ulu:daily')?.results).toHaveLength(3)
  })

  it('records a finished daily even when the player leaves from the last reveal without seeing results', async () => {
    const { user, unmount } = await renderApp()
    await user.click(button('Start climbing'))
    await playDive(user, today)

    // Still on the last reveal: nothing on the home screen has had a chance to record it
    expect(button('See results')).toBeDefined()
    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, lastPlayed: TODAY, totalScore: 70 })

    await user.click(button('Back to home'))
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')

    unmount()
    await renderApp()
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')
    expect(statsWrites()).toBe(1)
  })

  it('resumes progress saved by a build without attempts, and saves them from then on (#9)', async () => {
    // Written as an older build did: no attempts on the results
    const old = today.slice(0, 2).map((p) => {
      const { attempts: _, ...rest } = hit(p)
      void _
      return rest
    })
    localStorage.setItem(
      'ulu:daily',
      JSON.stringify({ dateKey: TODAY, promptIds: SCHEDULE[TODAY], results: old, startedAt: null }),
    )
    const { user } = await renderApp()
    await user.click(button('Continue climbing (2/7)'))
    expect(screen.getByText('Question 3 of 7')).toBeDefined()
    await user.click(button('Going up'))
    expect(promptHeading()).toBe(today[2].text)
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'zzqqxxjj{Enter}')
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), `${common(today[2]).name}{Enter}`)
    expect(read<DailyProgress>('ulu:daily')?.results).toEqual([
      hit(today[0]),
      hit(today[1]),
      { ...hit(today[2]), attempts: ['zzqqxxjj'] },
    ])
    expect(screen.getByRole('list', { name: 'Not on our list' }).textContent).toBe('“zzqqxxjj”')

    await user.click(button(/Next question/))
    await playDive(user, today, 3)
    await user.click(button('See results'))
    expect(screen.getByRole('img', { name: '70 of 700 points, HDB Lift' })).toBeDefined()
    const link = screen.getByRole('link', { name: /^Should this count\?/ })
    expect(new URL(link.getAttribute('href')!).searchParams.get('dive')).toBe(TODAY)
  })

  it('keeps the prompts a dive was saved with when the day file has a different set', async () => {
    // Saved by a build whose content gave today other prompts: the player carries on with those
    const other = tomorrow
    saveProgress({ promptIds: other.map((p) => p.id), results: [hit(other[0])] })
    const { user } = await renderApp()
    expect(loadBank).toHaveBeenCalledTimes(1)
    await user.click(button('Continue climbing (1/7)'))
    await user.click(button('Going up'))
    expect(promptHeading()).toBe(other[1].text)
  })

  it('records a finished dive that was saved without reaching the stats', async () => {
    saveProgress({ results: today.map(hit) })
    await renderApp()
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')
    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, lastPlayed: TODAY })
  })

  it('opens How to play on the first visit only', async () => {
    localStorage.removeItem('ulu:seen-help')
    const { user, unmount } = await renderApp()
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeDefined()
    await user.click(button("Can, let's go"))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem('ulu:seen-help')).toBe('true')

    unmount()
    const again = await renderApp()
    expect(screen.queryByRole('dialog')).toBeNull()
    await again.user.click(button('How to play'))
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeDefined()
    await again.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe("loading today's dive (#18)", () => {
  const card = () => screen.getByText('Ulu #15').closest('.home__card')!

  it('says it is loading, then offers the dive', async () => {
    render(<App />)
    expect(screen.getByRole('status').textContent).toBe("Loading today's questions…")
    expect(card().getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Start climbing' })).toBeNull()

    await settle()
    expect(screen.queryByRole('status')).toBeNull()
    expect(card().getAttribute('aria-busy')).toBe('false')
    expect(button('Start climbing')).toBeDefined()
    expect(fetched(fetch)).toEqual([diveUrl(TODAY)])
  })

  it('shows the score of a finished dive while it loads', () => {
    saveProgress({ results: today.map(hit) })
    render(<App />)
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(screen.getByRole('status').textContent).toBe("Loading today's questions…")
    expect(screen.queryByRole('button', { name: "See today's results" })).toBeNull()
  })

  it('offers a retry when it fails offline, without downloading the bank', async () => {
    let offline = true
    fetch = serveDives({ offline: () => offline })
    const { user } = await renderApp()
    expect(screen.getByRole('alert').textContent).toBe("Couldn't load today's questions. Check your connection and try again.")
    expect(screen.queryByRole('button', { name: 'Start climbing' })).toBeNull()
    expect(loadBank).not.toHaveBeenCalled()

    // Still offline: it fails again
    await user.click(button('Retry'))
    await settle()
    expect(screen.getByRole('alert')).toBeDefined()

    offline = false
    // A synchronous click, so the loading state is checked before the request answers
    fireEvent.click(button('Retry'))
    expect(screen.getByRole('status').textContent).toBe("Loading today's questions…")
    await settle()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fetched(fetch)).toEqual([diveUrl(TODAY), diveUrl(TODAY), diveUrl(TODAY)])
    await user.click(button('Start climbing'))
    await playRound(user, today[0])
  })

  it('treats a server error as a failure to retry, not a missing day', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => null })),
    )
    await renderApp()
    expect(button('Retry')).toBeDefined()
    expect(loadBank).not.toHaveBeenCalled()
  })

  it("falls back to the seeded prompts from the bank for a date the schedule doesn't have", async () => {
    const unscheduled = '2027-03-01'
    expect(SCHEDULE[unscheduled]).toBeUndefined()
    vi.setSystemTime(Date.parse(`${unscheduled}T04:00:00Z`))
    const { user } = await renderApp()
    expect(fetched(fetch)).toEqual([diveUrl(unscheduled)])
    expect(loadBank).toHaveBeenCalledTimes(1)

    const seeded = dailyPrompts(ALL_PROMPTS, unscheduled)
    await user.click(button('Start climbing'))
    await playRound(user, seeded[0])
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ dateKey: unscheduled, promptIds: seeded.map((p) => p.id) })
  })

  it("uses the bank's schedule when a scheduled day's file is missing, or the host sends index.html instead", async () => {
    fetch = serveDives({ missing: [TODAY] })
    const first = await renderApp()
    await first.user.click(button('Start climbing'))
    await playRound(first.user, today[0])
    first.unmount()

    // A host that serves the SPA for unknown paths: a 200 whose body isn't JSON
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse('<!doctype html>') })),
    )
    localStorage.removeItem('ulu:daily')
    const second = await renderApp()
    await second.user.click(button('Start climbing'))
    await playRound(second.user, today[0])
  })
})

describe('midnight rollover (#7)', () => {
  it('moves the home screen to the new dive after Singapore midnight, fetching its file', async () => {
    vi.setSystemTime(BEFORE_MIDNIGHT)
    saveProgress({ results: today.map(hit) })
    saveStats({ played: 1, totalScore: 70, bestScore: 70, currentStreak: 1, maxStreak: 1, lastPlayed: TODAY })
    await renderApp()
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(screen.getByText('Done for today:', { exact: false })).toBeDefined()
    expect(fetched(fetch)).toEqual([diveUrl(TODAY)])

    advance(60_000) // 00:00:00, just before the timer is due
    expect(screen.getByText('Ulu #15')).toBeDefined()
    advance(1_000)
    expect(screen.getByText('Ulu #16')).toBeDefined()
    expect(screen.queryByText('Done for today:', { exact: false })).toBeNull()
    expect(screen.getByRole('status').textContent).toBe("Loading today's questions…")
    await settle()
    expect(fetched(fetch)).toEqual([diveUrl(TODAY), diveUrl(TOMORROW)])
    expect(button('Start climbing')).toBeDefined()
    // Yesterday's dive keeps the streak alive
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')
  })

  it.each([
    ['visibilitychange', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['focus', () => window.dispatchEvent(new Event('focus'))],
  ])('checks the date again on %s after the clock jumps, as when a phone wakes', async (_, wake) => {
    vi.setSystemTime(BEFORE_MIDNIGHT)
    await renderApp()
    expect(screen.getByText('Ulu #15')).toBeDefined()

    // Setting the clock doesn't fire timers, so only the event can move the screen on
    vi.setSystemTime(Date.parse('2026-11-11T01:00:00Z'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    act(wake)
    expect(screen.getByText('Ulu #16')).toBeDefined()
    await settle()
    expect(fetched(fetch)).toEqual([diveUrl(TODAY), diveUrl(TOMORROW)])
  })

  it('drops a day file that arrives after the date moved on', async () => {
    // The 23:59 request only answers once the new day's has
    let answer = () => {}
    const slow = new Promise<void>((resolve) => (answer = resolve))
    const serve = serveDives()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === diveUrl(TODAY)) await slow
        return serve(url)
      }),
    )
    vi.setSystemTime(BEFORE_MIDNIGHT)
    render(<App />)
    vi.setSystemTime(Date.parse('2026-11-11T01:00:00Z'))
    act(() => window.dispatchEvent(new Event('focus')))
    await settle()
    expect(screen.getByText('Ulu #16')).toBeDefined()
    expect(button('Start climbing')).toBeDefined()

    answer()
    await settle()
    // Answered in the wrong order, and the new day's prompts still stand
    expect(fetched(serve)).toEqual([diveUrl(TOMORROW), diveUrl(TODAY)])
    expect(button('Start climbing')).toBeDefined()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(button('Start climbing'))
    await playRound(user, tomorrow[0])
  })

  it("lets a dive started before midnight finish with yesterday's file, counted for the day it started", async () => {
    expect(new Set([...today, ...tomorrow].map((p) => p.text)).size).toBe(14)
    vi.setSystemTime(Date.parse('2026-11-10T15:58:00Z'))
    const { user } = await renderApp()
    await user.click(button('Start climbing'))
    for (let i = 0; i < 3; i++) {
      await playRound(user, today[i])
      if (i < 2) await user.click(button(/Next question/))
    }

    // Midnight passes while reading the third reveal (no round running). The home screen fetches the new day in
    // the background, but the dive keeps the prompts from yesterday's file
    advance(3 * 60_000)
    expect(new Date().toISOString()).toBe('2026-11-10T16:01:00.000Z')
    await settle()
    expect(fetched(fetch)).toEqual([diveUrl(TODAY), diveUrl(TOMORROW)])
    await user.click(button(/Next question/))
    await playDive(user, today, 3)

    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, lastPlayed: TODAY, totalScore: 70 })
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ dateKey: TODAY, promptIds: SCHEDULE[TODAY] })

    await user.click(button('See results'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    for (const p of today) expect(screen.getByText(p.text)).toBeDefined()
    // The results screen's answer lists come from yesterday's file too
    expect(screen.getAllByText(/^Show all \d+ answers/).map((s) => s.textContent)).toEqual(
      today.map((p) => `Show all ${p.answers.length} answers for ${p.text}`),
    )
    expect(screen.getByText("Today's climb is ready")).toBeDefined()
    expect(screen.queryByText(/Next climb in/)).toBeNull()

    await user.click(button('Home'))
    expect(screen.getByText('Ulu #16')).toBeDefined()
    expect(button('Start climbing')).toBeDefined()
    expect(statsLine()).toBe('1 played · 1 day streak · best 70')

    // And tomorrow's dive is the new day's prompts
    await user.click(button('Start climbing'))
    await user.click(button('Going up'))
    expect(promptHeading()).toBe(tomorrow[0].text)
    expect(fetched(fetch)).toEqual([diveUrl(TODAY), diveUrl(TOMORROW)])
    expect(loadBank).not.toHaveBeenCalled()
  })
})

describe('Unlimited (#6)', () => {
  it("never shows today's daily prompts", async () => {
    const dailyTexts = new Set(today.map((p) => p.text))
    expect(new Set(ALL_PROMPTS.map((p) => p.text)).size).toBe(ALL_PROMPTS.length)
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(42))

    const { user } = await renderApp()
    await user.click(button(/Unlimited/))
    await settle()
    for (let game = 0; game < 5; game++) {
      const seen = await timeOutGame(user)
      expect(new Set(seen).size).toBe(7)
      expect(seen.filter((text) => dailyTexts.has(text))).toEqual([])
      expect(screen.getByText('Ulu Unlimited')).toBeDefined()
      for (const text of seen) expect(screen.getByText(text)).toBeDefined()
      await user.click(button('Play again'))
    }

    // Unlimited doesn't touch the daily dive or the stats
    expect(localStorage.getItem('ulu:daily')).toBeNull()
    expect(localStorage.getItem('ulu:stats')).toBeNull()
  })

  it("keeps today's prompts out even when today's file failed to load", async () => {
    fetch = serveDives({ offline: () => true })
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(7))
    const dailyTexts = new Set(today.map((p) => p.text))
    const { user } = await renderApp()
    expect(button('Retry')).toBeDefined()
    await user.click(button(/Unlimited/))
    await settle()
    for (let game = 0; game < 3; game++) {
      expect((await timeOutGame(user)).filter((text) => dailyTexts.has(text))).toEqual([])
      await user.click(button('Play again'))
    }
  })

  it('loads the bank only when Unlimited starts, and only once', async () => {
    const { user } = await renderApp()
    expect(loadBank).not.toHaveBeenCalled()

    fireEvent.click(button(/Unlimited/))
    expect(loadBank).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toBe('Loading Unlimited…')
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true')
    await settle()
    expect(button('Going up')).toBeDefined()

    // Kept for the next game, from home or from the results screen
    await user.click(button('Back to home'))
    await user.click(button(/Unlimited/))
    expect(button('Going up')).toBeDefined()
    expect(loadBank).toHaveBeenCalledTimes(1)
    expect(fetched(fetch)).toEqual([diveUrl(TODAY)])
  })

  it('offers a retry when the bank fails to load, and going home drops a late one', async () => {
    vi.mocked(loadBank).mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
    const { user } = await renderApp()
    await user.click(button(/Unlimited/))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe("Couldn't load Unlimited. Check your connection and try again.")
    expect(screen.queryByRole('button', { name: 'Going up' })).toBeNull()

    // Leave while it's loading: the game doesn't start behind the home screen
    fireEvent.click(button('Retry'))
    expect(screen.getByRole('status').textContent).toBe('Loading Unlimited…')
    await user.click(button('Home'))
    await settle()
    expect(button('Start climbing')).toBeDefined()

    await user.click(button(/Unlimited/))
    expect(button('Going up')).toBeDefined()
  })
})

describe('streak display (#8)', () => {
  const stats: Stats = {
    played: 5,
    totalScore: 1000,
    bestScore: 300,
    currentStreak: 5,
    maxStreak: 5,
    lastPlayed: '2026-11-07',
    gems: 2,
  }

  it('shows a 0 day streak once a whole day passed without a dive', async () => {
    saveStats(stats)
    await renderApp()
    expect(statsLine()).toBe('5 played · 0 day streak · best 300')
  })

  it('keeps the streak while yesterday was played and today is not yet', async () => {
    saveStats({ ...stats, lastPlayed: '2026-11-09' })
    await renderApp()
    expect(statsLine()).toBe('5 played · 5 day streak · best 300')
  })
})

describe('analytics (#16)', () => {
  let plausible = vi.fn<(event: string, options?: { props?: Record<string, string> }) => void>()
  const events = (name: string) => plausible.mock.calls.filter(([event]) => event === name)

  beforeEach(() => {
    // A production build with Plausible on this host (jsdom's is localhost)
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_ANALYTICS_PROVIDER', 'plausible')
    vi.stubEnv('VITE_ANALYTICS_SRC', 'https://plausible.io/js/script.js')
    vi.stubEnv('VITE_ANALYTICS_DOMAIN', 'localhost')
    plausible = vi.fn()
    vi.stubGlobal('plausible', plausible)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('counts a finished daily once, with only its score band', async () => {
    const { user, unmount } = await renderApp()
    await user.click(button('Start climbing'))
    await playDive(user, today)
    expect(events('dive_started')).toHaveLength(1)
    expect(events('dive_completed')).toEqual([['dive_completed', { props: { score: '0-99' } }]])

    // Seeing the results records the dive again, and so does the home screen after a reload; neither counts
    await user.click(button('See results'))
    await user.click(button('Home'))
    unmount()
    await renderApp()
    expect(events('dive_started')).toHaveLength(1)
    expect(events('dive_completed')).toHaveLength(1)

    // Nothing the player typed, and no prompt ids
    const sent = JSON.stringify(plausible.mock.calls)
    for (const p of today) {
      expect(sent).not.toContain(common(p).name)
      expect(sent).not.toContain(p.id)
    }
  })

  it('counts a finished daily once even when storage is blocked and every record looks new', async () => {
    setItem.mockImplementation(() => {
      throw new Error('blocked')
    })
    const { user } = await renderApp()
    await user.click(button('Start climbing'))
    await playDive(user, today)
    await user.click(button('See results'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(events('dive_completed')).toHaveLength(1)
  })

  it('counts Unlimited, How to play and Share, and says what it measures', async () => {
    const { user } = await renderApp()
    expect(screen.getByText('No cookies, no tracking of what you type.', { exact: false })).toBeDefined()
    expect(screen.getByText(/We count visits and a few anonymous events with Plausible/)).toBeDefined()

    await user.click(button('How to play'))
    await user.click(button("Can, let's go"))
    expect(events('howto_opened')).toHaveLength(1)

    fireEvent.click(button(/Unlimited/))
    // Counted when the game starts, once the bank has loaded
    expect(events('unlimited_started')).toHaveLength(0)
    await settle()
    expect(events('unlimited_started')).toHaveLength(1)
    await timeOutGame(user)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })
    try {
      await user.click(button('Share result'))
    } finally {
      delete (navigator as unknown as Record<string, unknown>).clipboard
    }
    expect(events('share_tapped')).toEqual([['share_tapped', { props: { method: 'copy' } }]])

    await user.click(button('Play again'))
    expect(events('unlimited_started')).toHaveLength(2)
    // Unlimited is not the daily dive
    expect(events('dive_started')).toEqual([])
    expect(events('dive_completed')).toEqual([])
  })

  it('says nothing is measured when analytics is not configured', async () => {
    vi.stubEnv('VITE_ANALYTICS_PROVIDER', '')
    await renderApp()
    expect(screen.getByText('No cookies, no analytics.', { exact: false })).toBeDefined()
    expect(screen.getByText("This site doesn't use analytics.")).toBeDefined()
    expect(screen.queryByText(/We count visits/)).toBeNull()
    expect(plausible).not.toHaveBeenCalled()
  })
})
