// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchVisibleHeight } from './viewport'

/** A visual viewport whose height and zoom the test controls. jsdom has none */
function stubViewport(height: number) {
  const viewport = Object.assign(new EventTarget(), { height, scale: 1 })
  vi.stubGlobal('visualViewport', viewport)
  return {
    resize(next: number, scale = 1) {
      viewport.height = next
      viewport.scale = scale
      viewport.dispatchEvent(new Event('resize'))
    },
  }
}

const root = document.documentElement
const visibleHeight = () => root.style.getPropertyValue('--visible-height')

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('watchVisibleHeight', () => {
  it('does nothing where there is no visual viewport', () => {
    vi.stubGlobal('visualViewport', undefined)
    const stop = watchVisibleHeight()
    expect(visibleHeight()).toBe('')
    stop()
  })

  it('keeps the visible height on the root element, and clears it when stopped', () => {
    const viewport = stubViewport(window.innerHeight)
    const stop = watchVisibleHeight()
    expect(visibleHeight()).toBe(`${window.innerHeight}px`)
    expect(root.classList.contains('keyboard-open')).toBe(false)

    viewport.resize(window.innerHeight - 300)
    expect(visibleHeight()).toBe(`${window.innerHeight - 300}px`)
    expect(root.classList.contains('keyboard-open')).toBe(true)

    viewport.resize(window.innerHeight)
    expect(root.classList.contains('keyboard-open')).toBe(false)

    viewport.resize(window.innerHeight - 300)
    stop()
    expect(visibleHeight()).toBe('')
    expect(root.classList.contains('keyboard-open')).toBe(false)
  })

  it("doesn't take a browser bar sliding in for a keyboard", () => {
    const viewport = stubViewport(window.innerHeight)
    const stop = watchVisibleHeight()
    viewport.resize(window.innerHeight - 60)
    expect(visibleHeight()).toBe(`${window.innerHeight - 60}px`)
    expect(root.classList.contains('keyboard-open')).toBe(false)
    stop()
  })

  it('goes back to the top of the page when the keyboard opens on a question, and only then', () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    const viewport = stubViewport(window.innerHeight)
    const stop = watchVisibleHeight()

    viewport.resize(window.innerHeight - 300)
    expect(scrollTo).not.toHaveBeenCalled()

    viewport.resize(window.innerHeight)
    document.body.innerHTML = '<main class="game game--playing"></main>'
    viewport.resize(window.innerHeight - 300)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)

    // Closing the keyboard leaves the page where it is
    viewport.resize(window.innerHeight)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    stop()
  })

  it('stands down while the page is pinch-zoomed', () => {
    const viewport = stubViewport(window.innerHeight)
    const stop = watchVisibleHeight()
    viewport.resize(window.innerHeight / 2, 2)
    expect(visibleHeight()).toBe('')
    expect(root.classList.contains('keyboard-open')).toBe(false)
    viewport.resize(window.innerHeight, 1)
    expect(visibleHeight()).toBe(`${window.innerHeight}px`)
    stop()
  })
})
