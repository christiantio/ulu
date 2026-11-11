/** The shape of each pipeline stage's reply. Claude is asked for exactly these as structured output */
import { z } from 'zod'
import { CATEGORIES } from '../../src/game/types'

export const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      text: z.string().describe('The prompt as the player sees it, e.g. "Name a country the equator passes through"'),
      category: z.enum(CATEGORIES),
      setType: z.enum(['closed', 'open']).describe('closed = there is an authoritative, complete list'),
      size: z.number().describe('Roughly how many right answers there are'),
      easyAnswers: z.array(z.string()).describe('Four or five answers nearly everyone would give'),
      deepCuts: z.array(z.string()).describe('Three answers only a few would think of'),
      gem: z.string().describe('Your pick for the gem, with a few words on why it delights'),
      twist: z.string().describe('The decoy or catch that makes this more than a list, or "" if there is none'),
      sgAngle: z.string().describe('How Singapore comes into it, or "" if it does not'),
      accessibility: z.number().describe('Of 100 players, how many could name one right answer in 25 seconds'),
      risks: z.string().describe('Anything dated, arguable or hard to verify, or "" if nothing'),
      source: z.string().describe('Where the full list could be checked'),
    }),
  ),
})
export type Idea = z.infer<typeof IdeasSchema>['ideas'][number]

const AnswerSchema = z.object({
  name: z.string().describe('Official or most recognised spelling'),
  aliases: z.array(z.string()).describe('Only what matching cannot reach; [] if none'),
})

export const ListSchema = z.object({
  id: z.string().describe('kebab-case, <category>-<topic>, e.g. "world-equator-countries"'),
  text: z.string(),
  note: z.string().describe('One to three short sentences that settle scope; "" if the prompt needs none'),
  setType: z.enum(['closed', 'open']),
  expectedCount: z.number().describe('For a closed set, the number of members; 0 for an open set'),
  answers: z.array(AnswerSchema),
  unsure: z.array(z.object({ name: z.string(), reason: z.string() })).describe('Left out of answers; a person should check'),
  decoys: z.array(z.object({ name: z.string(), aliases: z.array(z.string()), why: z.string() })),
  filler: z.array(z.string()).describe('Words to ignore in every answer of this prompt; [] if none'),
  partial: z.boolean().describe('true for sets of people or multi-word place names'),
  gemCandidates: z.array(z.object({ name: z.string(), reason: z.string() })),
  timeSensitive: z.boolean(),
  reviewerNotes: z.string().describe('Sources to check against, dated facts, scope calls'),
})
export type AnswerList = z.infer<typeof ListSchema>

export const CheckSchema = z.object({
  verdict: z.enum(['ok', 'fixable', 'reject']).describe('reject = the set cannot be made correct and complete'),
  officialCount: z.number().describe('Members in the authoritative list the checker found; 0 if none'),
  wrong: z.array(z.object({ name: z.string(), reason: z.string(), source: z.string() })),
  disputed: z.array(z.object({ name: z.string(), reason: z.string() })),
  missing: z.array(z.object({ name: z.string(), aliases: z.array(z.string()), reason: z.string(), source: z.string() })),
  decoyProblems: z.array(z.object({ name: z.string(), reason: z.string() })),
  noteProblems: z.array(z.string()),
  unverified: z.array(z.string()).describe('Things the checker could not confirm either way'),
})
export type Check = z.infer<typeof CheckSchema>

export const PanelSchema = z.object({
  misses: z.number().describe('Of the 1,000 players, how many score nothing'),
  answers: z.array(
    z.object({
      name: z.string().describe('Exactly as in the list'),
      picks: z.number().describe('Of the 1,000 players, how many lock in this answer'),
      cleverPick: z.boolean().describe('Picked largely because players think it is obscure'),
    }),
  ),
  gemCandidates: z.array(z.object({ name: z.string(), reason: z.string() })),
})
export type Panel = z.infer<typeof PanelSchema>
