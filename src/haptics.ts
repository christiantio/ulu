/**
 * A short buzz from the phone, where the browser can make one (Android; iOS Safari can't, and nothing happens
 * there). It backs up what's on screen and never stands in for it. Skipped for players who asked for less motion.
 */
import { prefersReducedMotion } from './game/elevator'

/** Milliseconds of buzz, pause, buzz… */
const PATTERNS = {
  /** An answer locked in */
  lock: [18],
  /** An answer refused: a quick double knock */
  refuse: [28, 50, 28],
  /** Out of time */
  timeUp: [110],
} as const

export type Buzz = keyof typeof PATTERNS

export function buzz(kind: Buzz): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function' || prefersReducedMotion()) return
    navigator.vibrate([...PATTERNS[kind]])
  } catch {
    // A browser that refuses (no user gesture yet, or blocked by policy) just doesn't buzz
  }
}
