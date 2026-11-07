import { vi } from 'vitest'

/**
 * Stub matchMedia so `prefers-reduced-motion: reduce` matches (or, with `false`, doesn't). jsdom has no
 * matchMedia, which the app reads as no preference. With reduced motion, a round goes straight to its reveal
 * without the ride out of town (components/Journey.tsx). Undo it with vi.unstubAllGlobals()
 */
export function stubReducedMotion(reduce = true) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}
