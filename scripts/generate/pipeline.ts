/**
 * The question pipeline: ideas, then for one chosen idea, list → check → panel → tiers → lint.
 *
 * Nothing here publishes anything. The result is a draft for a person to review, with the evidence each stage
 * produced kept next to it.
 */
import { matchProblems } from '../../src/game/match'
import { normalize } from '../../src/game/normalize'
import { scopeOf, type Answer, type Category, type Decoy, type Pack, type Prompt, type Scope } from '../../src/game/types'
import { validatePacks } from '../../src/game/validate'
import { CHECK, CHECK_SUMMARY, IDEAS, LIST, PANEL, PANELS } from './brief'
import type { Llm } from './llm'
import { CheckSchema, IdeasSchema, ListSchema, PanelSchema, type AnswerList, type Check, type Idea } from './schemas'
import { assignTiers, type Estimate } from './tiers'

/** Ideas the model itself rates below this are dropped: fewer than this many of 100 players could answer */
export const MIN_ACCESSIBILITY = 80

export interface IdeasRequest {
  scope: Scope
  categories: readonly Category[]
  count: number
  /** An optional steer, e.g. "food and drink" or "things with a Singapore decoy" */
  theme?: string
  /** Prompt texts already in the bank, so ideas don't repeat them */
  existing: readonly string[]
}

export function ideasRequest({ scope, categories, count, theme, existing }: IdeasRequest): string {
  return [
    `Propose ${count} ${scope === 'sg' ? 'Singapore' : 'world'} prompt ideas.`,
    `Categories to use: ${categories.join(', ')}.`,
    theme ? `Steer from the team: ${theme}` : '',
    `Prompts already in the bank (don't repeat or closely overlap these):\n${existing.map((t) => `- ${t}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Stage 1: propose ideas, best first, without the ones too niche to keep */
export async function proposeIdeas(llm: Llm, request: IdeasRequest): Promise<{ kept: Idea[]; dropped: Idea[] }> {
  const { ideas } = await llm.ask(IdeasSchema, {
    stage: 'ideas',
    system: IDEAS(request.scope),
    user: ideasRequest(request),
    effort: 'medium',
  })
  const taken = new Set(request.existing.map(normalize))
  const fresh = ideas.filter((i) => request.categories.includes(i.category) && !taken.has(normalize(i.text)))
  const byAccess = [...fresh].sort((a, b) => b.accessibility - a.accessibility)
  return {
    kept: byAccess.filter((i) => i.accessibility >= MIN_ACCESSIBILITY),
    dropped: byAccess.filter((i) => i.accessibility < MIN_ACCESSIBILITY),
  }
}

const sameName = (a: string, b: string) => normalize(a) === normalize(b)

/** The draft as the checker and the panels see it: no tiers, no reasoning, nothing to anchor on */
export function describeList(list: Pick<AnswerList, 'text' | 'note' | 'answers' | 'decoys'>): string {
  const answers = list.answers.map((a) => `- ${a.name}${a.aliases.length ? ` (also: ${a.aliases.join(', ')})` : ''}`)
  const decoys = list.decoys.map((d) => `- ${d.name}: ${d.why}`)
  return [
    `Prompt: ${list.text}`,
    `Note shown to players: ${list.note || '(none)'}`,
    `Accepted answers (${answers.length}):\n${answers.join('\n')}`,
    `Decoys, with the reason shown to the player (${decoys.length}):\n${decoys.join('\n') || '(none)'}`,
  ].join('\n\n')
}

/**
 * Apply a fact-check to a list: drop what's wrong, add what's missing. Disputed answers stay in, flagged for
 * the reviewer, because removing a right answer is as bad as keeping a wrong one.
 */
export function applyCheck(list: AnswerList, check: Check): AnswerList {
  const wrong = (name: string) => check.wrong.some((w) => sameName(w.name, name))
  const answers = list.answers.filter((a) => !wrong(a.name))
  for (const m of check.missing) {
    const known = answers.find((a) => [a.name, ...a.aliases].some((label) => sameName(label, m.name)))
    if (!known) answers.push({ name: m.name, aliases: m.aliases })
  }
  // A decoy the checker doubts, or one that turned out to be a right answer, can't stay a decoy
  const isAnswer = (name: string) => answers.some((a) => [a.name, ...a.aliases].some((label) => sameName(label, name)))
  const decoys = list.decoys.filter((d) => !check.decoyProblems.some((p) => sameName(p.name, d.name)) && !isAnswer(d.name))
  return { ...list, answers, decoys }
}

export interface Draft {
  prompt: Prompt
  /** Everything a reviewer needs to judge the draft */
  review: {
    setType: AnswerList['setType']
    /** Members the writer and the checker each expected, for a closed set */
    counts: { answers: number; expected: number; official: number }
    check: Check
    /** The checker's report in its own words */
    checkReport: string
    unsure: AnswerList['unsure']
    estimates: Estimate[]
    /** Problems that fail validation; the draft can't ship until these are fixed */
    errors: string[]
    /** Things to look at: thin evidence, crowded answers, mismatched counts */
    warnings: string[]
    writerNotes: string
  }
}

export interface DraftRequest {
  category: Category
  /** The prompt idea, e.g. "Name a country the equator passes through", plus anything from the ideas stage */
  idea: string
  today: string
  /** Let the checker search the web. Off, it checks from what the model knows */
  search: boolean
  onStage?: (stage: string) => void
}

/** Stage 2: take one idea all the way to a reviewable draft */
export async function draftPrompt(llm: Llm, { category, idea, today, search, onStage }: DraftRequest): Promise<Draft> {
  const scope = scopeOf(category)

  onStage?.('list: compiling every right answer')
  const written = await llm.ask(ListSchema, {
    stage: 'list',
    system: LIST(scope),
    user: `Category: ${category}\nPrompt idea: ${idea}\nToday's date: ${today}`,
    effort: 'high',
  })

  onStage?.(`check: fact-checking ${written.answers.length} answers${search ? ' with web search' : ''}`)
  const checkReport = await llm.research({
    stage: 'check',
    system: CHECK(today),
    user: `${describeList(written)}\n\nThe writer says this is ${written.setType === 'closed' ? `a closed set of ${written.expectedCount}` : 'an open set'}.`,
    effort: 'high',
    search,
  })
  const check = await llm.ask(CheckSchema, {
    stage: 'check summary',
    system: CHECK_SUMMARY,
    user: `The draft:\n\n${describeList(written)}\n\nThe fact-checker's report:\n\n${checkReport}`,
    effort: 'low',
  })
  const list = applyCheck(written, check)

  onStage?.(`panel: estimating what ${PANELS.length} groups of players would type`)
  const names = list.answers.map((a) => a.name)
  const panels = await Promise.all(
    PANELS.map(async (panel) => {
      const result = await llm.ask(PanelSchema, {
        stage: `panel (${panel.id})`,
        system: PANEL(panel.who),
        user: `Prompt: ${list.text}\nNote shown to players: ${list.note || '(none)'}\n\nThe accepted answers:\n${names.map((n) => `- ${n}`).join('\n')}`,
        effort: 'medium',
      })
      return { ...result, weight: panel.weight }
    }),
  )
  const estimates = assignTiers(names, panels, list.gemCandidates.map((g) => g.name))

  const tierOf = new Map(estimates.map((e) => [e.name, e.tier]))
  const answers: Answer[] = list.answers.map((a) => ({
    name: a.name,
    ...(a.aliases.length ? { aliases: a.aliases } : {}),
    tier: tierOf.get(a.name) ?? 'ulu',
  }))
  const decoys: Decoy[] = list.decoys.map((d) => ({ name: d.name, ...(d.aliases.length ? { aliases: d.aliases } : {}), why: d.why }))
  const prompt: Prompt = {
    id: list.id,
    category,
    text: list.text,
    ...(list.note ? { note: list.note } : {}),
    answers,
    ...(decoys.length ? { decoys } : {}),
    ...(list.filler.length ? { filler: list.filler } : {}),
    ...(list.partial ? { partial: true } : {}),
  }

  onStage?.('lint: validating the draft')
  const errors = validatePacks({ [`${prompt.id}.json`]: asPack(prompt, today) })
  const warnings = [...matchProblems(prompt).warnings]
  if (check.verdict === 'reject') warnings.unshift('The fact-checker says this set cannot be made correct and complete. Read its report first.')
  if (written.setType === 'closed') {
    if (check.officialCount && check.officialCount !== answers.length)
      warnings.push(`The checker's source lists ${check.officialCount} members; the draft has ${answers.length}.`)
    else if (!check.officialCount) warnings.push('The checker found no authoritative list to count against.')
  }
  for (const w of check.wrong) warnings.push(`Removed "${w.name}": ${w.reason} (${w.source || 'no source given'})`)
  for (const m of check.missing) warnings.push(`Added "${m.name}": ${m.reason} (${m.source || 'no source given'})`)
  for (const d of check.disputed) warnings.push(`Disputed, kept: "${d.name}": ${d.reason}`)
  for (const d of check.decoyProblems) warnings.push(`Removed decoy "${d.name}": ${d.reason}`)
  for (const n of check.noteProblems) warnings.push(`Note: ${n}`)
  for (const u of check.unverified) warnings.push(`Not verified: ${u}`)
  for (const u of written.unsure) warnings.push(`The writer left out "${u.name}": ${u.reason}`)
  for (const e of estimates) if (e.flag && e.tier !== 'trap') warnings.push(`Tier of "${e.name}": ${e.flag}`)

  return {
    prompt,
    review: {
      setType: written.setType,
      counts: { answers: answers.length, expected: written.expectedCount, official: check.officialCount },
      check,
      checkReport,
      unsure: written.unsure,
      estimates: [...estimates].sort((a, b) => b.share - a.share),
      errors,
      warnings,
      writerNotes: written.reviewerNotes,
    },
  }
}

export function asPack(prompt: Prompt, today: string): Pack {
  return { name: 'Draft', asOf: today, prompts: [prompt] }
}

/** The draft's evidence as text, for the terminal and for the reviewer */
export function summarise({ prompt, review }: Draft): string {
  const lines = [`${prompt.text}  (${prompt.id})`]
  if (prompt.note) lines.push(`Note: ${prompt.note}`)
  lines.push(
    `${review.counts.answers} answers, ${prompt.decoys?.length ?? 0} decoys, ${review.setType} set`,
    '',
    'What the panels expect players to type:',
    ...review.estimates.map((e) => {
      const share = e.share < 0.001 ? '<0.1%' : `${(e.share * 100).toFixed(1)}%`
      return `  ${share.padStart(6)}  ${e.tier.padEnd(6)}  ${e.name}`
    }),
  )
  if (review.errors.length) lines.push('', 'Fix before this can ship:', ...review.errors.map((e) => `  ✗ ${e}`))
  if (review.warnings.length) lines.push('', 'For the reviewer:', ...review.warnings.map((w) => `  • ${w}`))
  return lines.join('\n')
}
