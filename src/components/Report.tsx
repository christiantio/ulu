import { useId, type ReactNode } from 'react'
import { reportUrl, type Report } from '../game/report'

interface LinkProps {
  report: Report
  children: ReactNode
  /** Extra words for screen readers, e.g. which prompt it's about */
  context?: string
}

/** A link to the report form, opened in a new tab */
export function ReportLink({ report, children, context }: LinkProps) {
  return (
    <a className="report-link" href={reportUrl(report)} target="_blank" rel="noopener noreferrer">
      {children}
      {context && <span className="visually-hidden"> {context}</span>}{' '}
      <span className="visually-hidden">(opens in a new tab)</span>
      <span aria-hidden="true">↗</span>
    </a>
  )
}

interface GuessesProps {
  guesses: readonly string[]
  date: string
  promptId: string
  /** Extra words for screen readers on the link, e.g. which prompt it's about */
  context?: string
  compact?: boolean
}

/** The player's rejected guesses, and a link to report one as a missing answer */
export function RejectedGuesses({ guesses, date, promptId, context, compact }: GuessesProps) {
  const labelId = useId()
  if (guesses.length === 0) return null
  return (
    <div className={`attempts ${compact ? 'attempts--compact' : ''}`}>
      <p className="attempts__label" id={labelId}>
        Not on our list
      </p>
      <ul className="attempts__list" aria-labelledby={labelId}>
        {guesses.map((guess, i) => (
          <li key={i}>“{guess}”</li>
        ))}
      </ul>
      <ReportLink report={{ kind: 'missing', date, promptId, guesses }} context={context}>
        Should this count?
      </ReportLink>
    </div>
  )
}

/** "This answer is wrong" and "this tier feels off" links for one prompt */
export function ProblemLinks({ date, promptId, context }: { date: string; promptId: string; context?: string }) {
  return (
    <p className="report-problems">
      Spot a problem? <ReportLink report={{ kind: 'wrong', date, promptId }} context={context}>
        An answer is wrong
      </ReportLink>
      {' · '}
      <ReportLink report={{ kind: 'tier', date, promptId }} context={context}>
        A tier feels off
      </ReportLink>
    </p>
  )
}
