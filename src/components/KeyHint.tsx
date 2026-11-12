import type { ReactNode } from 'react'

/**
 * The key that does what a button does, shown on the button where there's a keyboard to press it on (a mouse or
 * trackpad, not a touch screen: see .key-hint in styles.css). Decorative: the button's own name doesn't change
 */
export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="key-hint" aria-hidden="true">
      {children}
    </kbd>
  )
}
