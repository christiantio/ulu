/**
 * The two ways the pipeline talks to Claude. Everything else in scripts/generate/ is plain code that takes an
 * `Llm`, so tests run the whole pipeline against a stub with no network and no key.
 *
 * Credentials come from ANTHROPIC_API_KEY or an `ant auth login` profile. This is offline tooling: the game
 * itself never calls the API.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface Request {
  /** A short name for the stage, for progress lines and errors */
  stage: string
  system: string
  user: string
  effort: Effort
}

export interface Llm {
  /** One reply, parsed and validated against `schema` */
  ask<T>(schema: z.ZodType<T>, request: Request): Promise<T>
  /** A free-text reply, with web search when `search` is on */
  research(request: Request & { search: boolean }): Promise<string>
}

const MODEL = 'claude-opus-5-5'
// Replies are streamed, so a long answer list can't hit an HTTP timeout
const MAX_TOKENS = 64_000
// If the model declines a request, the API retries it on another model rather than failing the draft
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
/** A long search can pause for the server to be called again; give up after this many resumptions */
const MAX_RESUMES = 5

function fail(stage: string, why: string): never {
  throw new Error(`${stage}: ${why}`)
}

export function claude(client: Anthropic = new Anthropic()): Llm {
  return {
    async ask(schema, { stage, system, user, effort }) {
      const message = await client.beta.messages
        .stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive' },
          output_config: { effort, format: betaZodOutputFormat(schema) },
          ...FALLBACK,
          system,
          messages: [{ role: 'user', content: user }],
        })
        .finalMessage()
      if (message.stop_reason === 'refusal') fail(stage, 'the model declined the request')
      if (message.stop_reason === 'max_tokens') fail(stage, 'the reply was cut off before it finished')
      return message.parsed_output ?? fail(stage, 'the reply did not match the expected shape')
    },

    async research({ stage, system, user, effort, search }) {
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: user }]
      for (let turn = 0; turn <= MAX_RESUMES; turn++) {
        const message = await client.beta.messages
          .stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            thinking: { type: 'adaptive' },
            output_config: { effort },
            ...FALLBACK,
            system,
            tools: search ? [{ type: 'web_search_20260209', name: 'web_search', max_uses: 15 }] : [],
            messages,
          })
          .finalMessage()
        if (message.stop_reason === 'refusal') fail(stage, 'the model declined the request')
        // The server-side search loop hit its limit: send the turn back as it is and the server carries on
        if (message.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content: message.content })
          continue
        }
        const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
        return text.trim() || fail(stage, 'the reply had no text')
      }
      return fail(stage, `still searching after ${MAX_RESUMES} resumptions`)
    },
  }
}

/** Describe an API failure in a line a person can act on */
export function explain(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError)
    return 'No valid Claude credentials. Set ANTHROPIC_API_KEY, or run `ant auth login`.'
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited by the API. Wait a minute and run it again.'
  if (error instanceof Anthropic.APIConnectionError) return `Could not reach the API (${error.message}).`
  if (error instanceof Anthropic.APIError) return `The API returned an error (${error.status}): ${error.message}`
  // Raised before any request is sent, most often because no credentials were found
  if (error instanceof Anthropic.AnthropicError)
    return `${error.message}. Credentials come from ANTHROPIC_API_KEY or an \`ant auth login\` profile.`
  return error instanceof Error ? error.message : String(error)
}
