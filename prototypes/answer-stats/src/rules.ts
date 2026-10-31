// THROWAWAY PROTOTYPE (issue #17). Not production code.
//
// Pure submission rules: which dates are open, what a valid body looks like, and which rejected guesses are
// safe to keep. No Worker APIs, so they're unit tested with plain vitest.

import { addDays, singaporeDateKey } from '../../../src/game/daily'
import { normalize } from '../../../src/game/normalize'
import type { Prompt } from '../../../src/game/types'

/** A dive still in progress at midnight can submit for this long after the day ends */
export const GRACE_MS = 30 * 60_000
/** At most this many rejected guesses are read per submission */
export const MAX_ATTEMPTS = 10
/** Longer guesses are dropped, not truncated: real answers are short */
export const MAX_GUESS_LENGTH = 40

export type DayState = 'open' | 'closed' | 'future'

/** Whether submissions for a Singapore date are accepted at `now` */
export function dayState(date: string, now: Date): DayState {
  const today = singaporeDateKey(now)
  if (date > today) return 'future'
  if (date === today) return 'open'
  // Yesterday stays open for the grace period after Singapore midnight
  const yesterday = addDays(today, -1)
  if (date === yesterday && singaporeDateKey(new Date(now.getTime() - GRACE_MS)) === yesterday) return 'open'
  return 'closed'
}

/** True once a day can no longer change, so its stats are final and safe to publish */
export function isFinal(date: string, now: Date): boolean {
  return dayState(date, now) === 'closed'
}

export interface Submission {
  date: string
  promptId: string
  deviceId: string
  /** normalize() of the matched canonical name, or '' for a miss */
  answerKey: string
  /** Scrubbed rejected guesses, unique by key */
  guesses: { key: string; text: string }[]
}

export type ParseResult = { ok: true; value: Submission } | { ok: false; status: number; error: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/**
 * Check a POST /answers body against the content: the prompt must be scheduled on that date and the answer
 * must be one of its canonical names. `prompt` is the scheduled prompt with that id, or undefined.
 */
export function parseSubmission(body: unknown, prompt: (date: string, id: string) => Prompt | undefined): ParseResult {
  if (typeof body !== 'object' || body === null) return bad('body must be a JSON object')
  const b = body as Record<string, unknown>
  if (typeof b.date !== 'string' || !DATE.test(b.date)) return bad('date must be YYYY-MM-DD')
  if (typeof b.promptId !== 'string') return bad('promptId must be a string')
  if (typeof b.deviceId !== 'string' || !DEVICE.test(b.deviceId)) return bad('deviceId must be a v4 UUID')
  if (b.answer !== null && typeof b.answer !== 'string') return bad('answer must be a string or null')
  if (b.attempts !== undefined && !(Array.isArray(b.attempts) && b.attempts.every((a) => typeof a === 'string')))
    return bad('attempts must be an array of strings')

  const p = prompt(b.date, b.promptId)
  if (!p) return { ok: false, status: 422, error: 'prompt is not scheduled on that date' }

  let answerKey = ''
  if (b.answer !== null) {
    const key = normalize(b.answer)
    if (!p.answers.some((a) => normalize(a.name) === key))
      return { ok: false, status: 422, error: 'answer is not a canonical answer for that prompt' }
    answerKey = key
  }

  const known = new Set(p.answers.flatMap((a) => [a.name, ...(a.aliases ?? [])]).map(normalize))
  return {
    ok: true,
    value: {
      date: b.date,
      promptId: b.promptId,
      deviceId: b.deviceId,
      answerKey,
      guesses: scrubGuesses((b.attempts as string[] | undefined) ?? [], known),
    },
  }
}

const EMAIL_OR_URL = /@|https?:|www\./i
const LONG_NUMBER = /\d[\d\s-]{6,}\d/ // 8+ digit phone numbers and similar
const NRIC = /\b[stfgm]\d{7}[a-z]\b/i // NRIC/FIN shape

/**
 * Keep only guesses that look like attempts at an answer. Drops anything long or shaped like personal data,
 * known answers (e.g. a match the client missed), and repeats.
 */
export function scrubGuesses(attempts: readonly string[], known: ReadonlySet<string>): { key: string; text: string }[] {
  const out = new Map<string, string>()
  for (const raw of attempts.slice(0, MAX_ATTEMPTS)) {
    const text = raw.trim().replace(/\s+/g, ' ')
    if (text.length > MAX_GUESS_LENGTH) continue
    if (EMAIL_OR_URL.test(text) || LONG_NUMBER.test(text) || NRIC.test(text)) continue
    const key = normalize(text)
    if (!key || known.has(key) || out.has(key)) continue
    out.set(key, text)
  }
  return [...out].map(([key, text]) => ({ key, text }))
}

function bad(error: string): ParseResult {
  return { ok: false, status: 400, error }
}
