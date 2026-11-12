// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS } from '../content/bank'
import { mulberry32, shuffle } from '../game/daily'
import { STAGES } from '../game/elevator'
import { buildReportUrl } from '../game/report'
import { TIER_INFO } from '../game/scoring'
import { TIERS, type Prompt, type RoundResult, type Tier } from '../game/types'
import { Reveal } from './Reveal'

// A real prompt with an answer in every tier
const prompt = ALL_PROMPTS.find((p) => TIERS.every((t) => p.answers.some((a) => a.tier === t)))!

function answerOf(p: Prompt, tier: Tier) {
  const answer = p.answers.find((a) => a.tier === tier)
  if (!answer) throw new Error(`${p.id} has no ${tier} answer`)
  return answer
}

const hit = (tier: Tier): RoundResult => {
  const answer = answerOf(prompt, tier)
  return { promptId: prompt.id, input: answer.name, attempts: [], answer: answer.name, tier, points: TIER_INFO[tier].points }
}
const miss: RoundResult = { promptId: prompt.id, input: '', attempts: [], answer: null, tier: null, points: 0 }

function renderReveal(result: RoundResult, reportDate?: string, extra: Partial<Parameters<typeof Reveal>[0]> = {}) {
  const onNext = vi.fn()
  render(<Reveal prompt={prompt} result={result} isLast={false} reportDate={reportDate} onNext={onNext} {...extra} />)
  const details = document.querySelector('details.all-answers') as HTMLDetailsElement
  return { onNext, details }
}

beforeEach(() => {
  // No player form configured unless a test sets one, whatever the local .env says
  vi.stubEnv('VITE_REPORT_URL', '')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('Reveal', () => {
  it('keeps a held Enter from rushing past the result', async () => {
    const { onNext } = renderReveal(hit('common'))
    const next = screen.getByRole('button', { name: 'Next question →' })
    expect(fireEvent.keyDown(next, { key: 'Enter', repeat: true })).toBe(false)
    expect(onNext).not.toHaveBeenCalled()
    await userEvent.setup().keyboard('{Enter}')
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('runs on a prompt with every tier', () => {
    expect(prompt).toBeDefined()
  })

  it('samples up to 3 other answers per tier with the unbiased shuffle, leaving out the gem and the player’s answer', () => {
    // Seeded, so the expected pick can be worked out with the same shuffle() and random sequence
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(7))
    const rand = mulberry32(7)
    const rare = answerOf(prompt, 'rare')
    renderReveal(hit('rare'))

    const expected = (['ulu', 'rare', 'solid', 'trap', 'common'] as const).map((tier) => {
      const names = prompt.answers.filter((a) => a.tier === tier && a.name !== rare.name).map((a) => a.name)
      return [tier, shuffle(names, rand).slice(0, 3)] as const
    })
    const rows = [...document.querySelectorAll('.samples__row')]
    expect(rows.map((row) => row.className.match(/tier--(\w+)/)![1])).toEqual(expected.map(([tier]) => tier))
    for (const [i, [, names]] of expected.entries()) {
      expect(names.length).toBeGreaterThan(0)
      expect(names.length).toBeLessThanOrEqual(3)
      expect(names).not.toContain(rare.name)
      expect(rows[i].querySelector('.samples__names')!.textContent).toBe(names.join(', '))
    }
  })

  it('says how rare the answer was, what it scored and how far the lift went', () => {
    renderReveal(hit('rare'), undefined, { floor: 16 })
    const verdict = document.querySelector('.verdict')!
    expect(verdict.classList.contains('tier--rare')).toBe(true)
    expect(verdict.querySelector('.verdict__label')!.textContent).toBe('Steady')
    expect(verdict.querySelector('.verdict__floors')!.textContent).toBe('▲12')
    expect(verdict.querySelector('.verdict__points')!.textContent).toBe('+60 points')
    expect(verdict.querySelector('.verdict__blurb')!.textContent).toBe(`${TIER_INFO.rare.blurb} Up 12 floors, now on floor 16.`)
    // Read out with the Next button
    const next = screen.getByRole('button', { name: /Next question/ })
    expect(document.getElementById(next.getAttribute('aria-describedby')!)!.contains(verdict)).toBe(true)
    expect(document.querySelector('.upgrade')).toBeNull()
  })

  it('says the lift stayed put after a miss', () => {
    renderReveal(miss, undefined, { floor: 3 })
    const verdict = document.querySelector('.verdict')!
    expect(verdict.classList.contains('verdict--miss')).toBe(true)
    expect(verdict.querySelector('.verdict__label')!.textContent).toBe('Time up!')
    expect(verdict.querySelector('.verdict__floors')!.textContent).toBe('–')
    expect(verdict.querySelector('.verdict__blurb')!.textContent).toBe('The lift stays where it is. No floors gained, now on floor 03.')
    expect(verdict.querySelector('.verdict__points')!.textContent).toBe('+0 points')
  })

  it('announces a new lift with the verdict when the answer unlocked one', () => {
    renderReveal(hit('gem'), undefined, { floor: 20, upgrade: STAGES[1] })
    expect(document.querySelector('.upgrade')!.textContent).toBe('New lift unlocked Upgraded HDB Lift')
    const next = screen.getByRole('button', { name: /Next question/ })
    expect(document.getElementById(next.getAttribute('aria-describedby')!)!.textContent).toContain('New lift unlocked Upgraded HDB Lift')
  })

  it('shows every accepted answer behind a closed disclosure, grouped by tier, deepest first', async () => {
    const user = userEvent.setup()
    const { details } = renderReveal(hit('rare'))
    expect(details.open).toBe(false)
    const summary = within(details).getByText(`Show all ${prompt.answers.length} answers`)
    expect(summary.tagName).toBe('SUMMARY')

    const groups = [...details.querySelectorAll('.all-answers__group')]
    expect(groups.map((g) => g.className.match(/tier--(\w+)/)![1])).toEqual(['gem', 'ulu', 'rare', 'solid', 'trap', 'common'])
    // Read as e.g. "Sibei Ulu · 100 points": the tier's lamp is decoration, hidden from screen readers
    const label = groups[0].querySelector('.all-answers__tier')!
    expect(label.querySelector('.lamp--gem')!.getAttribute('aria-hidden')).toBe('true')
    expect(label.textContent).toContain(`${TIER_INFO.gem.label} · 100`)
    // No emoji standing in for artwork
    expect(document.querySelector('.reveal')!.textContent).not.toMatch(/[⚪🟡🟢🔵🟣💎❌]/u)
    // Each tier's list is named by its label, without the emoji or the visual "pts"
    expect(within(groups[0] as HTMLElement).getByRole('list', { name: 'Sibei Ulu · 100 points' })).toBeDefined()

    for (const [i, tier] of ['gem', 'ulu', 'rare', 'solid', 'trap', 'common'].entries()) {
      const list = within(groups[i] as HTMLElement).getByRole('list', { name: new RegExp(TIER_INFO[tier as Tier].label) })
      const names = within(list)
        .getAllByRole('listitem')
        .map((li) => li.firstChild!.textContent)
      const expected = prompt.answers
        .filter((a) => a.tier === tier)
        .map((a) => a.name)
        .sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(expected)
    }
    expect(details.querySelectorAll('.all-answers__names li')).toHaveLength(prompt.answers.length)

    await user.click(summary)
    expect(details.open).toBe(true)
  })

  it("marks the player's own answer in the full list", () => {
    const rare = answerOf(prompt, 'rare')
    const { details } = renderReveal(hit('rare'))
    const marked = [...details.querySelectorAll('.all-answers__yours')]
    expect(marked).toHaveLength(1)
    expect(marked[0].textContent).toBe(`${rare.name}, your answer`)
  })

  it('marks nothing after a miss', () => {
    const { details } = renderReveal(miss)
    expect(details.querySelector('.all-answers__yours')).toBeNull()
    expect(within(details).queryByText(/your answer/)).toBeNull()
  })

  it('lists the rejected guesses and links to report them as a missing answer', () => {
    const guesses = ['zzqq', 'Pulau Hantu & co']
    renderReveal({ ...miss, attempts: guesses }, '2026-11-10')
    const list = screen.getByRole('list', { name: 'Not on our list' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['“zzqq”', '“Pulau Hantu & co”'])

    const link = screen.getByRole('link', { name: /^Should this count\?/ })
    expect(link.getAttribute('href')).toBe(
      buildReportUrl({ kind: 'missing', date: '2026-11-10', promptId: prompt.id, guesses }),
    )
    expect(new URL(link.getAttribute('href')!).searchParams.get('answer')).toBe('zzqq; Pulau Hantu & co')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toContain('(opens in a new tab)')
  })

  it('shows no guesses or missing-answer link when nothing was rejected', () => {
    renderReveal(hit('common'), '2026-11-10')
    expect(screen.queryByRole('list', { name: 'Not on our list' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Should this count/ })).toBeNull()
  })

  it('offers wrong-answer and tier reports under the full list, dated "unlimited" without a dive date', () => {
    const { details } = renderReveal(hit('common'))
    const wrong = within(details).getByRole('link', { name: /^An answer is wrong/ })
    const tier = within(details).getByRole('link', { name: /^A tier feels off/ })
    expect(wrong.getAttribute('href')).toBe(buildReportUrl({ kind: 'wrong', date: 'unlimited', promptId: prompt.id }))
    expect(tier.getAttribute('href')).toBe(buildReportUrl({ kind: 'tier', date: 'unlimited', promptId: prompt.id }))
  })
})
