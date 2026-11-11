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

createRoot(document.getElementById('root')!).render(
  <div className={q.get('playing') ? 'game--playing' : ''} style={{ display: 'grid', gap: 12 }}>
    {h && <style>{`.scene{height:${h}px !important}`}</style>}
    {STAGES.filter((s) => !only || s.id === only).map((s) => (
      <ElevatorScene key={s.id} score={num('score', s.min)} floor={num('floor', s.min === 0 ? 1 : Math.round(s.min * 0.065) + 1)} climbed={num('climbed', 0)} size={size} ride={ride} celebrate={!!q.get('celebrate')} />
    ))}
  </div>,
)
