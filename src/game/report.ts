/**
 * Links for players to report a missing answer, a wrong answer or a tier that feels off.
 *
 * The player form is set at build time with VITE_REPORT_URL, a URL template with {date}, {prompt}, {guesses}
 * and {kind} placeholders (a Google Forms or Tally prefill link). Without it, reports go to the team's GitHub
 * issue form, .github/ISSUE_TEMPLATE/answer-report.yml.
 */

export type ReportKind = 'missing' | 'wrong' | 'tier'

/**
 * What {kind} becomes, and the option text of the "What's wrong?" question in both forms. Forms prefill a
 * choice by its text, so the forms' options must match these exactly
 */
export const REPORT_KINDS: Record<ReportKind, string> = {
  missing: 'Missing answer',
  wrong: 'Wrong answer',
  tier: 'Tier feels off',
}

/** The report date for an Unlimited game, which has no dive date */
export const UNLIMITED_DATE = 'unlimited'

export interface Report {
  kind: ReportKind
  /** The dive's Singapore date (YYYY-MM-DD), or "unlimited" */
  date: string
  promptId: string
  /** Rejected guesses, for a missing answer */
  guesses?: readonly string[]
}

export const GITHUB_ISSUE_URL = 'https://github.com/christiantio/ulu/issues/new'
export const GITHUB_REPORT_TEMPLATE = 'answer-report.yml'

/** Guesses go into one text field. Answers can contain commas ("Count On Me, Singapore"), so use semicolons */
export const GUESS_SEPARATOR = '; '

const PLACEHOLDER = /\{(date|prompt|guesses|kind)\}/g

/**
 * The report link. `template` is the player form's prefill URL; empty or missing means the GitHub issue form.
 * Every substituted value is URL-encoded, so the template itself should already be a valid URL
 */
export function buildReportUrl(report: Report, template?: string): string {
  const values = {
    date: report.date,
    prompt: report.promptId,
    guesses: (report.guesses ?? []).join(GUESS_SEPARATOR),
    kind: REPORT_KINDS[report.kind],
  }
  const form = template?.trim()
  if (form) return form.replace(PLACEHOLDER, (_, key: keyof typeof values) => encodeURIComponent(values[key]))

  // GitHub issue forms prefill a field from ?<field-id>=<value>. The kind is in the title too, in case the
  // dropdown isn't prefilled
  const params: [string, string][] = [
    ['template', GITHUB_REPORT_TEMPLATE],
    ['title', `${values.kind}: ${values.prompt}`],
    ['kind', values.kind],
    ['prompt', values.prompt],
    ['dive', values.date],
    ['answer', values.guesses],
  ]
  const query = params
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')
  return `${GITHUB_ISSUE_URL}?${query}`
}

/** The report link for this build's player form (VITE_REPORT_URL), read when called */
export function reportUrl(report: Report): string {
  return buildReportUrl(report, import.meta.env.VITE_REPORT_URL)
}
