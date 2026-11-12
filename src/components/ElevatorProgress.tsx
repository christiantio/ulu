import { useId } from 'react'
import { POINTS_PER_FLOOR, STAGES, floorForScore, formatFloor, nextStage, stageFor, stageIndex } from '../game/elevator'
import { MAX_SCORE } from '../game/scoring'

interface Props {
  score: number
  floor: number
  /** A small plate for the status along the top of the window, instead of the whole directory */
  compact?: boolean
}

/**
 * How far the score has taken the lift. Compact, it's a plate with the lift's name and a bar to the next one. In
 * full, it's the lift directory: every lift reached so far, and how many points the locked ones need. Lifts still
 * to come stay unnamed, so each one is a surprise
 */
export function ElevatorProgress({ score, floor, compact = false }: Props) {
  const stage = stageFor(score)
  const next = nextStage(score)
  const goalId = useId()
  const target = next?.min ?? MAX_SCORE
  const remaining = Math.max(0, target - score)
  const goal = remaining === 0 ? 'Top floor reached!' : `${remaining} pts to ${next ? 'next lift' : 'a perfect climb'}`
  // role="img" makes the label count and hides the decorative parts
  const label = `${score} of ${MAX_SCORE} points, floor ${formatFloor(floor)}, ${stage.name}`

  if (compact) {
    const span = Math.min(1, Math.max(0, (score - stage.min) / (target - stage.min)))
    return (
      <div className="plate" role="img" aria-label={label} aria-describedby={goalId}>
        <span className="plate__name">{stage.name}</span>
        <span className="plate__bar">
          <span className="plate__fill" style={{ transform: `scaleX(${span})` }} />
        </span>
        <span className="plate__next" id={goalId}>
          <strong>{goal}</strong>
          <span>Floor {formatFloor(floorForScore(target))} · {POINTS_PER_FLOOR} pts = 1 floor</span>
        </span>
      </div>
    )
  }

  const reached = stageIndex(score)
  return (
    <div className="directory" role="img" aria-label={label} aria-describedby={goalId}>
      <p className="directory__title">Lift directory</p>
      <p className="directory__goal" id={goalId}>{goal}</p>
      <ol className="directory__list">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={`directory__row ${i < reached ? 'directory__row--passed' : ''} ${i === reached ? 'directory__row--here' : ''} ${i > reached ? 'directory__row--locked' : ''}`}
          >
            <span className="directory__lamp" />
            <span className="directory__name">{i <= reached ? s.name : '? ? ?'}</span>
            <span className="directory__min">{i === reached ? `Floor ${formatFloor(floor)}` : `${s.min} pts · Floor ${formatFloor(floorForScore(s.min))}`}</span>
          </li>
        )).reverse()}
      </ol>
    </div>
  )
}
