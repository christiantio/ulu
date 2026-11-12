import { useEffect, useId, useMemo, useRef } from 'react'
import { shuffle } from '../game/daily'
import { floorsFor, floorsLabel, formatFloor, type Stage } from '../game/elevator'
import { UNLIMITED_DATE } from '../game/report'
import { TIER_INFO } from '../game/scoring'
import { TIERS, type Prompt, type RoundResult, type Tier } from '../game/types'
import { AllAnswers } from './AllAnswers'
import { KeyHint } from './KeyHint'
import { ProblemLinks, RejectedGuesses } from './Report'
import { TierLamp } from './TierLamp'

const SAMPLES_PER_TIER = 3
const DEEPEST_FIRST = [...TIERS].reverse().filter((t) => t !== 'gem')

interface Props {
  prompt: Prompt
  result: RoundResult
  isLast: boolean
  /** The dive's date for reports, or "unlimited" */
  reportDate?: string
  /** The floor the lift is on now, with this answer counted */
  floor?: number
  /** The lift this answer unlocked, if it carried the score over a threshold */
  upgrade?: Stage | null
  onNext: () => void
}

/**
 * After a round. The sign over the lift has how the player did, how far the lift went and the gem; the way on is
 * at the lift's foot; and what else was possible is on the cards beyond that
 */
export function Reveal({ prompt, result, isLast, reportDate = UNLIMITED_DATE, floor, upgrade = null, onNext }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  const verdictId = useId()
  // Without scrolling to it: on a phone the lift and the verdict stay in view, with the button just below them
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [])

  const gem = prompt.answers.find((a) => a.tier === 'gem')
  const samples = useMemo(() => {
    const byTier = new Map<Tier, string[]>()
    for (const tier of DEEPEST_FIRST) {
      const names = shuffle(
        prompt.answers.filter((a) => a.tier === tier && a.name !== result.answer).map((a) => a.name),
        Math.random,
      ).slice(0, SAMPLES_PER_TIER)
      if (names.length) byTier.set(tier, names)
    }
    return byTier
  }, [prompt, result.answer])

  const info = result.tier ? TIER_INFO[result.tier] : null
  const corrected = result.answer && result.input.toLowerCase() !== result.answer.toLowerCase()

  const floors = floorsFor(result.tier)

  return (
    <div className="reveal">
      <section className="reveal__board board">
        <p className="reveal__prompt">{prompt.text}</p>

        {/* Read out with the Next button, which describes itself by this */}
        <div id={verdictId} className="reveal__verdict">
          <div className={`verdict ${result.tier ? `tier--${result.tier}` : 'verdict--miss'}`}>
            <div className="verdict__floors" aria-hidden="true">
              {floors ? `▲${floors}` : '–'}
            </div>
            <div>
              <div className="verdict__label">{info?.label ?? 'Time up!'}</div>
              <div className="verdict__answer">
                {result.answer ? (
                  <>
                    {result.answer}
                    {corrected && <span className="muted"> (you typed “{result.input}”)</span>}
                  </>
                ) : (
                  'No valid answer'
                )}
              </div>
              <div className="verdict__blurb">
                {info ? info.blurb : 'The lift stays where it is.'}
                <span className="visually-hidden">
                  {' '}
                  {floors ? `Up ${floorsLabel(floors)}` : 'No floors gained'}
                  {floor !== undefined && `, now on floor ${formatFloor(floor)}`}.
                </span>
              </div>
            </div>
            <div className="verdict__points">
              +{result.points}
              <span className="visually-hidden"> points</span>
            </div>
          </div>

          {upgrade && (
            <p className="upgrade">
              <span className="upgrade__label">New lift unlocked</span> <strong>{upgrade.name}</strong>
            </p>
          )}
        </div>

        {gem && result.tier !== 'gem' && (
          <div className="gem">
            <span className="gem__label">
              <TierLamp tier="gem" /> The gem
            </span>
            <span className="gem__name">{gem.name}</span>
          </div>
        )}
      </section>

      <div className="dock">
        {/* Focus lands here, so the verdict is read with it */}
        <button ref={nextRef} className="btn btn--primary btn--block btn--big" onClick={onNext}
          onKeyDown={(e) => { if (e.repeat) e.preventDefault() }} aria-describedby={verdictId}>
          {isLast ? 'See results' : 'Next question →'}
          <KeyHint>Enter</KeyHint>
        </button>
      </div>

      <div className="reveal__more extras">
        {result.attempts.length > 0 && (
          <div className="card">
            <RejectedGuesses guesses={result.attempts} date={reportDate} promptId={prompt.id} />
          </div>
        )}

        <div className="samples card">
          <h3>Other answers</h3>
          {[...samples].map(([tier, names]) => (
            <div key={tier} className={`samples__row tier--${tier}`}>
              <span className="samples__tier">
                <TierLamp tier={tier} /> {TIER_INFO[tier].label}
              </span>
              <span className="samples__names">{names.join(', ')}</span>
            </div>
          ))}
          <AllAnswers prompt={prompt} yours={result.answer}>
            <ProblemLinks date={reportDate} promptId={prompt.id} />
          </AllAnswers>
        </div>
      </div>
    </div>
  )
}
