import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportUrl, REPORT_KINDS, reportUrl, type Report } from './report'

const missing: Report = {
  kind: 'missing',
  date: '2026-11-10',
  promptId: 'transport-ccl-stations',
  guesses: ['Bras Basah & co', 'One People, One Nation', 'café?'],
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('buildReportUrl with a player form template', () => {
  const tally = 'https://tally.so/r/abc123?date={date}&prompt={prompt}&guesses={guesses}&kind={kind}'

  it('fills every placeholder, URL-encoded', () => {
    expect(buildReportUrl(missing, tally)).toBe(
      'https://tally.so/r/abc123?date=2026-11-10&prompt=transport-ccl-stations' +
        '&guesses=Bras%20Basah%20%26%20co%3B%20One%20People%2C%20One%20Nation%3B%20caf%C3%A9%3F&kind=Missing%20answer',
    )
  })

  it('fills a Google Forms prefill link, including repeated placeholders', () => {
    const google =
      'https://docs.google.com/forms/d/e/FORM/viewform?usp=pp_url&entry.1={kind}&entry.2={date}&entry.3={prompt}&entry.4={guesses}&entry.5={prompt}'
    const url = new URL(buildReportUrl({ ...missing, kind: 'tier', guesses: [] }, google))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      usp: 'pp_url',
      'entry.1': 'Tier feels off',
      'entry.2': '2026-11-10',
      'entry.3': 'transport-ccl-stations',
      'entry.4': '',
      'entry.5': 'transport-ccl-stations',
    })
  })

  it('uses the option text for each kind', () => {
    expect(REPORT_KINDS).toEqual({ missing: 'Missing answer', wrong: 'Wrong answer', tier: 'Tier feels off' })
    expect(buildReportUrl({ ...missing, kind: 'wrong' }, 'https://f.example/?k={kind}')).toBe(
      'https://f.example/?k=Wrong%20answer',
    )
  })

  it('leaves unknown placeholders alone and trims the template', () => {
    expect(buildReportUrl(missing, '  https://f.example/?d={date}&x={other}  ')).toBe(
      'https://f.example/?d=2026-11-10&x={other}',
    )
  })

  it('passes "unlimited" through as the date', () => {
    expect(buildReportUrl({ ...missing, date: 'unlimited' }, 'https://f.example/?d={date}')).toBe(
      'https://f.example/?d=unlimited',
    )
  })
})

describe('buildReportUrl without a template', () => {
  it.each([undefined, '', '   '])('links to the GitHub issue form with prefilled fields (template %j)', (template) => {
    const url = new URL(buildReportUrl(missing, template))
    expect(url.origin + url.pathname).toBe('https://github.com/christiantio/ulu/issues/new')
    expect([...url.searchParams]).toEqual([
      ['template', 'answer-report.yml'],
      ['title', 'Missing answer: transport-ccl-stations'],
      ['kind', 'Missing answer'],
      ['prompt', 'transport-ccl-stations'],
      ['dive', '2026-11-10'],
      ['answer', 'Bras Basah & co; One People, One Nation; café?'],
    ])
    // Spaces as %20, not +, so every form reads them the same way
    expect(url.search).not.toContain('+')
  })

  it('leaves the answer out when there are no guesses', () => {
    const url = new URL(buildReportUrl({ kind: 'tier', date: 'unlimited', promptId: 'food-kueh' }))
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: 'answer-report.yml',
      title: 'Tier feels off: food-kueh',
      kind: 'Tier feels off',
      prompt: 'food-kueh',
      dive: 'unlimited',
    })
  })
})

describe('reportUrl', () => {
  it('reads VITE_REPORT_URL when called', () => {
    vi.stubEnv('VITE_REPORT_URL', '')
    expect(reportUrl(missing)).toBe(buildReportUrl(missing))
    vi.stubEnv('VITE_REPORT_URL', 'https://f.example/?p={prompt}')
    expect(reportUrl(missing)).toBe('https://f.example/?p=transport-ccl-stations')
  })
})
