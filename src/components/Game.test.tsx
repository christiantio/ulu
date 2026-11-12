// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS, SCHEDULE } from '../content/bank'
import { SKIP_GRACE_MS, floorsFor, formatFloor, rideMs, stageFor, upgradeFor } from '../game/elevator'
import { promptsForDate } from '../game/schedule'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult, Tier } from '../game/types'
import { stubReducedMotion } from '../test/motion'
import { loadBackdrops } from './elevator/backdrops'
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
const skip = () => screen.getByRole('button', { name: 'Skip to the result' })
const headerScore = () => document.querySelector('.game__score strong')!.textContent
const headerFloor = () => document.querySelector('.hud__stat dd')!.textContent
/** The plate on the picture: its label says the score, the floor and the lift */
const plate = () => screen.getByRole('img').getAttribute('aria-label')
const scene = () => document.querySelector('.scene') as HTMLElement
const goUp = () => screen.getByRole('button', { name: 'Going up' })
const verdict = (tier: Tier) => screen.queryByText(TIER_INFO[tier].label, { selector: '.verdict__label' })
/** What the game tells the lift's world about the clock: how far open the doors are, and how urgent it is */
const game = () => screen.getByRole('main')
const doors = () => game().style.getPropertyValue('--clock')

// Every lift's scenery, up front, so none of it arrives halfway through a test
beforeAll(() => loadBackdrops())

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
    expect(screen.getByText('Question 1 of 7')).toBeDefined()
    // The lift waits on the ground floor, doors open
    expect(headerFloor()).toBe('01')
    expect(plate()).toBe('0 of 700 points, floor 01, HDB Lift')
    expect(scene().classList.contains('scene--open')).toBe(true)
    expect(screen.queryByRole('timer')).toBeNull()
    expect(pip('Round 1')).toBeDefined()
    expect(pip('Round 2, not played yet')).toBeDefined()

    advance(60_000)
    expect(onProgress).not.toHaveBeenCalled()
    await user.click(goUp())
    expect(screen.getByRole('heading', { level: 2, name: prompts[0].text })).toBeDefined()
    expect(secondsLeft(SECONDS_PER_ROUND)).toBeDefined()
    expect(onProgress).toHaveBeenLastCalledWith([], Date.now())
  })

  it('resumes a round with its original deadline, so refreshing cannot reset the clock', () => {
    const startedAt = NOW - 20_000
    const { onProgress, onFinish } = setup({ initialResults: [result(prompts[0], 'common')], initialStartedAt: startedAt })

    // Straight back into round 2, with 5 of the 25 seconds left
    expect(screen.queryByText('Question 2 of 7')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: prompts[1].text })).toBeDefined()
    expect(secondsLeft(5)).toBeDefined()
    expect(pip('Round 1: Everybody Say, 10 points')).toBeDefined()
    // The lift is where round 1 left it
    expect(headerFloor()).toBe('02')
    expect(scene().dataset.floor).toBe('02')

    advance(5000)
    // Saved as soon as time is up, before the lift reacts
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onProgress).toHaveBeenCalledWith(
      [
        result(prompts[0], 'common'),
        { promptId: prompts[1].id, input: '', attempts: [], answer: null, tier: null, points: 0 },
      ],
      null,
    )
    expect(skip()).toBeDefined()
    advance(rideMs(null))
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(pip('Round 2: Time up, 0 points')).toBeDefined()
    // A miss leaves the lift where it was
    expect(headerFloor()).toBe('02')
    expect(headerScore()).toBe('10')
    expect(onProgress).toHaveBeenCalledTimes(1)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('times a resumed round out at once if its deadline passed while away', () => {
    const { onProgress } = setup({ initialStartedAt: NOW - 60_000 })
    expect(onProgress).toHaveBeenCalledWith([expect.objectContaining({ promptId: prompts[0].id, points: 0 })], null)
    advance(rideMs(null))
    expect(screen.getByText('Time up!')).toBeDefined()
    expect(headerFloor()).toBe('01')
  })

  it('reports progress as each round starts and ends, and the results at the end', async () => {
    const { onProgress, onFinish, onQuit, user } = setup()
    const tiers: Tier[] = ['rare', 'common', 'gem', 'solid', 'trap', 'ulu', 'common']
    const expected: RoundResult[] = []
    let floor = 1

    for (const [i, p] of prompts.entries()) {
      // Only the first round waits for a tap: Next starts the others
      if (i === 0) await user.click(goUp())
      const startedAt = Date.now()
      expect(onProgress).toHaveBeenLastCalledWith(expected, startedAt)
      expect(screen.getByRole('heading', { level: 2, name: p.text })).toBeDefined()

      const tier = p.answers.some((a) => a.tier === tiers[i]) ? tiers[i] : 'common'
      advance(1000)
      await user.type(answerBox(), `${answerOf(p, tier).name}{Enter}`)
      expected.push(result(p, tier))
      expect(onProgress).toHaveBeenLastCalledWith(expected, null)

      // The ride doesn't give the result away: the pip, score, floor and lift wait for it to land
      const score = expected.reduce((sum, r) => sum + r.points, 0)
      const before = score - TIER_INFO[tier].points
      const upgrade = upgradeFor(before, TIER_INFO[tier].points)
      expect(pip(`Round ${i + 1}`)).toBeDefined()
      expect(headerScore()).toBe(String(before))
      expect(headerFloor()).toBe(formatFloor(floor))
      expect(plate()).toBe(`${before} of 700 points, floor ${formatFloor(floor)}, ${stageFor(before).name}`)
      expect(verdict(tier)).toBeNull()
      // Sit through every other ride, and skip the rest
      if (i % 2) {
        advance(SKIP_GRACE_MS)
        await user.click(skip())
      } else {
        advance(rideMs(tier, upgrade !== null))
      }

      // Landed: the floor goes up by the answer's tier, and the lift by the total
      floor += floorsFor(tier)
      expect(pip(`Round ${i + 1}: ${TIER_INFO[tier].label}, ${TIER_INFO[tier].points} points`)).toBeDefined()
      expect(headerScore()).toBe(String(score))
      expect(headerFloor()).toBe(formatFloor(floor))
      expect(plate()).toBe(`${score} of 700 points, floor ${formatFloor(floor)}, ${stageFor(score).name}`)
      expect(scene().dataset.lift).toBe(stageFor(score).id)
      expect(scene().dataset.floor).toBe(formatFloor(floor))
      expect(verdict(tier)).not.toBeNull()
      // An upgrade is said in words too, whether or not the ride was watched
      expect(screen.queryByText('New lift unlocked')?.parentElement?.textContent ?? null).toBe(
        upgrade ? `New lift unlocked ${upgrade.name}` : null,
      )

      if (i < prompts.length - 1) await user.click(screen.getByRole('button', { name: /Next question/ }))
    }

    expect(onProgress).toHaveBeenCalledTimes(prompts.length * 2)
    expect(onFinish).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'See results' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expected)
    expect(onQuit).not.toHaveBeenCalled()
  })

  it('rides up before the reveal, then shows the points gained and the new lift', async () => {
    const { user } = setup()
    await user.click(goUp())
    await user.type(answerBox(), `${answerOf(prompts[0], 'gem').name}{Enter}`)

    expect(document.activeElement).toBe(skip())
    expect(screen.getByText(prompts[0].text)).toBeDefined()
    expect(document.querySelector('.game__gain')).toBeNull()
    // A gem from nothing is 100 points: six floors up, and into the second lift
    const whole = rideMs('gem', true)
    advance(whole - 1)
    expect(verdict('gem')).toBeNull()
    expect(headerScore()).toBe('0')
    expect(headerFloor()).toBe('01')

    advance(1)
    expect(verdict('gem')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
    expect(headerScore()).toBe('100')
    expect(headerFloor()).toBe('07')
    expect(plate()).toBe('100 of 700 points, floor 07, Upgraded HDB Lift')
    expect(document.querySelector('.game__gain')!.textContent).toBe('+100')
    // The round's button on the counter is the one that lights up
    expect(document.querySelectorAll('.pip--fresh')).toHaveLength(1)
    expect(document.querySelector('.pip--fresh')!.textContent).toContain('Round 1: Sibei Ulu, 100 points')
    const next = screen.getByRole('button', { name: /Next question/ })
    expect(document.activeElement).toBe(next)
    // The verdict that's read with the button says how far the lift went, and that it's a new one
    const described = document.getElementById(next.getAttribute('aria-describedby')!)!.textContent
    expect(described).toContain('Up 6 floors, now on floor 07.')
    expect(described).toContain('New lift unlocked Upgraded HDB Lift')
  })

  it('resumes a saved game in the lift it had reached, on the floor it had reached', () => {
    // 245 points over four rounds: the third lift, 15 floors up, with one round missed on the way
    const played = [
      result(prompts[0], 'rare'),
      result(prompts[1], 'ulu'),
      { promptId: prompts[2].id, input: '', attempts: [], answer: null, tier: null, points: 0 },
      result(prompts[3], 'gem'),
    ]
    setup({ initialResults: played })
    expect(screen.getByText('Question 5 of 7')).toBeDefined()
    expect(headerScore()).toBe('245')
    expect(headerFloor()).toBe('16')
    expect(plate()).toBe('245 of 700 points, floor 16, Condominium Lift')
    expect(scene().dataset.lift).toBe('condo')
    expect(scene().classList.contains('scene--open')).toBe(true)
    expect(pip('Round 3: Time up, 0 points')).toBeDefined()
    // No ride replays for rounds already played
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
  })

  it('goes straight to the final state when the player prefers reduced motion', async () => {
    stubReducedMotion()
    const { user } = setup()
    await user.click(goUp())
    await user.type(answerBox(), `${answerOf(prompts[0], 'gem').name}{Enter}`)
    // No ride to sit through or skip: the lift is already there, in words and in the picture
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull()
    expect(verdict('gem')).not.toBeNull()
    expect(pip('Round 1: Sibei Ulu, 100 points')).toBeDefined()
    expect(headerScore()).toBe('100')
    expect(headerFloor()).toBe('07')
    expect(scene().dataset.lift).toBe('upgraded')
    expect(scene().dataset.floor).toBe('07')
    expect(scene().classList.contains('scene--idle')).toBe(true)
    expect(screen.getByText('New lift unlocked').parentElement!.textContent).toBe('New lift unlocked Upgraded HDB Lift')
  })

  it('closes the lift doors with the clock, and leaves them where an answer stopped it', async () => {
    const { user } = setup()
    // Before the clock starts there's nothing to show
    expect(doors()).toBe('')
    await user.click(goUp())
    expect(doors()).toBe('1.000')
    expect(game().dataset.pace).toBe('steady')

    advance(10_000)
    expect(doors()).toBe('0.600')
    advance(10_000)
    expect(doors()).toBe('0.200')
    expect(game().dataset.pace).toBe('urgent')

    // Locked in with five seconds left: the alarm stops, and the ride shuts the doors from where they were
    await user.type(answerBox(), `${answerOf(prompts[0], 'common').name}{Enter}`)
    expect(doors()).toBe('0.200')
    expect(game().dataset.pace).toBeUndefined()

    // The next question opens them again
    advance(rideMs('common'))
    await user.click(screen.getByRole('button', { name: /Next question/ }))
    expect(doors()).toBe('1.000')
    expect(game().dataset.pace).toBe('steady')
  })

  it('shuts the doors when the clock runs out', async () => {
    const { user } = setup()
    await user.click(goUp())
    advance(SECONDS_PER_ROUND * 1000)
    expect(doors()).toBe('0')
    expect(game().dataset.pace).toBeUndefined()
    expect(scene().classList.contains('scene--stuck')).toBe(true)
    expect(screen.getByText('The doors have closed', { exact: false })).toBeDefined()
  })

  it('jolts the lift at every guess it refuses, and not once the question is over', async () => {
    const { user } = setup()
    const jolt = () => scene().className.match(/scene--jolt-\w/)?.[0] ?? null
    await user.click(goUp())
    expect(jolt()).toBeNull()

    await user.type(answerBox(), 'zzqqxxjj{Enter}')
    expect(jolt()).toBe('scene--jolt-a')
    // A different name each time, so the same animation plays again
    await user.type(answerBox(), 'zzqqxxjjkk{Enter}')
    expect(jolt()).toBe('scene--jolt-b')

    await user.type(answerBox(), `${answerOf(prompts[0], 'common').name}{Enter}`)
    expect(jolt()).toBeNull()
    advance(rideMs('common'))
    expect(jolt()).toBeNull()
  })

  it('lays the same three things over the lift in every phase: the status, a sign and the controls', async () => {
    const { user } = setup()
    const laidOut = () => ({
      status: document.querySelectorAll('.game__stack > .game__top').length,
      signs: document.querySelectorAll('.game__stack .board').length,
      docks: document.querySelectorAll('.game__stack .dock').length,
    })
    // The scene is the game's world, not one of the things in the stack
    expect(scene().closest('.game__stack')).toBeNull()
    expect(laidOut()).toEqual({ status: 1, signs: 1, docks: 1 })
    expect(goUp().closest('.dock')).not.toBeNull()

    await user.click(goUp())
    expect(laidOut()).toEqual({ status: 1, signs: 1, docks: 1 })

    // During the ride the lift's own bar, with Skip on it, stands in for the controls
    await user.type(answerBox(), `${answerOf(prompts[0], 'common').name}{Enter}`)
    expect(laidOut()).toEqual({ status: 1, signs: 1, docks: 0 })
    expect(skip().closest('.lift__bar')).not.toBeNull()

    advance(rideMs('common'))
    expect(laidOut()).toEqual({ status: 1, signs: 1, docks: 1 })
    expect(screen.getByRole('button', { name: /Next question/ }).closest('.dock')).not.toBeNull()
    expect(verdict('common')!.closest('.board')).not.toBeNull()
    // What else was possible is on the cards beyond the stack
    expect(document.querySelector('.game__stack .extras .samples')).not.toBeNull()
  })

  it('quits from the header', async () => {
    const { onQuit, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Back to home' }))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})
