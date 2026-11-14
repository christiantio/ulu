// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STAGES } from '../game/elevator'
import { HowToPlay } from './HowToPlay'

afterEach(cleanup)

const rows = () => within(screen.getByRole('list', { name: 'The lifts, from the top' })).getAllByRole('listitem')
const named = () => rows().filter((row) => !row.classList.contains('directory__row--locked'))

describe('HowToPlay', () => {
  it('lists every lift from the top with the points it takes, and names only those the best score reached', () => {
    render(<HowToPlay best={300} onClose={vi.fn()} />)
    expect(rows().map((row) => parseInt(row.querySelector('.directory__min')!.textContent!))).toEqual(
      [...STAGES].reverse().map((s) => s.min),
    )
    expect(named().map((row) => row.querySelector('.directory__name')!.textContent)).toEqual([
      'Condominium Lift',
      'Upgraded HDB Lift',
      'HDB Lift',
    ])
    // The ones still to come are a surprise
    expect(screen.queryByText('CBD Office Tower')).toBeNull()
    expect(screen.getAllByText('Still to find')).toHaveLength(3)
    // The furthest the player has got stands out
    expect(screen.getByText('Condominium Lift').closest('li')!.classList.contains('directory__row--best')).toBe(true)
  })

  it('names only the first lift for a new player, and all of them after a perfect game', () => {
    render(<HowToPlay onClose={vi.fn()} />)
    expect(named().map((row) => row.querySelector('.directory__name')!.textContent)).toEqual(['HDB Lift'])
    cleanup()

    render(<HowToPlay best={700} onClose={vi.fn()} />)
    expect(named()).toHaveLength(STAGES.length)
    expect(screen.getByText('Sky Penthouse').closest('li')!.classList.contains('directory__row--best')).toBe(true)
  })

  it('counts in points, not floors', () => {
    render(<HowToPlay best={300} onClose={vi.fn()} />)
    const text = screen.getByRole('dialog', { name: 'How to play' }).textContent
    // "Top-floor stuff" is the gem's blurb, not a count
    expect(text).not.toMatch(/▲|\d\s*floors?\b|\bfloors?\s*\d/i)
  })
})
