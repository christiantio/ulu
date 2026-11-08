// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_PROMPTS } from '../content/bank'
import {
  ARRIVAL_LINES,
  CHANGE_MS,
  DEPART_MS,
  FIRST_LEG_MS,
  PASS_LEG_MS,
  SKIP_GRACE_MS,
  journeyMs,
  schedule,
  travelMs,
} from '../game/journey'
import { TIER_INFO } from '../game/scoring'
import { TIERS, type RoundResult, type Tier } from '../game/types'
import { Journey } from './Journey'

// A real prompt with an answer in every tier
const prompt = ALL_PROMPTS.find((p) => TIERS.every((t) => p.answers.some((a) => a.tier === t)))!

const hit = (tier: Tier): RoundResult => {
  const answer = prompt.answers.find((a) => a.tier === tier)!
  return { promptId: prompt.id, input: answer.name, attempts: [], answer: answer.name, tier, points: TIER_INFO[tier].points }
}
const miss: RoundResult = { promptId: prompt.id, input: 'half typ', attempts: [], answer: null, tier: null, points: 0 }

function renderJourney(result: RoundResult) {
  const onDone = vi.fn()
  const view = render(<Journey prompt={prompt} result={result} onDone={onDone} />)
  const scene = view.container.querySelector('.journey__viewport') as HTMLElement
  return { onDone, scene }
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
/** Advances the clock to `ms` after the ride started */
function clock() {
  let now = 0
  return (ms: number) => {
    advance(ms - now)
    now = ms
  }
}
const meter = () => document.querySelector('.journey__meter')!.textContent
const onBoat = () => document.querySelector('.journey__vehicle--sea') !== null
const caption = () => document.querySelector('.journey__caption')!.textContent
const skipButton = () => screen.getByRole('button', { name: 'Skip to the result' })

beforeEach(() => {
  // Fakes requestAnimationFrame and performance.now too, so the frames run as the clock advances
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Journey', () => {
  for (const tier of [...TIERS, null]) {
    it(`ends once, after the whole ride, for ${tier ?? 'a miss'}`, () => {
      const { onDone } = renderJourney(tier ? hit(tier) : miss)
      advance(journeyMs(tier) - 1)
      expect(onDone).not.toHaveBeenCalled()
      advance(1)
      expect(onDone).toHaveBeenCalledTimes(1)
      advance(10_000)
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  }

  it('keeps the prompt on screen, hides the scene from screen readers and puts focus on Skip', () => {
    const { scene } = renderJourney(hit('rare'))
    expect(screen.getByText(prompt.text)).toBeDefined()
    expect(scene.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(skipButton())
  })

  it('passes every station below the answer, changes to the bumboat at the end of the line, and stamps its stop', () => {
    const gem = hit('gem')
    const { train } = schedule('gem')
    const { scene } = renderJourney(gem)
    const at = clock()
    expect(caption()).toBe('Doors closing…')
    expect(document.querySelector('.journey__ticket')!.textContent).toBe(gem.answer)
    expect(meter()).toBe('+0')

    at(DEPART_MS + FIRST_LEG_MS + 20)
    expect(caption()).toBe(`Not stopping at ${TIER_INFO.common.label}…`)
    expect(meter()).toBe(`+${TIER_INFO.common.points}`)
    at(DEPART_MS + FIRST_LEG_MS + 3 * PASS_LEG_MS + 20)
    expect(caption()).toBe(`Not stopping at ${TIER_INFO.rare.label}…`)
    expect(meter()).toBe(`+${TIER_INFO.rare.points}`)
    expect(onBoat()).toBe(false)

    // The train stops at the end of the line, which isn't a station, and you hop across to the bumboat
    at(DEPART_MS + train + 20)
    expect(caption()).toBe('End of the line! Change to bumboat…')
    expect(scene.classList.contains('journey__viewport--change')).toBe(true)
    expect(document.querySelector('.journey__hop')).not.toBeNull()
    expect(meter()).toBe(`+${TIER_INFO.rare.points}`)
    expect(document.querySelector('.journey__stamp')).toBeNull()
    at(DEPART_MS + train + CHANGE_MS + 20)
    expect(caption()).toBe('Bumboat to the islands…')
    expect(onBoat()).toBe(true)
    expect(document.querySelector('.journey__hop')).toBeNull()

    // Braking into its own station: the meter has it, but the caption doesn't call it passed
    at(DEPART_MS + travelMs('gem') - 20)
    expect(meter()).toBe('+100')
    expect(caption()).toBe(`Not stopping at ${TIER_INFO.ulu.label}…`)
    at(DEPART_MS + travelMs('gem'))
    expect(caption()).toBe(ARRIVAL_LINES.gem)
    expect(document.querySelector('.journey__stamp')!.textContent).toBe(`${TIER_INFO.gem.emoji} ${TIER_INFO.gem.label}+100`)
    expect(meter()).toBe('+100')
  })

  it('stays on the train for a station on land', () => {
    renderJourney(hit('rare'))
    advance(DEPART_MS + travelMs('rare'))
    expect(caption()).toBe(ARRIVAL_LINES.rare)
    expect(onBoat()).toBe(false)
    expect(document.querySelector('.journey__viewport--train')).not.toBeNull()
  })

  it('stops at the first station for a common answer, with the crowd who said it too', () => {
    renderJourney(hit('common'))
    advance(DEPART_MS + travelMs('common') - 20)
    expect(meter()).toBe('+10')
    expect(caption()).toBe('Leaving Raffles Place…')
    advance(20)
    expect(caption()).toBe(ARRIVAL_LINES.common)
    expect(document.querySelector('.journey__stamp')!.textContent).toContain(TIER_INFO.common.label)
    expect(document.querySelectorAll('.journey__person').length).toBeGreaterThan(1)
    expect(onBoat()).toBe(false)
  })

  it('leaves without you on a miss', () => {
    renderJourney(miss)
    expect(document.querySelector('.journey__ticket')).toBeNull()
    advance(DEPART_MS + 1)
    expect(caption()).toBe('Wait, wait!')
    advance(journeyMs(null) - DEPART_MS - 1 - 1)
    expect(caption()).toBe(ARRIVAL_LINES.miss)
    expect(document.querySelector('.journey__stamp')!.textContent).toBe('❌ Time up!+0')
  })

  it('skips from the Skip button or a tap on the scene, but not in the first moment after answering', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = renderJourney(hit('ulu'))
    // A double-tap on Go, or a held Enter, lands here straight away: ignored
    fireEvent.click(first.scene)
    await user.click(skipButton())
    expect(first.onDone).not.toHaveBeenCalled()
    advance(SKIP_GRACE_MS)
    await user.click(skipButton())
    expect(first.onDone).toHaveBeenCalledTimes(1)
    // The timer that would have ended it doesn't call it again
    advance(10_000)
    expect(first.onDone).toHaveBeenCalledTimes(1)
    cleanup()

    const second = renderJourney(hit('ulu'))
    advance(SKIP_GRACE_MS)
    fireEvent.click(second.scene)
    expect(second.onDone).toHaveBeenCalledTimes(1)
  })

  it('stops its timers when it unmounts', () => {
    const { onDone } = renderJourney(hit('gem'))
    cleanup()
    advance(10_000)
    expect(onDone).not.toHaveBeenCalled()
  })
})
