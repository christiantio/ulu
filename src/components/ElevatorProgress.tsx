import { STAGES, nextStage, stageFor, stageIndex } from '../game/elevator'
import { MAX_SCORE } from '../game/scoring'

/**
 * A slim bar along the bottom of the score's window, filling up towards the next lift, or towards a perfect climb
 * once there are none left. It has no words of its own: a screen reader hears which lift this is and how far it is
 * to the next one
 */
export function LiftMeter({ score }: { score: number }) {
  const stage = stageFor(score)
  const next = nextStage(score)
  const target = next?.min ?? MAX_SCORE
  const remaining = Math.max(0, target - score)
  const span = Math.min(1, Math.max(0, (score - stage.min) / (target - stage.min)))
  const goal = remaining === 0 ? 'all the way up' : `${remaining} points to ${next ? 'the next lift' : 'a perfect climb'}`
  return (
    <span className="meter" role="img" aria-label={`${stage.name}, ${goal}`}>
      <span className="meter__fill" style={{ transform: `scaleX(${span})` }} />
    </span>
  )
}

/**
 * The lift directory, in How to play: every lift and the points it takes, from the top down. A lift is named once
 * the player's best score has reached it, so the ones still to come stay a surprise
 */
export function LiftDirectory({ best }: { best: number }) {
  const reached = stageIndex(best)
  return (
    <div className="directory">
      <p className="directory__title" aria-hidden="true">
        Lift directory
      </p>
      <ol className="directory__list" aria-label="The lifts, from the top">
        {STAGES.map((s, i) => (
          <li
            key={s.id}
            className={`directory__row ${i <= reached ? 'directory__row--reached' : 'directory__row--locked'} ${i === reached ? 'directory__row--best' : ''}`}
          >
            <span className="directory__lamp" aria-hidden="true" />
            <span className="directory__name">
              {i <= reached ? (
                s.name
              ) : (
                <>
                  <span aria-hidden="true">? ? ?</span>
                  <span className="visually-hidden">Still to find</span>
                </>
              )}
            </span>
            <span className="directory__min">
              {s.min} <span aria-hidden="true">pts</span>
              <span className="visually-hidden">points</span>
            </span>
          </li>
        )).reverse()}
      </ol>
    </div>
  )
}
