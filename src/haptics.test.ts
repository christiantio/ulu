// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buzz } from './haptics'
import { stubReducedMotion } from './test/motion'

afterEach(() => {
  vi.unstubAllGlobals()
  // jsdom has no navigator.vibrate of its own
  Reflect.deleteProperty(navigator, 'vibrate')
})

function stubVibrate(impl: (pattern: number[]) => boolean = () => true) {
  const vibrate = vi.fn(impl)
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  return vibrate
}

describe('buzz', () => {
  it('does nothing, quietly, where the browser cannot vibrate', () => {
    expect(() => buzz('lock')).not.toThrow()
  })

  it('gives each event its own pattern', () => {
    const vibrate = stubVibrate()
    buzz('lock')
    buzz('refuse')
    buzz('timeUp')
    expect(vibrate.mock.calls.map(([pattern]) => pattern)).toEqual([[18], [28, 50, 28], [110]])
  })

  it('stays still for a player who prefers reduced motion', () => {
    const vibrate = stubVibrate()
    stubReducedMotion()
    buzz('refuse')
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('never throws, even if the browser does', () => {
    stubVibrate(() => {
      throw new Error('blocked')
    })
    expect(() => buzz('timeUp')).not.toThrow()
  })
})
