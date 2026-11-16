import { normalize } from './normalize'
import type { SpellingRule } from './types'

/** Letters whose name starts with a vowel sound take "an": "an A", "an S", but "a B" */
const article = (letter: string) => ('aefhilmnorsx'.includes(letter) ? 'an' : 'a')

/** How a rule's letters are written to the player: one letter as a capital ("B"), several quoted ("'ia'") */
const show = (letters: string) => (letters.length === 1 ? letters.toUpperCase() : `'${letters}'`)

/**
 * Why a guess breaks a prompt's spelling rule, as the words that follow the guess ("doesn't start with B"), or
 * null if it keeps the rule. Only the guess's letters and digits count, as in normalize(): case, accents, spaces,
 * punctuation and a leading "the" don't
 */
export function ruleProblem(input: string, rule: SpellingRule): string | null {
  const key = normalize(input)
  if (!key) return null
  const startsWith = normalize(rule.startsWith ?? '')
  const endsWith = normalize(rule.endsWith ?? '')
  const contains = normalize(rule.contains ?? '')
  if (startsWith && !key.startsWith(startsWith)) return `doesn't start with ${show(startsWith)}`
  if (endsWith && !key.endsWith(endsWith)) return `doesn't end in ${show(endsWith)}`
  if (contains && !key.includes(contains)) return `has no ${show(contains)} in it`
  const banned = [...normalize(rule.lacks ?? '')].find((letter) => key.includes(letter))
  if (banned) return `has ${article(banned)} ${show(banned)} in it`
  if (rule.palindrome && [...key].reverse().join('') !== key) return "doesn't read the same backwards"
  return null
}

const RULE_KEYS = ['startsWith', 'endsWith', 'contains', 'lacks', 'palindrome'] as const

/** What's wrong with a rule itself, for validation: unknown settings, settings of the wrong type, or no rule at all */
export function ruleShapeProblems(rule: unknown): string[] {
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) return ['"rule" must be an object']
  const problems: string[] = []
  const entries = Object.entries(rule)
  for (const [key, value] of entries) {
    if (!(RULE_KEYS as readonly string[]).includes(key)) problems.push(`"rule" has an unknown setting "${key}"`)
    else if (key === 'palindrome' ? typeof value !== 'boolean' : typeof value !== 'string' || !normalize(value))
      problems.push(`"rule.${key}" must be ${key === 'palindrome' ? 'true or false' : 'letters'}`)
  }
  if (!entries.some(([, value]) => value)) problems.push('"rule" sets nothing')
  return problems
}
