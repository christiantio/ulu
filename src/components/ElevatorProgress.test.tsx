// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LiftMeter } from './ElevatorProgress'

afterEach(cleanup)

const label = () => screen.getByRole('img').getAttribute('aria-label')
const fill = () => (document.querySelector('.meter__fill') as HTMLElement).style.transform

it('names the lift and the points to the next one, and fills up towards it', () => {
  render(<LiftMeter score={85} />)
  expect(label()).toBe('HDB Lift, 15 points to the next lift')
  expect(fill()).toBe('scaleX(0.85)')
})

it('keeps the final 100 points meaningful after unlocking the penthouse', () => {
  const { rerender } = render(<LiftMeter score={600} />)
  expect(label()).toBe('Sky Penthouse, 100 points to a perfect climb')
  expect(fill()).toBe('scaleX(0)')
  rerender(<LiftMeter score={650} />)
  expect(label()).toBe('Sky Penthouse, 50 points to a perfect climb')
  expect(fill()).toBe('scaleX(0.5)')
  rerender(<LiftMeter score={700} />)
  expect(label()).toBe('Sky Penthouse, all the way up')
  expect(fill()).toBe('scaleX(1)')
})

it('starts again from empty when a lift is unlocked', () => {
  const { rerender } = render(<LiftMeter score={195} />)
  expect(label()).toBe('Upgraded HDB Lift, 5 points to the next lift')
  rerender(<LiftMeter score={200} />)
  expect(label()).toBe('Condominium Lift, 150 points to the next lift')
  expect(fill()).toBe('scaleX(0)')
})
