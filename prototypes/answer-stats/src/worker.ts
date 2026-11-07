// THROWAWAY PROTOTYPE (issue #17). Not production code: no tests against D1, no observability, no
// migrations, minimal error handling. It exists to check the design in docs/adr/001-answer-stats-backend.md.
//
//   POST /answers      count one daily round; returns that prompt's stats so far
//   GET  /stats/:date  final answer shares for a Singapore day that has ended

import { addDays, singaporeDateKey } from '../../../src/game/daily'
import type { Prompt } from '../../../src/game/types'
import { normalize } from '../../../src/game/normalize'
import { promptById, scheduledIds, scheduledPrompt } from './content'
import { dayState, isFinal, parseSubmission } from './rules'

interface Env {
  DB: D1Database
  RATE_LIMITER: RateLimit
  /** HMAC key for device hashes. A Worker secret in production; .dev.vars locally */
  DEVICE_HASH_SECRET?: string
  /** Comma-separated origins allowed to call the API cross-origin */
  ALLOWED_ORIGINS?: string
}

/** guess_counts rows older than this are deleted */
const GUESS_RETENTION_DAYS = 30

export interface AnswerShare {
  name: string
  count: number
  /** count / plays, misses included in plays */
  share: number
}

export interface PromptStats {
  promptId: string
  plays: number
  misses: number
  /** Most picked first; answers nobody gave are left out */
  answers: AnswerShare[]
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    if (request.method === 'POST' && url.pathname === '/answers') return withHeaders(await postAnswer(request, env), cors)

    const statsMatch = url.pathname.match(/^\/stats\/(\d{4}-\d{2}-\d{2})$/)
    if (request.method === 'GET' && statsMatch) return withHeaders(await getStats(statsMatch[1], env), cors)

    return withHeaders(json({ error: 'not_found' }, 404), cors)
  },

  /** Cron: drop raw, device-linked rows once their day has closed, and old guess counts */
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const now = new Date()
    const today = singaporeDateKey(now)
    const yesterday = addDays(today, -1)
    const oldestOpen = dayState(yesterday, now) === 'open' ? yesterday : today
    await env.DB.batch([
      env.DB.prepare('DELETE FROM submissions WHERE date < ?').bind(oldestOpen),
      env.DB.prepare('DELETE FROM guesses WHERE date < ?').bind(oldestOpen),
      env.DB.prepare('DELETE FROM guess_counts WHERE date < ?').bind(addDays(today, -GUESS_RETENTION_DAYS)),
    ])
  },
} satisfies ExportedHandler<Env>

async function postAnswer(request: Request, env: Env): Promise<Response> {
  // Keyed by IP, which is used in memory for the check and never stored. Shared IPs (CGNAT, school wifi)
  // share the limit, so it's generous: see the ADR
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local'
  const { success } = await env.RATE_LIMITER.limit({ key: ip })
  if (!success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' })

  if (!env.DEVICE_HASH_SECRET) return json({ error: 'server_misconfigured' }, 500)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'body must be JSON' }, 400)
  }

  const parsed = parseSubmission(body, scheduledPrompt)
  if (!parsed.ok) return json({ error: parsed.error }, parsed.status)
  const s = parsed.value

  const state = dayState(s.date, new Date())
  if (state === 'future') return json({ error: 'date is in the future' }, 400)
  if (state === 'closed') return json({ counted: false, reason: 'day_closed' }, 410)

  const deviceHash = await hmac(env.DEVICE_HASH_SECRET, `${s.date}:${s.deviceId}`)
  const insert = await env.DB.prepare(
    'INSERT OR IGNORE INTO submissions (date, prompt_id, device_hash, answer_key, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(s.date, s.promptId, deviceHash, s.answerKey, Date.now())
    .run()
  // A first insert didn't report changes === 1 locally (the counter trigger's rows seem to be included), so
  // test for any change at all; an ignored duplicate reports 0
  const counted = insert.meta.changes > 0

  // Only the first submission's guesses count, so resubmitting can't stuff the review queue.
  // Not atomic with the insert above; fine for a prototype
  if (counted && s.guesses.length) {
    const stmt = env.DB.prepare(
      'INSERT OR IGNORE INTO guesses (date, prompt_id, device_hash, guess_key, guess_text) VALUES (?, ?, ?, ?, ?)',
    )
    await env.DB.batch(s.guesses.map((g) => stmt.bind(s.date, s.promptId, deviceHash, g.key, g.text)))
  }

  const { results } = await env.DB.prepare(
    'SELECT prompt_id, answer_key, count FROM answer_counts WHERE date = ? AND prompt_id = ?',
  )
    .bind(s.date, s.promptId)
    .all<CountRow>()

  return json({ counted, ...(counted ? {} : { reason: 'duplicate' }), stats: toStats(s.promptId, results) })
}

async function getStats(date: string, env: Env): Promise<Response> {
  // Today's shares only ever come back in the POST /answers response for a prompt you've just played
  if (!isFinal(date, new Date())) return json({ error: 'day_in_progress' }, 403)

  const { results } = await env.DB.prepare('SELECT prompt_id, answer_key, count FROM answer_counts WHERE date = ?')
    .bind(date)
    .all<CountRow>()
  const prompts = scheduledIds(date).map((id) =>
    toStats(
      id,
      results.filter((r) => r.prompt_id === id),
    ),
  )
  // A closed day never changes again, so it can be cached hard at the edge and in the browser
  return json({ date, final: true, prompts }, 200, { 'Cache-Control': 'public, max-age=86400' })
}

interface CountRow {
  prompt_id: string
  answer_key: string
  count: number
}

function toStats(promptId: string, rows: readonly CountRow[]): PromptStats {
  const prompt = promptById(promptId)
  const plays = rows.reduce((sum, r) => sum + r.count, 0)
  const misses = rows.find((r) => r.answer_key === '')?.count ?? 0
  const answers = rows
    .filter((r) => r.answer_key !== '')
    .map((r) => ({ name: displayName(prompt, r.answer_key), count: r.count, share: round(r.count / plays) }))
    .sort((a, b) => b.count - a.count)
  return { promptId, plays, misses, answers }
}

/** Counts are keyed by normalize(name), so a key whose answer was renamed or removed shows as the bare key */
function displayName(prompt: Prompt | undefined, key: string): string {
  return prompt?.answers.find((a) => normalize(a.name) === key)?.name ?? key
}

function round(x: number): number {
  return Math.round(x * 10_000) / 10_000
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin')
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim())
  if (!origin || !allowed.includes(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

function withHeaders(response: Response, headers: Record<string, string>): Response {
  for (const [k, v] of Object.entries(headers)) response.headers.set(k, v)
  return response
}
