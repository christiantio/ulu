// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STAGES } from '../../game/elevator'
import { backdropFor, loadBackdrops, onBackdrops } from './backdrops'
import { ElevatorScene } from './ElevatorScene'

afterEach(cleanup)

/** The layers of scenery behind the boy: the far and mid backdrop, the landings, the pavement, the car */
const layers = () => document.querySelectorAll('.stage > .scene__layer').length

// These run in file order: the first ones are before the later lifts' chunk has been asked for
describe('backdrops', () => {
  it("has only the first lift's scenery to begin with: the rest is a chunk of its own", () => {
    expect(backdropFor('hdb')).not.toBeNull()
    for (const stage of STAGES.slice(1)) expect(backdropFor(stage.id)).toBeNull()
  })

  it("shows the first lift's scenery without waiting for anything", () => {
    render(<ElevatorScene score={0} floor={1} climbed={0} size="hero" />)
    // Far, mid, landings, the pavement of the ground floor, and the car
    expect(layers()).toBe(5)
  })

  it('stands a later lift in front of its sky, then adds the scenery when it arrives', async () => {
    const heard = vi.fn()
    const stop = onBackdrops(heard)
    render(<ElevatorScene score={350} floor={24} climbed={0} />)
    // The lift, the boy and the sky are there at once, with only the landings and the car drawn behind him
    expect(document.querySelector('.stage--cbd')).not.toBeNull()
    expect(document.querySelector('.boy')).not.toBeNull()
    expect((document.querySelector('.scene') as HTMLElement).dataset.floor).toBe('24')
    expect(layers()).toBe(2)

    // It asked for the scenery itself; this waits for the same request
    await act(async () => {
      await loadBackdrops()
    })
    expect(heard).toHaveBeenCalledTimes(1)
    expect(layers()).toBe(4)
    stop()
  })

  it('draws every lift once the chunk is in, each backdrop once, with the far layer slower than the near', async () => {
    await loadBackdrops()
    for (const stage of STAGES) {
      const backdrop = backdropFor(stage.id)!
      expect(backdrop.far.art.length).toBeGreaterThan(0)
      expect(backdrop.mid.art.length).toBeGreaterThan(0)
      expect(backdropFor(stage.id)).toBe(backdrop)
      expect(backdrop.far.rate).toBeLessThan(backdrop.mid.rate)
      expect(backdrop.mid.top).toBeLessThan(backdrop.mid.bottom)
    }
  })
})
