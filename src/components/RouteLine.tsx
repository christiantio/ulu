import { DESTINATIONS, MAX_SCORE } from '../game/scoring'

/** MRT-map style strip showing how far out of town the score has taken you */
export function RouteLine({ score, compact = false }: { score: number; compact?: boolean }) {
  const progress = Math.min(score / MAX_SCORE, 1)
  return (
    <div className={`route ${compact ? 'route--compact' : ''}`} aria-label={`${score} of ${MAX_SCORE} points`}>
      <div className="route__track">
        <div className="route__fill" style={{ width: `${progress * 100}%` }} />
        {DESTINATIONS.map((d) => (
          <div
            key={d.name}
            className={`route__stop ${score >= d.min ? 'route__stop--reached' : ''}`}
            style={{ left: `${(d.min / MAX_SCORE) * 100}%` }}
            title={d.name}
          />
        ))}
        <div className="route__train" style={{ left: `${progress * 100}%` }} aria-hidden>
          🚈
        </div>
      </div>
      {!compact && (
        <div className="route__labels">
          <span>{DESTINATIONS[0].name}</span>
          <span>{DESTINATIONS[DESTINATIONS.length - 1].name}</span>
        </div>
      )}
    </div>
  )
}
