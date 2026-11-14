// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS, SCHEDULE } from '../content/bank'
import { STAGES } from '../game/elevator'
import { buildReportUrl } from '../game/report'
import { promptsForDate } from '../game/schedule'
import { TIER_INFO } from '../game/scoring'
import type { Stats } from '../game/storage'
import type { RoundResult } from '../game/types'
import { loadBackdrops } from './elevator/backdrops'
import { Results } from './Results'

// 12:00 in Singapore on 10 Nov 2026
const NOW = Date.parse('2026-11-10T04:00:00Z')
const prompts = promptsForDate(ALL_PROMPTS, '2026-11-10', SCHEDULE)

// Rejected guesses for round 1, with characters that need encoding
const GUESSES = ['Pulau Hantu & co', 'Count On Me, Singapore']

const results: RoundResult[] = prompts.map((p, i) => {
  if (i === 0) return { promptId: p.id, input: 'nope', attempts: GUESSES, answer: null, tier: null, points: 0 }
  const answer = p.answers.find((a) => a.tier === 'common')!
  // Round 2 locked in after one rejected guess
  const attempts = i === 1 ? ['zzqq'] : []
  return { promptId: p.id, input: answer.name, attempts, answer: answer.name, tier: 'common', points: TIER_INFO.common.points }
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
      prompts={prompts}
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

// Every lift's scenery, up front, so none of it arrives halfway through a test
beforeAll(() => loadBackdrops())

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(NOW)
  // No player form configured unless a test sets one, whatever the local .env says
  vi.stubEnv('VITE_REPORT_URL', '')
})

afterEach(() => {
  cleanup()
  for (const key of stubbed) delete (navigator as unknown as Record<string, unknown>)[key]
  stubbed = []
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const row = (i: number) => screen.getByText(prompts[i].text).closest('li')!

describe('Results', () => {
  it('shows the score, the lift reached, and each prompt with its gem', () => {
    renderResults('2026-11-10')
    // Six common answers and a miss: 60 points, still in the first lift
    expect(document.querySelector('.results__number')!.textContent).toBe('60')
    expect(document.querySelector('.results__reached')!.textContent).toBe(`HDB Lift. ${STAGES[0].blurb}`)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Heartland hero')
    for (const p of prompts) expect(screen.getByText(p.text)).toBeDefined()
    // Read out as e.g. "No answer . The gem: X ... Time up, 0 points"
    const missed = screen.getByText(prompts[0].text).closest('li')!.textContent
    const gem = prompts[0].answers.find((a) => a.tier === 'gem')!
    expect(missed).toContain(`The gem: ${gem.name}`)
    const points = (i: number) => screen.getByText(prompts[i].text).closest('li')!.querySelector('.breakdown__points')!
    expect(points(0).textContent).toBe('Time up, 0 points')
    const hit = screen.getByText(prompts[1].text).closest('li')!.textContent
    expect(hit).toContain(results[1].answer)
    expect(points(1).textContent).toBe('Everybody Say, 10 points')
  })

  it('shows the final lift with the boy in it, and a lamp for each of the seven answers', () => {
    renderResults('2026-11-10')
    const scene = document.querySelector('.scene') as HTMLElement
    expect(scene.dataset.lift).toBe('hdb')
    expect(scene.dataset.floor).toBe('12')
    expect(scene.classList.contains('scene--open')).toBe(true)
    expect(scene.querySelector('.boy')).not.toBeNull()
    // A modest score is no reason for confetti, or for anything gloomy
    expect(document.querySelector('.confetti')).toBeNull()

    const lamps = within(screen.getByRole('list', { name: 'Your seven answers' })).getAllByRole('listitem')
    expect(lamps.map((li) => li.textContent)).toEqual([
      'Question 1: Time up',
      ...prompts.slice(1).map((_, i) => `Question ${i + 2}: Everybody Say`),
    ])
    expect(lamps[0].querySelector('.lamp--miss')).not.toBeNull()
    expect(lamps[1].querySelector('.lamp--common')).not.toBeNull()
  })

  it('celebrates a perfect game at the top of the penthouse', () => {
    const perfect: RoundResult[] = prompts.map((p) => {
      const gem = p.answers.find((a) => a.tier === 'gem')!
      return { promptId: p.id, input: gem.name, attempts: [], answer: gem.name, tier: 'gem', points: TIER_INFO.gem.points }
    })
    render(<Results title="Ulu #15" results={perfect} prompts={prompts} isDaily dateKey="2026-11-10" onHome={() => {}} onUnlimited={() => {}} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Perfect climb')
    expect(document.querySelector('.results__reached')!.textContent).toBe(
      'Sky Penthouse. All the way up. The doors open, and he blows another bubble.',
    )
    const scene = document.querySelector('.scene') as HTMLElement
    expect(scene.dataset.lift).toBe('penthouse')
    expect(scene.dataset.floor).toBe('140')
    expect(document.querySelector('.confetti--fall')).not.toBeNull()
  })

  it('keeps the way home at the top and the next game beside Share, so neither needs scrolling to', () => {
    const onHome = vi.fn()
    const onUnlimited = vi.fn()
    render(
      <Results title="Ulu #15" results={results} prompts={prompts} stats={stats} isDaily dateKey="2026-11-10" onHome={onHome} onUnlimited={onUnlimited} />,
    )
    const home = screen.getByRole('button', { name: 'Home' })
    expect(home.closest('.results__top')).not.toBeNull()
    const unlimited = screen.getByRole('button', { name: 'Unlimited' })
    expect(unlimited.closest('.dock')).toBe(screen.getByRole('button', { name: 'Share result' }).closest('.dock'))
    // Nothing else to press below the cards
    expect(document.querySelector('.extras button')).toBeNull()

    fireEvent.click(home)
    expect(onHome).toHaveBeenCalledTimes(1)
    fireEvent.click(unlimited)
    expect(onUnlimited).toHaveBeenCalledTimes(1)
  })

  it('folds each question into one closed row, which opens to every answer, deepest tier first', async () => {
    renderResults('2026-11-10')
    const rows = within(screen.getByRole('list', { name: 'Your answers' })).getAllByRole('listitem').filter((li) =>
      li.classList.contains('breakdown__row'),
    )
    expect(rows).toHaveLength(prompts.length)
    for (const [i, row] of rows.entries()) {
      const details = row.querySelector('details') as HTMLDetailsElement
      expect(details.open).toBe(false)
      // The row says the question, the answer and what it scored
      const summary = details.querySelector('summary')!
      expect(summary.textContent).toBe(
        `${prompts[i].text}${results[i].answer ?? 'No answer'}${results[i].tier ? 'Everybody Say' : 'Time up'}, ${results[i].points} points`,
      )
      expect(details.querySelectorAll('.all-answers__names li')).toHaveLength(prompts[i].answers.length)
      const tiers = [...details.querySelectorAll('.all-answers__group')].map((g) => g.className.match(/tier--(\w+)/)![1])
      expect(tiers[0]).toBe('gem')
      expect(tiers.at(-1)).toBe('common')
      // The player's answer is marked; a miss marks nothing
      const marked = [...details.querySelectorAll('.all-answers__yours')].map((li) => li.firstChild!.textContent)
      expect(marked).toEqual(results[i].answer ? [results[i].answer] : [])
    }
    fireEvent.click(rows[0].querySelector('summary')!)
    expect((rows[0].querySelector('details') as HTMLDetailsElement).open).toBe(true)
  })

  it("shows each prompt's rejected guesses with a link to report them as a missing answer", () => {
    renderResults('2026-11-10')
    const guesses = within(row(0)).getByRole('list', { name: 'Not on our list' })
    expect(within(guesses).getAllByRole('listitem').map((li) => li.textContent)).toEqual(GUESSES.map((g) => `“${g}”`))

    const link = within(row(0)).getByRole('link', { name: /^Should this count\?/ })
    expect(link.textContent).toContain(`for ${prompts[0].text}`)
    expect(link.textContent).toContain('(opens in a new tab)')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    const href = link.getAttribute('href')!
    expect(href).toBe(buildReportUrl({ kind: 'missing', date: '2026-11-10', promptId: prompts[0].id, guesses: GUESSES }))
    // The team's GitHub issue form, prefilled
    const url = new URL(href)
    expect(url.origin + url.pathname).toBe('https://github.com/christiantio/ulu/issues/new')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      template: 'answer-report.yml',
      kind: 'Missing answer',
      prompt: prompts[0].id,
      dive: '2026-11-10',
      answer: 'Pulau Hantu & co; Count On Me, Singapore',
    })

    // A round that locked in after a rejected guess still shows it
    expect(within(within(row(1)).getByRole('list', { name: 'Not on our list' })).getByText('“zzqq”')).toBeDefined()
    // No guesses, no list or link
    expect(within(row(2)).queryByRole('list', { name: 'Not on our list' })).toBeNull()
    expect(within(row(2)).queryByRole('link', { name: /Should this count/ })).toBeNull()
  })

  it('offers wrong-answer and tier reports for every prompt', () => {
    renderResults('2026-11-10')
    for (const [i, p] of prompts.entries()) {
      const wrong = within(row(i)).getByRole('link', { name: /^An answer is wrong/ })
      const tier = within(row(i)).getByRole('link', { name: /^A tier feels off/ })
      expect(wrong.getAttribute('href')).toBe(buildReportUrl({ kind: 'wrong', date: '2026-11-10', promptId: p.id }))
      expect(tier.getAttribute('href')).toBe(buildReportUrl({ kind: 'tier', date: '2026-11-10', promptId: p.id }))
      expect(new URL(tier.getAttribute('href')!).searchParams.get('kind')).toBe('Tier feels off')
      for (const link of [wrong, tier]) {
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.textContent).toContain('(opens in a new tab)')
      }
    }
  })

  it('reports Unlimited games as "unlimited"', () => {
    renderResults(null)
    const href = within(row(0)).getByRole('link', { name: /^Should this count\?/ }).getAttribute('href')!
    expect(new URL(href).searchParams.get('dive')).toBe('unlimited')
    const wrong = within(row(3)).getByRole('link', { name: /^An answer is wrong/ }).getAttribute('href')!
    expect(new URL(wrong).searchParams.get('dive')).toBe('unlimited')
  })

  it('links to the player form when VITE_REPORT_URL is set', () => {
    vi.stubEnv('VITE_REPORT_URL', 'https://tally.so/r/ulu?date={date}&prompt={prompt}&guesses={guesses}&kind={kind}')
    renderResults('2026-11-10')
    const href = within(row(0)).getByRole('link', { name: /^Should this count\?/ }).getAttribute('href')
    expect(href).toBe(
      `https://tally.so/r/ulu?date=2026-11-10&prompt=${prompts[0].id}` +
        '&guesses=Pulau%20Hantu%20%26%20co%3B%20Count%20On%20Me%2C%20Singapore&kind=Missing%20answer',
    )
  })

  it("counts down to the next game when the game is today's", () => {
    renderResults('2026-11-10')
    expect(screen.getByText(/Next climb in/).textContent).toBe('Next climb in 12:00:00')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText(/Next climb in/).textContent).toBe('Next climb in 11:59:59')
    expect(screen.queryByText("Today's climb is ready")).toBeNull()
  })

  it("says today's game is ready instead of counting down for one finished past midnight", () => {
    renderResults('2026-11-09')
    expect(screen.getByText("Today's climb is ready")).toBeDefined()
    expect(screen.queryByText(/Next climb in/)).toBeNull()
  })

  it('shows no stats or countdown for Unlimited', () => {
    renderResults(null)
    expect(screen.queryByText('Streak')).toBeNull()
    expect(screen.queryByText(/Next climb in|Today's climb is ready/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeDefined()
  })

  it('copies the share text when there is no share sheet', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve())
    stubNavigator('clipboard', { writeText })
    renderResults('2026-11-10')

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Share result' })))
    expect(writeText).toHaveBeenCalledTimes(1)
    // Spoiler-free: just the score, the grid, and the lift reached, none of the answer lists
    expect(writeText.mock.calls[0]).toEqual([`Ulu #15 🇸🇬 60/700\n❌⚪⚪⚪⚪⚪⚪\nHDB Lift\n${window.location.origin}`])
    expect(writeText.mock.calls[0][0]).not.toMatch(/MRT|train|Raffles|station/i)
    expect(writeText.mock.calls[0][0]).not.toContain('Show all')
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
