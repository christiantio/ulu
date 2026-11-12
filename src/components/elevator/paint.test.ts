import { expect, it, vi } from 'vitest'
import { sevenSegment } from './paint'
import { FLOORS } from '../../game/elevator'
import { LANDINGS_ABOVE } from './car'

it('draws all three digits of high floors instead of truncating the hundreds', () => {
  const brush = vi.fn()
  sevenSegment(brush, '140', 0, 0, 'lit', 'ghost')
  expect(brush).toHaveBeenCalledTimes(21)
  // The first digit is 1: only the two right-hand segments are lit.
  expect(brush.mock.calls.slice(0, 7).map(([colour]) => colour)).toEqual([
    'ghost', 'lit', 'lit', 'ghost', 'ghost', 'ghost', 'ghost',
  ])
  expect(brush.mock.calls.slice(14).every(([, x]) => x >= 20)).toBe(true)
})

it('draws enough landings to cover an entire gem ride and the view above it', () => {
  expect(LANDINGS_ABOVE).toBeGreaterThanOrEqual(FLOORS.gem + 3)
})
