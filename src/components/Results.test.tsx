// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS, SCHEDULE } from '../content'
import { promptsForDate } from '../game/schedule'
import { TIER_INFO } from '../game/scoring'
import type { Stats } from '../game/storage'
import type { RoundResult } from '../game/types'
import { Results } from './Results'

// 12:00 in Singapore on 10 Nov 2026
const NOW = Date.parse('2026-11-10T04:00:00Z')
const prompts = promptsForDate(ALL_PROMPTS, '2026-11-10', SCHEDULE)

const results: RoundResult[] = prompts.map((p, i) => {
  if (i === 0) return { promptId: p.id, input: 'nope', answer: null, tier: null, points: 0 }
  const answer = p.answers.find((a) => a.tier === 'common')!
  return { promptId: p.id, input: answer.name, answer: answer.name, tier: 'common', points: TIER_INFO.common.points }
})

const stats: Stats = {
  played: 4,
  totalScore: 900,
  bestScore: 300,
  currentStreak: 3,
  maxStreak: 3,
  lastPlayed: '2026-11-10',
  gems: 2,
}

function renderResults(dateKey: string | null) {
  render(
    <Results
      title="Ulu #15"
      results={results}
      stats={stats}
      isDaily={dateKey !== null}
      dateKey={dateKey}
      onHome={() => {}}
      onUnlimited={() => {}}
    />,
  )
}

/** Navigator properties jsdom lacks, put back after each test */
function stubNavigator(key: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, key, { value, configurable: true })
  stubbed.push(key)
}
let stubbed: string[] = []

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  cleanup()
  for (const key of stubbed) delete (navigator as unknown as Record<string, unknown>)[key]
  stubbed = []
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Results', () => {
  it('shows the score, destination and each prompt with its gem', () => {
    renderResults('2026-11-10')
    expect(screen.getByRole('img', { name: '60 of 700 points, reached Raffles Place' })).toBeDefined()
    for (const p of prompts) expect(screen.getByText(p.text)).toBeDefined()
    // Read out as e.g. "No answer . The gem: X ... Time up, 0 points"
    const missed = screen.getByText(prompts[0].text).closest('li')!.textContent
    const gem = prompts[0].answers.find((a) => a.tier === 'gem')!
    expect(missed).toContain(`The gem: ${gem.name}`)
    expect(missed).toMatch(/Time up, 0 points$/)
    const hit = screen.getByText(prompts[1].text).closest('li')!.textContent
    expect(hit).toContain(results[1].answer)
    expect(hit).toMatch(/Everybody Say, 10 points$/)
  })

  it("counts down to the next dive when the dive is today's", () => {
    renderResults('2026-11-10')
    expect(screen.getByText(/Next dive in/).textContent).toBe('Next dive in 12:00:00')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(/Next dive in/).textContent).toBe('Next dive in 11:59:59')
    expect(screen.queryByText("Today's dive is ready")).toBeNull()
  })

  it("says today's dive is ready instead of counting down for a dive finished past midnight", () => {
    renderResults('2026-11-09')
    expect(screen.getByText("Today's dive is ready")).toBeDefined()
    expect(screen.queryByText(/Next dive in/)).toBeNull()
  })

  it('shows no stats or countdown for Unlimited', () => {
    renderResults(null)
    expect(screen.queryByText('Streak')).toBeNull()
    expect(screen.queryByText(/Next dive in|Today's dive is ready/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeDefined()
  })

  it('copies the share text when there is no share sheet', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    stubNavigator('clipboard', { writeText })
    renderResults('2026-11-10')

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Share result' })))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]).toEqual([expect.stringMatching(/^Ulu #15 🇸🇬 60\/700\n❌⚪⚪⚪⚪⚪⚪\n/)])
    expect(screen.getByRole('button', { name: 'Copied! Go paste in the group chat' })).toBeDefined()

    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('button', { name: 'Share result' })).toBeDefined()
  })

  it('opens the share sheet on touch devices', async () => {
    const share = vi.fn(() => Promise.resolve())
    const writeText = vi.fn(() => Promise.resolve())
    stubNavigator('share', share)
    stubNavigator('clipboard', { writeText })
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }))
    renderResults('2026-11-10')

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Share result' })))
    expect(share).toHaveBeenCalledWith({ text: expect.stringContaining('Ulu #15') })
    expect(writeText).not.toHaveBeenCalled()
  })
})
