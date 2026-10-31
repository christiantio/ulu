import { useEffect, useId, useMemo, useRef } from 'react'
import { MISS_EMOJI, TIER_INFO } from '../game/scoring'
import { TIERS, type Prompt, type RoundResult, type Tier } from '../game/types'

const SAMPLES_PER_TIER = 3
const DEEPEST_FIRST = [...TIERS].reverse().filter((t) => t !== 'gem')

interface Props {
  prompt: Prompt
  result: RoundResult
  isLast: boolean
  onNext: () => void
}

/** After a round: how the player did, the gem, and what else was possible */
export function Reveal({ prompt, result, isLast, onNext }: Props) {
  const nextRef = useRef<HTMLButtonElement>(null)
  const verdictId = useId()
  useEffect(() => nextRef.current?.focus(), [])

  const gem = prompt.answers.find((a) => a.tier === 'gem')
  const samples = useMemo(() => {
    const byTier = new Map<Tier, string[]>()
    for (const tier of DEEPEST_FIRST) {
      const names = prompt.answers
        .filter((a) => a.tier === tier && a.name !== result.answer)
        .map((a) => a.name)
        .sort(() => Math.random() - 0.5)
        .slice(0, SAMPLES_PER_TIER)
      if (names.length) byTier.set(tier, names)
    }
    return byTier
  }, [prompt, result.answer])

  const info = result.tier ? TIER_INFO[result.tier] : null
  const corrected = result.answer && result.input.toLowerCase() !== result.answer.toLowerCase()

  return (
    <section className="reveal">
      <p className="reveal__prompt">{prompt.text}</p>

      <div className={`verdict ${result.tier ? `tier--${result.tier}` : 'verdict--miss'}`} id={verdictId}>
        <div className="verdict__emoji" aria-hidden="true">
          {info?.emoji ?? MISS_EMOJI}
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
          {info && <div className="verdict__blurb">{info.blurb}</div>}
        </div>
        <div className="verdict__points">
          +{result.points}
          <span className="visually-hidden"> points</span>
        </div>
      </div>

      {gem && result.tier !== 'gem' && (
        <div className="gem">
          <span className="gem__label">
            <span aria-hidden="true">💎</span> The gem
          </span>
          <span className="gem__name">{gem.name}</span>
        </div>
      )}

      <div className="samples">
        <h3>Other answers</h3>
        {[...samples].map(([tier, names]) => (
          <div key={tier} className={`samples__row tier--${tier}`}>
            <span className="samples__tier">
              <span aria-hidden="true">{TIER_INFO[tier].emoji}</span> {TIER_INFO[tier].label}
            </span>
            <span className="samples__names">{names.join(', ')}</span>
          </div>
        ))}
        <p className="muted small">{prompt.answers.length} accepted answers in total.</p>
      </div>

      {/* Focus lands here, so the verdict is read with it */}
      <button ref={nextRef} className="btn btn--primary btn--block" onClick={onNext} aria-describedby={verdictId}>
        {isLast ? 'See results' : 'Next prompt →'}
      </button>
    </section>
  )
}
