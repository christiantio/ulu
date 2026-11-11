import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../game/elevator'

interface Props {
  value: number
  /** Where the first count starts. Without it, the number is simply there, and only counts when it changes */
  from?: number
  ms?: number
}

/**
 * A number that counts up to its value instead of jumping to it.
 *
 * The element's text is always the real value, for screen readers and for anything else that reads the page. While
 * it counts, the running number is in `data-count`, and the stylesheet draws that over the real one (.count in
 * styles.css). With reduced motion it doesn't count
 */
export function CountUp({ value, from, ms = 600 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  // The number on screen right now, so a count that's interrupted carries on from where it had got to
  const shown = useRef(from ?? value)

  useEffect(() => {
    const el = ref.current
    const start = shown.current
    if (!el || start === value || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      shown.current = value
      return
    }
    const began = performance.now()
    let request = 0
    const frame = (now: number) => {
      const t = Math.min(Math.max((now - began) / ms, 0), 1)
      // Fast at first, then easing into the total
      shown.current = Math.round(start + (value - start) * (1 - (1 - t) ** 3))
      if (t < 1) {
        el.dataset.count = String(shown.current)
        request = requestAnimationFrame(frame)
      } else {
        delete el.dataset.count
      }
    }
    el.dataset.count = String(start)
    request = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(request)
      delete el.dataset.count
    }
  }, [value, ms])

  return (
    <span ref={ref} className="count">
      {value}
    </span>
  )
}
