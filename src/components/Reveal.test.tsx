// @vitest-environment jsdom
import { cleanup, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS } from '../content'
import { mulberry32, shuffle } from '../game/daily'
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
  return { promptId: prompt.id, input: answer.name, answer: answer.name, tier, points: TIER_INFO[tier].points }
}
const miss: RoundResult = { promptId: prompt.id, input: '', answer: null, tier: null, points: 0 }

function renderReveal(result: RoundResult) {
  const onNext = vi.fn()
  render(<Reveal prompt={prompt} result={result} isLast={false} onNext={onNext} />)
  const details = document.querySelector('details.all-answers') as HTMLDetailsElement
  return { onNext, details }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Reveal', () => {
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

  it('shows every accepted answer behind a closed disclosure, grouped by tier, deepest first', async () => {
    const user = userEvent.setup()
    const { details } = renderReveal(hit('rare'))
    expect(details.open).toBe(false)
    const summary = within(details).getByText(`Show all ${prompt.answers.length} answers`)
    expect(summary.tagName).toBe('SUMMARY')

    const groups = [...details.querySelectorAll('.all-answers__group')]
    expect(groups.map((g) => g.className.match(/tier--(\w+)/)![1])).toEqual(['gem', 'ulu', 'rare', 'solid', 'trap', 'common'])
    // Read as e.g. "Sibei Ulu · 100 points", with the emoji hidden from screen readers
    const label = groups[0].querySelector('.all-answers__tier')!
    expect(label.querySelector('[aria-hidden="true"]')!.textContent).toBe(TIER_INFO.gem.emoji)
    expect(label.textContent).toContain(`${TIER_INFO.gem.label} · 100`)
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
})
