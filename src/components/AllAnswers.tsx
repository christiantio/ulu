import { useId, type ReactNode } from 'react'
import { TIER_INFO } from '../game/scoring'
import { TIERS, type Answer, type Prompt, type Tier } from '../game/types'
import { TierLamp } from './TierLamp'

const DEEPEST_FIRST = [...TIERS].reverse()

/** Every accepted answer, grouped by tier from the gem down, in alphabetical order within a tier */
function groupByTier(answers: readonly Answer[]): [Tier, Answer[]][] {
  return DEEPEST_FIRST.map((tier): [Tier, Answer[]] => [
    tier,
    answers.filter((a) => a.tier === tier).sort((a, b) => a.name.localeCompare(b.name)),
  ]).filter(([, group]) => group.length > 0)
}

interface GroupsProps {
  prompt: Prompt
  /** The answer the player locked in, marked in the list */
  yours: string | null
}

/** Every accepted answer, a list for each tier, deepest first. Never part of the share text */
export function AnswerGroups({ prompt, yours }: GroupsProps) {
  const baseId = useId()
  return (
    <div className="all-answers__groups">
      {groupByTier(prompt.answers).map(([tier, answers]) => {
        const labelId = `${baseId}-${tier}`
        const info = TIER_INFO[tier]
        return (
          <div key={tier} className={`all-answers__group tier--${tier}`}>
            <p className="all-answers__tier" id={labelId}>
              <TierLamp tier={tier} /> {info.label}{' '}
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
  )
}

interface Props extends GroupsProps {
  /** Shown at the bottom of the open list */
  children?: ReactNode
}

/** The same answers behind a "Show all N answers" disclosure */
export function AllAnswers({ prompt, yours, children }: Props) {
  return (
    <details className="all-answers">
      <summary>Show all {prompt.answers.length} answers</summary>
      <AnswerGroups prompt={prompt} yours={yours} />
      {children}
    </details>
  )
}
