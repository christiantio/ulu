import { useId, type ReactNode } from 'react'
import { TIER_INFO } from '../game/scoring'
import { TIERS, type Answer, type Prompt, type Tier } from '../game/types'

const DEEPEST_FIRST = [...TIERS].reverse()

/** Every accepted answer, grouped by tier from the gem down, in alphabetical order within a tier */
function groupByTier(answers: readonly Answer[]): [Tier, Answer[]][] {
  return DEEPEST_FIRST.map((tier): [Tier, Answer[]] => [
    tier,
    answers.filter((a) => a.tier === tier).sort((a, b) => a.name.localeCompare(b.name)),
  ]).filter(([, group]) => group.length > 0)
}

interface Props {
  prompt: Prompt
  /** The answer the player locked in, marked in the list */
  yours: string | null
  /** Extra words for screen readers on the toggle, so several on one page can be told apart */
  context?: string
  /** Shown at the bottom of the open list */
  children?: ReactNode
}

/** A "Show all N answers" disclosure, grouped by tier. Never part of the share text */
export function AllAnswers({ prompt, yours, context, children }: Props) {
  const baseId = useId()
  const groups = groupByTier(prompt.answers)

  return (
    <details className="all-answers">
      <summary>
        Show all {prompt.answers.length} answers
        {context && <span className="visually-hidden"> for {context}</span>}
      </summary>
      <div className="all-answers__groups">
        {groups.map(([tier, answers]) => {
          const labelId = `${baseId}-${tier}`
          const info = TIER_INFO[tier]
          return (
            <div key={tier} className={`all-answers__group tier--${tier}`}>
              <p className="all-answers__tier" id={labelId}>
                <span aria-hidden="true">{info.emoji}</span> {info.label}{' '}
                <span className="all-answers__points">
                  · {info.points} <span aria-hidden="true">pts</span>
                  <span className="visually-hidden">points</span>
                </span>
              </p>
              <ul className="all-answers__names" aria-labelledby={labelId}>
                {answers.map((a) => (
                  <li key={a.name} className={a.name === yours ? 'all-answers__yours' : undefined}>
                    {a.name}
                    {a.name === yours && (
                      <span className="all-answers__badge">
                        <span className="visually-hidden">, </span>your answer
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {children}
    </details>
  )
}
