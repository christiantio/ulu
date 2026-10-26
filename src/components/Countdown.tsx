import { useEffect, useState } from 'react'
import { msUntilNextDive } from '../game/daily'

function format(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Live HH:MM:SS until the next dive at Singapore midnight */
export function Countdown() {
  const [ms, setMs] = useState(() => msUntilNextDive())
  useEffect(() => {
    const id = window.setInterval(() => setMs(msUntilNextDive()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="countdown">{format(ms)}</span>
}
