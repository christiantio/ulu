// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS } from '../content/bank'
import { matchAnswer } from '../game/match'
import { SECONDS_PER_ROUND, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult, Tier } from '../game/types'
import { Round } from './Round'

const NOW = Date.parse('2026-11-10T04:00:00Z')
const JUNK = 'zzqqxxjj'

// A real prompt that has an answer in every tier we use
const prompt = ALL_PROMPTS.find((p) => p.answers.some((a) => a.tier === 'rare'))!

function answerOf(p: Prompt, tier: Tier) {
  const answer = p.answers.find((a) => a.tier === tier)
  if (!answer) throw new Error(`${p.id} has no ${tier} answer`)
  return answer
}

// A world prompt with decoys, and a people prompt where part of a name is enough
const withDecoys = ALL_PROMPTS.find((p) => p.id === 'world-china-neighbours')!
const people = ALL_PROMPTS.find((p) => p.id === 'politics-presidents-and-pms')!

function setup(shown: Prompt = prompt) {
  const onResult = vi.fn<(result: RoundResult) => void>()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(<Round prompt={shown} deadline={Date.now() + SECONDS_PER_ROUND * 1000} onResult={onResult} />)
  const input = () => screen.getByRole('textbox', { name: 'Your answer' })
  return { onResult, user, input }
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

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

describe('Round', () => {
  it('runs on the faked clock', () => {
    expect(Date.now()).toBe(NOW)
  })

  it('shows the prompt and a full clock in the timer region', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: prompt.text })).toBeDefined()
    expect(within(screen.getByRole('timer')).getByText(`${SECONDS_PER_ROUND} seconds left`)).toBeDefined()
    advance(5000)
    expect(within(screen.getByRole('timer')).getByText(`${SECONDS_PER_ROUND - 5} seconds left`)).toBeDefined()
  })

  it('locks in a valid answer with its tier and points', async () => {
    const { onResult, user, input } = setup()
    const rare = answerOf(prompt, 'rare')
    await user.type(input(), `${rare.name}{Enter}`)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith({
      promptId: prompt.id,
      input: rare.name,
      attempts: [],
      answer: rare.name,
      tier: 'rare',
      points: TIER_INFO.rare.points,
    })
  })

  it('trims the input and locks in the canonical name whatever the case', async () => {
    const { onResult, user, input } = setup()
    const common = answerOf(prompt, 'common')
    await user.type(input(), `  ${common.name.toLowerCase()}  {Enter}`)
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ input: common.name.toLowerCase(), answer: common.name, tier: 'common', points: 10 }),
    )
  })

  it('shows feedback for an unrecognised answer and allows a retry', async () => {
    const { onResult, user, input } = setup()
    expect(matchAnswer(JUNK, prompt)).toBeNull()

    await user.type(input(), `${JUNK}{Enter}`)
    expect(onResult).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain(`“${JUNK}” not on our list leh`)
    // The input is remounted (to replay the shake) and cleared
    expect((input() as HTMLInputElement).value).toBe('')

    const solid = answerOf(prompt, 'solid')
    await user.type(input(), `${solid.name}{Enter}`)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ answer: solid.name, tier: 'solid', points: 30, attempts: [JUNK] }),
    )
  })

  it('says why a known wrong answer does not count, and does not list it as a rejected guess', async () => {
    const { onResult, user, input } = setup(withDecoys)
    const decoy = withDecoys.decoys!.find((d) => d.name === 'Thailand')!

    await user.type(input(), 'thailand{Enter}')
    expect(onResult).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe(`“thailand” doesn't count. ${decoy.why}`)
    expect((input() as HTMLInputElement).value).toBe('')

    await user.type(input(), 'Nepal{Enter}')
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ answer: 'Nepal', attempts: [] }))
  })

  it('asks for more when a guess fits several answers, and keeps it in the box', async () => {
    const { onResult, user, input } = setup(people)

    await user.type(input(), 'Lee{Enter}')
    expect(onResult).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('“Lee” could be more than one answer')
    expect((input() as HTMLInputElement).value).toBe('Lee')

    await user.type(input(), ' Kuan Yew{Enter}')
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'Lee Kuan Yew', answer: 'Lee Kuan Yew', attempts: [] }),
    )
  })

  it('accepts the end of a name where the prompt allows it', async () => {
    const { onResult, user, input } = setup(people)
    await user.type(input(), 'chok tong{Enter}')
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ input: 'chok tong', answer: 'Goh Chok Tong' }))
  })

  it('keeps every rejected guess once, by normalised text, and reports them on timeout', async () => {
    const { onResult, user, input } = setup()
    const other = 'qqzzyy xx'
    expect(matchAnswer(other, prompt)).toBeNull()

    await user.type(input(), `  ${JUNK}  {Enter}`)
    await user.type(input(), `${other}{Enter}`)
    // The same guesses again, in another case and with punctuation: not kept twice
    await user.type(input(), `${JUNK.toUpperCase()}!{Enter}`)
    await user.type(input(), `qqzzyy-xx{Enter}`)
    // Typed but never submitted: stays in input, not attempts
    await user.type(input(), 'half typ')
    advance(SECONDS_PER_ROUND * 1000)

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith({
      promptId: prompt.id,
      input: 'half typ',
      attempts: [JUNK, other],
      answer: null,
      tier: null,
      points: 0,
    })
  })

  it('keeps guesses that normalise to nothing, compared as typed', async () => {
    const { onResult, user, input } = setup()
    await user.type(input(), '???{Enter}')
    await user.type(input(), '!!!{Enter}')
    await user.type(input(), '???{Enter}')
    advance(SECONDS_PER_ROUND * 1000)
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ attempts: ['???', '!!!'] }))
  })

  it('does not submit an empty answer', async () => {
    const { onResult, user, input } = setup()
    expect(screen.getByRole('button', { name: 'Go' }).hasAttribute('disabled')).toBe(true)
    await user.type(input(), '   {Enter}')
    expect(onResult).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).not.toContain('not on our list')
  })

  it('reports the last typed text when time runs out', async () => {
    const { onResult, user, input } = setup()
    await user.type(input(), '  half an answ')
    advance(SECONDS_PER_ROUND * 1000 - 200)
    expect(onResult).not.toHaveBeenCalled()
    advance(300)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith({
      promptId: prompt.id,
      input: 'half an answ',
      attempts: [],
      answer: null,
      tier: null,
      points: 0,
    })
  })

  it('reports an empty input on timeout after a rejected answer was cleared', async () => {
    const { onResult, user, input } = setup()
    await user.type(input(), `${JUNK}{Enter}`)
    advance(SECONDS_PER_ROUND * 1000)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ input: '', tier: null, points: 0 }))
  })

  it('announces the time left at 10 and 5 seconds', () => {
    setup()
    const warning = () => document.querySelector('[aria-live="polite"]')!.textContent
    expect(warning()).toBe('')
    advance((SECONDS_PER_ROUND - 10) * 1000)
    expect(warning()).toBe('10 seconds left')
    advance(5000)
    expect(warning()).toBe('5 seconds left')
  })

  it('never reports twice: a locked-in answer is not followed by a timeout', async () => {
    const { onResult, user, input } = setup()
    await user.type(input(), `${answerOf(prompt, 'gem').name}{Enter}`)
    advance(SECONDS_PER_ROUND * 1000 + 5000)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0]).toMatchObject({ tier: 'gem', points: 100 })
  })

  it('never reports twice: an answer submitted after the timeout is ignored', async () => {
    const { onResult, user, input } = setup()
    advance(SECONDS_PER_ROUND * 1000)
    expect(onResult).toHaveBeenCalledTimes(1)
    await user.type(input(), `${answerOf(prompt, 'gem').name}{Enter}`)
    advance(1000)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult.mock.calls[0][0]).toMatchObject({ tier: null, points: 0 })
  })
})
