// Throwaway harness for looking at the lift scenes. Not part of the app
import { createRoot } from 'react-dom/client'
import '../src/styles.css'
import '../src/components/elevator/elevator.css'
import { ElevatorScene } from '../src/components/elevator/ElevatorScene'
import { STAGES } from '../src/game/elevator'
import { TIER_INFO } from '../src/game/scoring'
import type { RoundResult, Tier } from '../src/game/types'

const q = new URLSearchParams(location.search)
const num = (k: string, d: number) => Number(q.get(k) ?? d)
const size = (q.get('size') ?? 'hero') as 'hero' | 'play' | 'finale'
const only = q.get('stage')
const tier = q.get('ride') as Tier | 'miss' | null
const ride: RoundResult | null = tier
  ? { promptId: 'x', input: 'x', attempts: [], answer: tier === 'miss' ? null : 'Bukit Brown', tier: tier === 'miss' ? null : tier, points: tier === 'miss' ? 0 : TIER_INFO[tier].points }
  : null
const h = q.get('h')

// The scene is fixed to the window. Here each one is fixed to a box of its own instead: a transformed element is
// what its fixed descendants are placed in
createRoot(document.getElementById('root')!).render(
  <div className={q.get('playing') ? 'game--playing' : ''} style={{ display: 'grid', gap: 12 }}>
    <style>{`.lift{height:100% !important}`}</style>
    {STAGES.filter((s) => !only || s.id === only).map((s) => (
      <div key={s.id} style={{ position: 'relative', height: Number(h ?? 640), transform: 'translateZ(0)', overflow: 'hidden' }}>
        <ElevatorScene score={num('score', s.min)} floor={num('floor', s.min === 0 ? 1 : Math.round(s.min * 0.065) + 1)} climbed={num('climbed', 0)} size={size} ride={ride} celebrate={!!q.get('celebrate')} jolt={num('jolt', 0)} />
      </div>
    ))}
  </div>,
)
