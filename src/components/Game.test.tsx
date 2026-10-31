// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS, SCHEDULE } from '../content/bank'
import { promptsForDate } from '../game/schedule'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult, Tier } from '../game/types'
import { Game } from './Game'

const NOW = Date.parse('2026-11-10T04:00:00Z')
const prompts = promptsForDate(ALL_PROMPTS, '2026-11-10', SCHEDULE)

function answerOf(p: Prompt, tier: Tier) {
  const answer = p.answers.find((a) => a.tier === tier)
  if (!answer) throw new Error(`${p.id} has no ${tier} answer`)
  return answer
}

const result = (p: Prompt, tier: Tier): RoundResult => {
  const answer = answerOf(p, tier)
  return { promptId: p.id, input: answer.name, attempts: [], answer: answer.name, tier, points: TIER_INFO[tier].points }
}

function setup(props: Partial<Parameters<typeof Game>[0]> = {}) {
  const onProgress = vi.fn<(results: RoundResult[], startedAt: number | null) => void>()
  const onFinish = vi.fn<(results: RoundResult[]) => void>()
  const onQuit = vi.fn()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<Game title="Ulu #15" prompts={prompts} onProgress={onProgress} onFinish={onFinish} onQuit={onQuit} {...props} />)
  return { onProgress, onFinish, onQuit, user }
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const secondsLeft = (n: number) => within(screen.getByRole('timer')).getByText(`${n} seconds left`)
const answerBox = () => screen.getByRole('textbox', { name: 'Your answer' })
const pip = (text: string) => within(screen.getByRole('list', { name: 'Rounds' })).getByText(text)

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(NOW)
  // Testing Library only recognises Jest's fake timers: without this, its async wrapper waits on a faked setTimeout
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Game', () => {
  it('waits for a tap before starting the clock', async () => {
    const { onProgress, user } = setup()
    expect(screen.getByText('Prompt 1 of 7')).toBeDefined()
    expect(screen.queryByRole('timer')).toBeNull()
    expect(pip('Round 1')).toBeDefined()
    expect(pip('Round 2, not played yet')).toBeDefined()

    advance(60_000)
    expect(onProgress).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Start dive' }))
    expect(screen.getByRole('heading', { level: 2, name: prompts[0].text })).toBeDefined()
    expect(secondsLeft(SECONDS_PER_ROUND)).toBeDefined()
    expect(onProgress).toHaveBeenLastCalledWith([], Date.now())
  })

  it('resumes a round with its original deadline, so refreshing cannot reset the clock', () => {
    const startedAt = NOW - 20_000
    const { onProgress, onFinish } = setup({ initialResults: [result(prompts[0], 'common')], initialStartedAt: startedAt })

    // Straight back into round 2, with 5 of the 25 seconds left
    expect(screen.queryByText('Prompt 2 of 7')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: prompts[1].text })).toBeDefined()
    expect(secondsLeft(5)).toBeDefined()
    expect(pip('Round 1: Everybody Say, 10 points')).toBeDefined()

    advance(5000)
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(pip('Round 2: Time up, 0 points')).toBeDefined()
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(
      [
        result(prompts[0], 'common'),
        { promptId: prompts[1].id, input: '', attempts: [], answer: null, tier: null, points: 0 },
      ],
      null,
    )
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('times a resumed round out at once if its deadline passed while away', () => {
    const { onProgress } = setup({ initialStartedAt: NOW - 60_000 })
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(onProgress).toHaveBeenCalledWith([expect.objectContaining({ promptId: prompts[0].id, points: 0 })], null)
  })

  it('reports progress as each round starts and ends, and the results at the end', async () => {
    const { onProgress, onFinish, onQuit, user } = setup()
    const tiers: Tier[] = ['rare', 'common', 'gem', 'solid', 'trap', 'ulu', 'common']
    const expected: RoundResult[] = []

    for (const [i, p] of prompts.entries()) {
      await user.click(screen.getByRole('button', { name: i === 0 ? 'Start dive' : 'Go' }))
      const startedAt = Date.now()
      expect(onProgress).toHaveBeenLastCalledWith(expected, startedAt)
      expect(screen.getByRole('heading', { level: 2, name: p.text })).toBeDefined()

      const tier = p.answers.some((a) => a.tier === tiers[i]) ? tiers[i] : 'common'
      advance(1000)
      await user.type(answerBox(), `${answerOf(p, tier).name}{Enter}`)
      expected.push(result(p, tier))
      expect(onProgress).toHaveBeenLastCalledWith(expected, null)

      const score = expected.reduce((sum, r) => sum + r.points, 0)
      expect(pip(`Round ${i + 1}: ${TIER_INFO[tier].label}, ${TIER_INFO[tier].points} points`)).toBeDefined()
      expect(screen.getByRole('img', { name: new RegExp(`^${score} of 700 points, reached `) })).toBeDefined()
      expect(screen.getByText(TIER_INFO[tier].label, { selector: '.verdict__label' })).toBeDefined()

      if (i < prompts.length - 1) await user.click(screen.getByRole('button', { name: /Next prompt/ }))
    }

    expect(onProgress).toHaveBeenCalledTimes(prompts.length * 2)
    expect(onFinish).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expected)
    expect(onQuit).not.toHaveBeenCalled()
  })

  it('quits from the header', async () => {
    const { onQuit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})
