// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ARRIVAL_LINES,
  DOORS_MS,
  MISS_MS,
  SETTLE_MS,
  SKIP_GRACE_MS,
  TRAVEL_MS,
  UPGRADE_MS,
  liftAfter,
  rideMs,
  type Lift,
} from '../../game/elevator'
import { TIER_INFO } from '../../game/scoring'
import { TIERS, type RoundResult, type Tier } from '../../game/types'
import { loadBackdrops } from './backdrops'
import { ElevatorScene } from './ElevatorScene'

const hit = (tier: Tier): RoundResult => ({
  promptId: 'p',
  input: 'x',
  attempts: [],
  answer: 'Bukit Brown',
  tier,
  points: TIER_INFO[tier].points,
})
const miss: RoundResult = { promptId: 'p', input: 'half typ', attempts: [], answer: null, tier: null, points: 0 }

/** A game so far, by tier */
const after = (...tiers: (Tier | null)[]): Lift => liftAfter(tiers.map((t) => (t ? hit(t) : miss)))

/** The lift at rest after `from`, about to play out `ride` */
function renderRide(ride: RoundResult, from: Lift = after()) {
  const onRideDone = vi.fn()
  const view = render(
    <ElevatorScene score={from.score} floor={from.floor} climbed={from.climbed} ride={ride} onRideDone={onRideDone} />,
  )
  return { onRideDone, ...view }
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
const scene = () => document.querySelector('.scene') as HTMLElement
const indicator = () => scene().dataset.floor
const lift = () => scene().dataset.lift
const doorsOpen = () => scene().classList.contains('scene--open')
const step = (name: string) => scene().classList.contains(`scene--${name}`)
const stamp = () => document.querySelector('.stamp')?.textContent ?? null
const caption = () => document.querySelector('.lift__caption')!.textContent
const mood = () => document.querySelector('.boy')!.getAttribute('class')
const skipButton = () => screen.getByRole('button', { name: 'Skip to the result' })

// Every lift's scenery, up front: backdrops.test.tsx covers the lifts whose art arrives late
beforeAll(() => loadBackdrops())

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

describe('ElevatorScene at rest', () => {
  it('waits on the ground floor of the HDB lift with its doors open, hidden from screen readers', () => {
    render(<ElevatorScene score={0} floor={1} climbed={0} size="hero" />)
    expect(lift()).toBe('hdb')
    expect(indicator()).toBe('01')
    expect(doorsOpen()).toBe(true)
    expect(step('idle')).toBe(true)
    expect(scene().getAttribute('aria-hidden')).toBe('true')
    expect(mood()).toContain('boy--idle')
    // Nothing to skip, and no caption
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelector('.lift__caption')).toBeNull()
  })

  it('shows the lift for the score and the floor it is on', () => {
    const lifts: [number, string][] = [[0, 'hdb'], [100, 'upgraded'], [200, 'condo'], [350, 'cbd'], [500, 'marina'], [600, 'penthouse']]
    for (const [score, id] of lifts) {
      render(<ElevatorScene score={score} floor={12} climbed={0} />)
      expect(lift()).toBe(id)
      expect(indicator()).toBe('12')
      // One lift at a time: nothing left over from a ride
      expect(document.querySelectorAll('.stage')).toHaveLength(1)
      cleanup()
    }
  })

  it('reads PH at the top of a perfect game', () => {
    render(<ElevatorScene score={700} floor={43} climbed={6} size="finale" celebrate />)
    expect(indicator()).toBe('PH')
    expect(lift()).toBe('penthouse')
    expect(document.querySelector('.confetti--fall')).not.toBeNull()
  })

  it('draws the same boy in every lift', () => {
    const sprites = [0, 100, 200, 350, 500, 600].map((score) => {
      render(<ElevatorScene score={score} floor={5} climbed={0} />)
      const html = document.querySelector('.boy')!.innerHTML
      cleanup()
      return html
    })
    expect(new Set(sprites).size).toBe(1)
  })

  it('lays its children over the picture, outside the hidden part', () => {
    render(
      <ElevatorScene score={0} floor={1} climbed={0}>
        <p>HDB Lift</p>
      </ElevatorScene>,
    )
    expect(screen.getByText('HDB Lift').closest('[aria-hidden="true"]')).toBeNull()
  })
})

describe('ElevatorScene ride', () => {
  for (const tier of [...TIERS, null]) {
    it(`ends once, after the whole ride, for ${tier ?? 'a miss'}`, () => {
      // From 200 points, so that not even a gem reaches the next lift
      const { onRideDone } = renderRide(tier ? hit(tier) : miss, after('gem', 'gem'))
      advance(rideMs(tier) - 1)
      expect(onRideDone).not.toHaveBeenCalled()
      advance(1)
      expect(onRideDone).toHaveBeenCalledTimes(1)
      advance(10_000)
      expect(onRideDone).toHaveBeenCalledTimes(1)
    })
  }

  it('closes the doors, climbs the floors of the answer one at a time, then opens on the result', () => {
    const from = after('common', 'common') // floor 3
    renderRide(hit('rare'), from)
    const at = clock()
    const landed = DOORS_MS + TRAVEL_MS.rare

    // Doors closing: nothing has moved, and nothing is given away
    expect(step('closing')).toBe(true)
    expect(doorsOpen()).toBe(false)
    expect(caption()).toBe('Doors closing…')
    expect(indicator()).toBe('03')
    expect(stamp()).toBeNull()

    at(DOORS_MS)
    expect(step('rising')).toBe(true)
    expect(caption()).toBe('Going up…')
    expect(mood()).toContain('boy--ride')

    // The indicator counts up through every floor on the way
    const seen = new Set<string>()
    for (let t = DOORS_MS; t <= landed; t += 20) {
      at(t)
      seen.add(indicator()!)
      expect(doorsOpen()).toBe(false)
      expect(stamp()).toBeNull()
    }
    expect([...seen]).toEqual(['03', '04', '05', '06', '07'])

    at(landed)
    expect(step('landed')).toBe(true)
    expect(indicator()).toBe('07')
    expect(stamp()).toBeNull()

    // Settled: the doors open on the rarity, the floors and the points
    at(landed + SETTLE_MS)
    expect(step('arrived')).toBe(true)
    expect(doorsOpen()).toBe(true)
    expect(stamp()).toBe('Steady▲ 4 floors+60')
    expect(caption()).toBe(ARRIVAL_LINES.rare)
    expect(mood()).toContain('boy--mid')
    // Same lift: 60 points from 20 is still under 100
    expect(lift()).toBe('hdb')
    expect(document.querySelector('.newlift')).toBeNull()
  })

  it('travels one floor for a common answer and six for the gem', () => {
    renderRide(hit('common'))
    advance(rideMs('common') - 1)
    expect(indicator()).toBe('02')
    expect(stamp()).toBe('Everybody Say▲ 1 floor+10')
    cleanup()

    renderRide(hit('gem'), after('common'))
    advance(DOORS_MS + TRAVEL_MS.gem)
    expect(indicator()).toBe('08')
  })

  it('sweeps in the new lift when the answer crosses a threshold, before the doors open', () => {
    // 85 points, then a common answer for 10 more: still the HDB lift, on floor 7
    const from = after('ulu', 'common')
    expect(from).toMatchObject({ score: 95, floor: 7 })
    renderRide(hit('common'), from)
    const at = clock()
    const landed = DOORS_MS + TRAVEL_MS.common

    at(landed + SETTLE_MS - 1)
    expect(lift()).toBe('hdb')
    expect(document.querySelectorAll('.stage')).toHaveLength(1)

    // The upgrade: the new lift wipes in over the old one, doors still shut
    at(landed + SETTLE_MS)
    expect(step('upgrading')).toBe(true)
    expect(lift()).toBe('upgraded')
    expect(document.querySelector('.stage--incoming.stage--upgraded')).not.toBeNull()
    expect(document.querySelector('.stage-front--incoming')).not.toBeNull()
    expect(document.querySelector('.scene__sweep')).not.toBeNull()
    expect(document.querySelector('.newlift')!.textContent).toBe('New lift unlockedUpgraded HDB Lift')
    expect(doorsOpen()).toBe(false)
    expect(stamp()).toBeNull()
    expect(mood()).toContain('boy--look')
    expect(caption()).toBe('Wait. This is not the same lift…')

    at(landed + SETTLE_MS + UPGRADE_MS)
    expect(step('arrived')).toBe(true)
    expect(doorsOpen()).toBe(true)
    expect(stamp()).toBe('Everybody Say▲ 1 floor+10')
    expect(document.querySelector('.newlift')).not.toBeNull()
    expect(indicator()).toBe('08')
  })

  it('takes the upgrade into account in how long the ride lasts', () => {
    const { onRideDone } = renderRide(hit('gem'))
    advance(rideMs('gem'))
    expect(onRideDone).not.toHaveBeenCalled()
    advance(UPGRADE_MS)
    expect(onRideDone).toHaveBeenCalledTimes(1)
  })

  it('reads PH when the last gem makes it a perfect game', () => {
    const from = after('gem', 'gem', 'gem', 'gem', 'gem', 'gem')
    renderRide(hit('gem'), from)
    advance(DOORS_MS + TRAVEL_MS.gem)
    expect(indicator()).toBe('43')
    advance(SETTLE_MS)
    expect(indicator()).toBe('PH')
    // The joke stays understated: no hop, no pop. He blows another bubble
    expect(mood()).toContain('boy--calm')
    expect(stamp()).toBe('Sibei Ulu▲ 6 floors+100')
  })

  it('stays on its floor for a miss: no travel, no closed doors, and a short sigh', () => {
    const from = after('solid')
    const { onRideDone } = renderRide(miss, from)
    expect(step('stuck')).toBe(true)
    expect(indicator()).toBe('04')
    expect(stamp()).toBe('Time up!Staying put+0')
    expect(caption()).toBe(ARRIVAL_LINES.miss)
    expect(mood()).toContain('boy--miss')
    advance(MISS_MS - 1)
    expect(indicator()).toBe('04')
    expect(lift()).toBe('hdb')
    expect(document.querySelector('.stage--incoming')).toBeNull()
    expect(onRideDone).not.toHaveBeenCalled()
    advance(1)
    expect(onRideDone).toHaveBeenCalledTimes(1)
  })

  it('puts focus on Skip, and skips from the button or a tap on the picture, but not straight after answering', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const first = renderRide(hit('ulu'))
    expect(document.activeElement).toBe(skipButton())
    // A double-tap on Go, or a held Enter, lands here straight away: ignored
    fireEvent.click(scene())
    await user.click(skipButton())
    expect(first.onRideDone).not.toHaveBeenCalled()
    advance(SKIP_GRACE_MS)
    await user.click(skipButton())
    expect(first.onRideDone).toHaveBeenCalledTimes(1)
    // The timer that would have ended it doesn't call it again
    advance(10_000)
    expect(first.onRideDone).toHaveBeenCalledTimes(1)
    cleanup()

    const second = renderRide(hit('ulu'))
    advance(SKIP_GRACE_MS)
    fireEvent.click(scene())
    expect(second.onRideDone).toHaveBeenCalledTimes(1)
  })

  it('shows the finished state as soon as the ride is over or skipped, whatever it was doing', () => {
    const from = after('ulu', 'common')
    const ride = hit('gem')
    const { rerender } = renderRide(ride, from)
    advance(DOORS_MS + 200)
    expect(doorsOpen()).toBe(false)

    // The game moves on with the answer counted: a new lift, six floors up
    const to = liftAfter([hit('ulu'), hit('common'), ride])
    rerender(<ElevatorScene score={to.score} floor={to.floor} climbed={to.climbed} ride={null} />)
    expect(lift()).toBe('upgraded')
    expect(indicator()).toBe('13')
    expect(doorsOpen()).toBe(true)
    expect(step('idle')).toBe(true)
    expect(document.querySelectorAll('.stage')).toHaveLength(1)
    expect(stamp()).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()

    // And the abandoned ride's timers do nothing more
    advance(10_000)
    expect(indicator()).toBe('13')
    expect(step('idle')).toBe(true)
  })

  it('stops its timers when it unmounts', () => {
    const { onRideDone } = renderRide(hit('gem'))
    cleanup()
    advance(10_000)
    expect(onRideDone).not.toHaveBeenCalled()
  })
})
