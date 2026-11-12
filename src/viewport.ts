/**
 * The height of the page that's actually visible, kept in --visible-height on <html>, with the class
 * `keyboard-open` while an on-screen keyboard is taking up part of the screen.
 *
 * A phone's on-screen keyboard covers the bottom of the page without changing its height: `100dvh` still
 * measures the whole screen. The visual viewport is the part left above the keyboard, and the round's layout
 * (styles.css) fits itself into it, so the clock, the question and the answer box all stay in view while typing.
 * Without the API, the variable is never set and the layout falls back to `100dvh`.
 */

/** A keyboard takes at least this much of the screen. Browser bars sliding in and out take less */
const KEYBOARD_MIN_PX = 120
/** On <html> while the keyboard is up, for the few things that step aside to make room */
const KEYBOARD_CLASS = 'keyboard-open'

/** Starts tracking. Returns a function that stops it */
export function watchVisibleHeight(): () => void {
  const viewport = typeof window === 'undefined' ? null : window.visualViewport
  if (!viewport) return () => {}
  const root = document.documentElement
  let shown = 0

  const update = () => {
    // Pinch-zoomed: the visual viewport is a magnified part of the page, not the room there is to lay it out in
    if (Math.abs(viewport.scale - 1) > 0.01) {
      shown = 0
      root.style.removeProperty('--visible-height')
      root.classList.remove(KEYBOARD_CLASS)
      return
    }
    const height = Math.round(viewport.height)
    if (height === shown) return
    const shrank = height < shown
    shown = height
    root.style.setProperty('--visible-height', `${height}px`)
    const keyboardOpen = window.innerHeight - height > KEYBOARD_MIN_PX
    root.classList.toggle(KEYBOARD_CLASS, keyboardOpen)
    // The browser scrolls the answer box into view as the keyboard opens, before the round has made itself fit.
    // Once it fits, it fits from the top of the page
    if (shrank && keyboardOpen && document.querySelector('.game--playing')) window.scrollTo(0, 0)
  }

  update()
  viewport.addEventListener('resize', update)
  return () => {
    viewport.removeEventListener('resize', update)
    root.style.removeProperty('--visible-height')
    root.classList.remove(KEYBOARD_CLASS)
  }
}
