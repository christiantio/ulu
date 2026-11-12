import { STAGES, formatFloor, nextStage, stageFor, stageIndex } from '../game/elevator'
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
  // role="img" makes the label count and hides the decorative parts
  const label = `${score} of ${MAX_SCORE} points, floor ${formatFloor(floor)}, ${stage.name}`

  if (compact) {
    const span = next ? (score - stage.min) / (next.min - stage.min) : 1
    return (
      <div className="plate" role="img" aria-label={label}>
        <span className="plate__name">{stage.name}</span>
        <span className="plate__bar">
          <span className="plate__fill" style={{ transform: `scaleX(${span})` }} />
        </span>
        <span className="plate__next">{next ? `Next lift at ${next.min}` : score >= MAX_SCORE ? 'Top floor' : 'Top lift'}</span>
      </div>
    )
  }

  const reached = stageIndex(score)
  return (
    <div className="directory" role="img" aria-label={label}>
      <p className="directory__title">Lift directory</p>
      <ol className="directory__list">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={`directory__row ${i < reached ? 'directory__row--passed' : ''} ${i === reached ? 'directory__row--here' : ''} ${i > reached ? 'directory__row--locked' : ''}`}
          >
            <span className="directory__lamp" />
            <span className="directory__name">{i <= reached ? s.name : '? ? ?'}</span>
            <span className="directory__min">{i === reached ? `Floor ${formatFloor(floor)}` : `${s.min} pts`}</span>
          </li>
        )).reverse()}
      </ol>
    </div>
  )
}
