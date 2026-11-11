// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubReducedMotion } from '../test/motion'
import { CountUp } from './CountUp'

const number = () => document.querySelector<HTMLElement>('.count')!
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('CountUp', () => {
  it('shows a number as it is, without counting, when it first appears', () => {
    render(<CountUp value={130} />)
    expect(number().textContent).toBe('130')
    expect(number().dataset.count).toBeUndefined()
  })

  it('counts from the old value to the new one, with the real value as its text throughout', () => {
    const { rerender } = render(<CountUp value={30} ms={600} />)
    rerender(<CountUp value={130} ms={600} />)
    expect(number().textContent).toBe('130')
    expect(number().dataset.count).toBe('30')

    advance(300)
    const midway = Number(number().dataset.count)
    expect(midway).toBeGreaterThan(30)
    expect(midway).toBeLessThan(130)
    expect(number().textContent).toBe('130')

    advance(400)
    expect(number().dataset.count).toBeUndefined()
    expect(number().textContent).toBe('130')
  })

  it('counts from a starting value the first time, when given one', () => {
    render(<CountUp value={410} from={0} ms={900} />)
    expect(number().textContent).toBe('410')
    expect(number().dataset.count).toBe('0')
    advance(1000)
    expect(number().dataset.count).toBeUndefined()
  })

  it('carries on from where it had got to when the value changes mid-count', () => {
    const { rerender } = render(<CountUp value={0} ms={600} />)
    rerender(<CountUp value={100} ms={600} />)
    advance(300)
    const reached = Number(number().dataset.count)
    rerender(<CountUp value={200} ms={600} />)
    expect(number().dataset.count).toBe(String(reached))
    advance(700)
    expect(number().dataset.count).toBeUndefined()
    expect(number().textContent).toBe('200')
  })

  it("doesn't count for a player who prefers reduced motion", () => {
    stubReducedMotion()
    const { rerender } = render(<CountUp value={30} />)
    rerender(<CountUp value={130} />)
    expect(number().textContent).toBe('130')
    expect(number().dataset.count).toBeUndefined()
  })

  it('stops counting when it leaves the page', () => {
    const { rerender, unmount } = render(<CountUp value={30} />)
    rerender(<CountUp value={130} />)
    unmount()
    expect(() => advance(1000)).not.toThrow()
  })
})
