// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
import { ALL_PROMPTS, SCHEDULE } from './content'
import { mulberry32 } from './game/daily'
import { promptsForDate } from './game/schedule'
import { SECONDS_PER_ROUND } from './game/scoring'
import type { DailyProgress, Stats } from './game/storage'
import type { Prompt, RoundResult } from './game/types'

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
  answer: common(p).name,
  tier: 'common',
  points: 10,
})

type User = ReturnType<typeof userEvent.setup>

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const read = <T,>(key: string): T | null => JSON.parse(localStorage.getItem(key) ?? 'null')
const statsLine = () => screen.getByText(/ dives · /).textContent
const promptHeading = () => screen.getByRole('heading', { level: 2 }).textContent
const button = (name: string | RegExp) => screen.getByRole('button', { name })

function saveProgress(progress: Partial<DailyProgress>) {
  const full: DailyProgress = { dateKey: TODAY, promptIds: today.map((p) => p.id), results: [], startedAt: null, ...progress }
  localStorage.setItem('ulu:daily', JSON.stringify(full))
}

function saveStats(stats: Partial<Stats>) {
  localStorage.setItem('ulu:stats', JSON.stringify(stats))
}

function renderApp() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const view = render(<App />)
  return { user, ...view }
}

/** Start the round shown on the ready screen, check its prompt, and answer it with its first common answer */
async function playRound(user: User, expected: Prompt) {
  await user.click(button(/^(Start dive|Go)$/))
  expect(promptHeading()).toBe(expected.text)
  await user.type(screen.getByRole('textbox', { name: 'Your answer' }), `${common(expected).name}{Enter}`)
  expect(screen.getByText('Everybody Say', { selector: '.verdict__label' })).toBeDefined()
}

async function playDive(user: User, prompts: Prompt[], from = 0) {
  for (let i = from; i < prompts.length; i++) {
    await playRound(user, prompts[i])
    if (i < prompts.length - 1) await user.click(button(/Next prompt/))
  }
}

let setItem: MockInstance<Storage['setItem']>
const statsWrites = () => setItem.mock.calls.filter(([key]) => key === 'ulu:stats').length

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(NOON)
  // Testing Library only recognises Jest's fake timers: without this, its async wrapper waits on a faked setTimeout
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  localStorage.clear()
  localStorage.setItem('ulu:seen-help', 'true')
  setItem = vi.spyOn(Storage.prototype, 'setItem')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
    const { user, unmount } = renderApp()
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(screen.queryByText(/ dives · /)).toBeNull()

    await user.click(button("Start today's dive"))
    await playRound(user, today[0])
    expect(read<DailyProgress>('ulu:daily')).toEqual({
      dateKey: TODAY,
      promptIds: SCHEDULE[TODAY],
      results: [hit(today[0])],
      startedAt: null,
    })

    // A reload picks the dive back up where it was left
    unmount()
    const again = renderApp()
    await again.user.click(button('Continue dive (1/7)'))
    expect(screen.getByText('Prompt 2 of 7')).toBeDefined()
    await again.user.click(button('Go'))
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ results: [hit(today[0])], startedAt: Date.now() })
    await again.user.type(screen.getByRole('textbox', { name: 'Your answer' }), `${common(today[1]).name}{Enter}`)
    await again.user.click(button(/Next prompt/))
    await playDive(again.user, today, 2)
    expect(read<DailyProgress>('ulu:daily')?.results).toEqual(today.map(hit))

    // Recorded as soon as the last round ends, before the results screen
    expect(statsWrites()).toBe(1)
    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, totalScore: 70, currentStreak: 1, lastPlayed: TODAY })

    await again.user.click(button('See results'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(screen.getByRole('img', { name: '70 of 700 points, reached Raffles Place' })).toBeDefined()
    await again.user.click(button('Home'))
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')
    expect(screen.queryByRole('button', { name: /Start today's dive|Continue dive/ })).toBeNull()

    await again.user.click(button("See today's results"))
    await again.user.click(button('Home'))
    again.unmount()
    renderApp()
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')
    expect(statsWrites()).toBe(1)
  })

  it('resumes a round in progress with its original deadline after a reload', async () => {
    const { user, unmount } = renderApp()
    await user.click(button("Start today's dive"))
    await user.click(button('Start dive'))
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ results: [], startedAt: NOON })
    advance(10_000)

    unmount()
    const again = renderApp()
    // No round finished yet, so the home screen still says "Start", but the clock carries on
    await again.user.click(button("Start today's dive"))
    // Straight back into the same prompt, without a ready screen and without a fresh clock
    expect(screen.queryByRole('button', { name: 'Start dive' })).toBeNull()
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
    const { user } = renderApp()
    await user.click(button('Continue dive (2/7)'))
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(screen.getByText('Round 3: Time up, 0 points')).toBeDefined()
    expect(read<DailyProgress>('ulu:daily')?.results).toHaveLength(3)
  })

  it('records a finished daily even when the player leaves from the last reveal without seeing results', async () => {
    const { user, unmount } = renderApp()
    await user.click(button("Start today's dive"))
    await playDive(user, today)

    // Still on the last reveal: nothing on the home screen has had a chance to record it
    expect(button('See results')).toBeDefined()
    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, lastPlayed: TODAY, totalScore: 70 })

    await user.click(button('Back to home'))
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')

    unmount()
    renderApp()
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')
    expect(statsWrites()).toBe(1)
  })

  it('records a finished dive that was saved without reaching the stats', () => {
    saveProgress({ results: today.map(hit) })
    renderApp()
    expect(screen.getByText('Done for today:', { exact: false }).textContent).toBe('Done for today: 70 pts')
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')
    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, lastPlayed: TODAY })
  })

  it('opens How to play on the first visit only', async () => {
    localStorage.removeItem('ulu:seen-help')
    const { user, unmount } = renderApp()
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeDefined()
    await user.click(button("Can, let's go"))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem('ulu:seen-help')).toBe('true')

    unmount()
    const again = renderApp()
    expect(screen.queryByRole('dialog')).toBeNull()
    await again.user.click(button('How to play'))
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeDefined()
    await again.user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('midnight rollover (#7)', () => {
  it('moves the home screen to the new dive after Singapore midnight', () => {
    vi.setSystemTime(BEFORE_MIDNIGHT)
    saveProgress({ results: today.map(hit) })
    saveStats({ played: 1, totalScore: 70, bestScore: 70, currentStreak: 1, maxStreak: 1, lastPlayed: TODAY })
    renderApp()
    expect(screen.getByText('Ulu #15')).toBeDefined()
    expect(screen.getByText('Done for today:', { exact: false })).toBeDefined()

    advance(60_000) // 00:00:00, just before the timer is due
    expect(screen.getByText('Ulu #15')).toBeDefined()
    advance(1_000)
    expect(screen.getByText('Ulu #16')).toBeDefined()
    expect(screen.queryByText('Done for today:', { exact: false })).toBeNull()
    expect(button("Start today's dive")).toBeDefined()
    // Yesterday's dive keeps the streak alive
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')
  })

  it.each([
    ['visibilitychange', () => document.dispatchEvent(new Event('visibilitychange'))],
    ['focus', () => window.dispatchEvent(new Event('focus'))],
  ])('checks the date again on %s after the clock jumps, as when a phone wakes', (_, wake) => {
    vi.setSystemTime(BEFORE_MIDNIGHT)
    renderApp()
    expect(screen.getByText('Ulu #15')).toBeDefined()

    // Setting the clock doesn't fire timers, so only the event can move the screen on
    vi.setSystemTime(Date.parse('2026-11-11T01:00:00Z'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    act(wake)
    expect(screen.getByText('Ulu #16')).toBeDefined()
  })

  it('lets a dive started before midnight finish with its own prompts, counted for the day it started', async () => {
    expect(new Set([...today, ...tomorrow].map((p) => p.text)).size).toBe(14)
    vi.setSystemTime(Date.parse('2026-11-10T15:58:00Z'))
    const { user } = renderApp()
    await user.click(button("Start today's dive"))
    for (let i = 0; i < 3; i++) {
      await playRound(user, today[i])
      if (i < 2) await user.click(button(/Next prompt/))
    }

    // Midnight passes while reading the third reveal (no round running)
    advance(3 * 60_000)
    expect(new Date().toISOString()).toBe('2026-11-10T16:01:00.000Z')
    await user.click(button(/Next prompt/))
    await playDive(user, today, 3)

    expect(read<Stats>('ulu:stats')).toMatchObject({ played: 1, lastPlayed: TODAY, totalScore: 70 })
    expect(read<DailyProgress>('ulu:daily')).toMatchObject({ dateKey: TODAY, promptIds: SCHEDULE[TODAY] })

    await user.click(button('See results'))
    expect(screen.getByText('Ulu #15')).toBeDefined()
    for (const p of today) expect(screen.getByText(p.text)).toBeDefined()
    expect(screen.getByText("Today's dive is ready")).toBeDefined()
    expect(screen.queryByText(/Next dive in/)).toBeNull()

    await user.click(button('Home'))
    expect(screen.getByText('Ulu #16')).toBeDefined()
    expect(button("Start today's dive")).toBeDefined()
    expect(statsLine()).toBe('1 dives · 1 day streak · best 70')

    // And tomorrow's dive is the new day's prompts
    await user.click(button("Start today's dive"))
    await user.click(button('Start dive'))
    expect(promptHeading()).toBe(tomorrow[0].text)
  })
})

describe('Unlimited (#6)', () => {
  it("never shows today's daily prompts", async () => {
    const dailyTexts = new Set(today.map((p) => p.text))
    expect(new Set(ALL_PROMPTS.map((p) => p.text)).size).toBe(ALL_PROMPTS.length)
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(42))

    const { user } = renderApp()
    await user.click(button(/Unlimited/))
    for (let game = 0; game < 5; game++) {
      const seen: string[] = []
      for (let i = 0; i < 7; i++) {
        await user.click(button(/^(Start dive|Go)$/))
        seen.push(promptHeading()!)
        advance(SECONDS_PER_ROUND * 1000)
        await user.click(button(i < 6 ? /Next prompt/ : 'See results'))
      }
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

  it('shows a 0 day streak once a whole day passed without a dive', () => {
    saveStats(stats)
    renderApp()
    expect(statsLine()).toBe('5 dives · 0 day streak · best 300')
  })

  it('keeps the streak while yesterday was played and today is not yet', () => {
    saveStats({ ...stats, lastPlayed: '2026-11-09' })
    renderApp()
    expect(statsLine()).toBe('5 dives · 5 day streak · best 300')
  })
})
