import { useId } from 'react'
import { STAGES, floorForScore, formatFloor, nextStage, stageFor, stageIndex } from '../game/elevator'
import { MAX_SCORE } from '../game/scoring'

/** How far the score has got towards the next lift, or towards a perfect climb once there are none left */
function goalFor(score: number) {
  const stage = stageFor(score)
  const next = nextStage(score)
  const target = next?.min ?? MAX_SCORE
  return {
    stage,
    next,
    remaining: Math.max(0, target - score),
    span: Math.min(1, Math.max(0, (score - stage.min) / (target - stage.min))),
  }
}

/**
 * A slim bar along the bottom of the score's window, filling up towards the next lift. It has no words of its
 * own: a screen reader hears which lift this is and how far it is to the next one
 */
export function LiftMeter({ score }: { score: number }) {
  const { stage, next, remaining, span } = goalFor(score)
  const goal = remaining === 0 ? 'all the way up' : `${remaining} points to ${next ? 'the next lift' : 'a perfect climb'}`
  return (
    <span className="meter" role="img" aria-label={`${stage.name}, ${goal}`}>
      <span className="meter__fill" style={{ transform: `scaleX(${span})` }} />
    </span>
  )
}

/**
 * The lift directory: every lift reached so far, and how many points the locked ones need. Lifts still to come
 * stay unnamed, so each one is a surprise
 */
export function LiftDirectory({ score, floor }: { score: number; floor: number }) {
  const goalId = useId()
  const { stage, next, remaining } = goalFor(score)
  const reached = stageIndex(score)
  const goal = remaining === 0 ? 'Top floor reached!' : `${remaining} pts to ${next ? 'next lift' : 'a perfect climb'}`
  // role="img" makes the label count and hides the decorative parts
  const label = `${score} of ${MAX_SCORE} points, floor ${formatFloor(floor)}, ${stage.name}`
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
