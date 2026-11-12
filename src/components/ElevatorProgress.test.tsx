// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ElevatorProgress } from './ElevatorProgress'

afterEach(cleanup)

it('shows points remaining, a destination floor and an accessible goal', () => {
  render(<ElevatorProgress score={85} floor={17} compact />)
  const plate = screen.getByRole('img')
  expect(plate.getAttribute('aria-label')).toBe('85 of 700 points, floor 17, HDB Lift')
  const goal = document.getElementById(plate.getAttribute('aria-describedby')!)!
  expect(goal.textContent).toContain('15 pts to next lift')
  expect(goal.textContent).toContain('Floor 20 · 5 pts = 1 floor')
  expect((plate.querySelector('.plate__fill') as HTMLElement).style.transform).toBe('scaleX(0.85)')
})

it('keeps the final 100 points meaningful after unlocking the penthouse', () => {
  const { rerender } = render(<ElevatorProgress score={600} floor={120} compact />)
  const fill = () => (document.querySelector('.plate__fill') as HTMLElement).style.transform
  expect(screen.getByText('100 pts to a perfect climb')).toBeDefined()
  expect(fill()).toBe('scaleX(0)')
  rerender(<ElevatorProgress score={650} floor={130} compact />)
  expect(screen.getByText('50 pts to a perfect climb')).toBeDefined()
  expect(fill()).toBe('scaleX(0.5)')
  rerender(<ElevatorProgress score={700} floor={140} compact />)
  expect(screen.getByText('Top floor reached!')).toBeDefined()
  expect(fill()).toBe('scaleX(1)')
})

it('resets progress toward the next destination when a lift is unlocked', () => {
  const { rerender } = render(<ElevatorProgress score={195} floor={39} compact />)
  expect(screen.getByText('5 pts to next lift')).toBeDefined()
  rerender(<ElevatorProgress score={200} floor={40} compact />)
  expect(screen.getByText('150 pts to next lift')).toBeDefined()
  expect(screen.getByText('Floor 70 · 5 pts = 1 floor')).toBeDefined()
  expect((document.querySelector('.plate__fill') as HTMLElement).style.transform).toBe('scaleX(0)')
})
