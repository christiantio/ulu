import { looseReadings, normalize } from './normalize'
import { ruleProblem } from './rule'
import type { Answer, Decoy, Prompt } from './types'

export interface Match {
  answer: Answer
  /** True when the input only matched after typo correction, or with extra words in front of it */
  corrected: boolean
}

/** What the game makes of one typed guess */
export type Verdict =
  | ({ kind: 'match' } & Match)
  /** The guess fits more than one answer ("Korea"): the player should be more specific */
  | { kind: 'ambiguous' }
  /** A known wrong answer, with the reason to show */
  | { kind: 'decoy'; decoy: Decoy }
  /** The guess breaks the prompt's spelling rule; `problem` follows the guess, e.g. "doesn't start with B" */
  | { kind: 'rule'; problem: string }
  | { kind: 'none' }

/** Typos allowed for a key of this length; short keys must match exactly */
function tolerance(length: number): number {
  if (length < 5) return 0
  if (length < 10) return 1
  return 2
}

/**
 * Typing distance between two keys, giving up early once it exceeds `max`. One typo is a wrong, missing or
 * extra character, or two neighbouring characters swapped ("Payho" for "Payoh"), which is the commonest slip
 * on a phone keyboard. (Optimal string alignment, a restricted Damerau-Levenshtein distance.)
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let beforePrev: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        curr[j] = Math.min(curr[j], beforePrev[j - 2] + 1)
      rowMin = Math.min(rowMin, curr[j])
    }
    if (rowMin > max) return max + 1
    beforePrev = prev
    prev = curr
  }
  return prev[b.length]
}

const digits = (key: string) => key.replace(/[^0-9]/g, '')

/**
 * Typos between a typed key and a stored one, or Infinity if they're too far apart. A correction never changes
 * a digit: "Apollo 12" is a different thing from "Apollo 11", not a typo for it.
 */
function typos(typed: string, stored: string): number {
  const limit = Math.min(tolerance(typed.length), tolerance(stored.length))
  if (limit === 0 || digits(typed) !== digits(stored)) return Infinity
  const d = editDistance(typed, stored, limit)
  return d > limit ? Infinity : d
}

/** One accepted spelling of an answer or a decoy, in every form matching compares */
export interface Label {
  /** The name or alias as written in the pack */
  text: string
  owner: Answer | Decoy
  isAnswer: boolean
  /** The answer's display name rather than one of its aliases */
  isName: boolean
  /** normalize(): the exact key */
  key: string
  /** looseWords(), in order: the main reading of looseReadings() */
  words: string[]
  /** The loose words joined, so spacing doesn't matter ("fishball" = "fish ball") */
  joined: string
  /** The loose words sorted, so word order doesn't matter ("kopi peng siew dai" = "kopi siew dai peng") */
  sorted: string
  /** `joined` for every reading of its plurals (looseReadings()), `joined` itself first */
  joins: string[]
  /** `sorted` for every reading of its plurals, `sorted` itself first */
  sorts: string[]
}

const joinedOf = (words: readonly string[]) => words.join('')
const sortedOf = (words: readonly string[]) => [...words].sort().join(' ')

function label(text: string, owner: Answer | Decoy, isAnswer: boolean, filler: readonly string[]): Label {
  const readings = looseReadings(text, filler)
  const words = readings[0]
  return {
    text,
    owner,
    isAnswer,
    isName: text === owner.name,
    key: normalize(text),
    words,
    joined: joinedOf(words),
    sorted: sortedOf(words),
    joins: [...new Set(readings.map(joinedOf))],
    sorts: [...new Set(readings.map(sortedOf))],
  }
}

const labelCache = new WeakMap<Prompt, Label[]>()

/** Every name and alias of a prompt's answers and decoys. Cached per prompt: a round checks several guesses */
export function labelsOf(prompt: Prompt): Label[] {
  let labels = labelCache.get(prompt)
  if (!labels) {
    const filler = prompt.filler ?? []
    labels = [
      ...prompt.answers.flatMap((a) => [a.name, ...(a.aliases ?? [])].map((text) => label(text, a, true, filler))),
      ...(prompt.decoys ?? []).flatMap((d) => [d.name, ...(d.aliases ?? [])].map((text) => label(text, d, false, filler))),
    ]
    labelCache.set(prompt, labels)
  }
  return labels
}

/** A word that can identify an answer on its own: not a number, and long enough to mean something */
const distinctive = (word: string) => word.length >= 3 && !/^\d+$/.test(word)

/**
 * Whether `part` is the start or the end of `whole`, comparing words with `same`. Only the two ends count:
 * "Kuan Yew" and "Lee" are how people shorten Lee Kuan Yew, "Kuan" isn't.
 */
function atAnEnd(whole: readonly string[], part: readonly string[], same: (stored: string, typed: string) => boolean): number[] {
  if (part.length >= whole.length) return []
  const fits = (start: number) => part.every((word, j) => same(whole[start + j], word))
  return [...new Set([0, whole.length - part.length])].filter(fits)
}

/** The verdict when these labels all fit the input equally well, or null when none do */
function verdictFor(fits: readonly Label[], corrected: boolean): Verdict | null {
  const answers = new Set(fits.filter((l) => l.isAnswer).map((l) => l.owner as Answer))
  if (answers.size === 1) return { kind: 'match', answer: [...answers][0], corrected }
  if (answers.size > 1) return { kind: 'ambiguous' }
  return fits.length ? { kind: 'decoy', decoy: fits[0].owner as Decoy } : null
}

/**
 * The verdict for an answer or decoy with extra words in front of it ("D24 durian", "red dragon fruit"), in
 * prompts with `qualifiers`. The longest name or alias at the end of the input decides, so "green sea turtle" is
 * Sea Turtle rather than Turtle, and "fried carrot cake" is refused when Carrot Cake is a decoy, even if Cake is
 * an answer. The words in front can be anything, so the end has to be a whole name and a real word
 */
function qualifiedVerdict(readings: readonly (readonly string[])[], labels: readonly Label[]): Verdict | null {
  for (let skip = 1; skip < readings[0].length; skip++) {
    const tails = readings.map((r) => r.slice(skip))
    // Each later tail is the end of this one, so once there's no real word left there never will be
    if (!tails[0].some(distinctive)) return null
    const joins = new Set(tails.map(joinedOf))
    const verdict = verdictFor(labels.filter((l) => l.joins.some((j) => joins.has(j))), true)
    if (verdict) return verdict
  }
  return null
}

/**
 * Work out what a player meant. The stages run from strictest to most forgiving, and the first one that has
 * an opinion decides:
 *
 * 0. **Rule** (prompts with a `rule` only). A guess that breaks the spelling rule ("Name an animal that starts
 *    with B") is refused with the reason before anything else, so it never reads as a gap in the list.
 * 1. **Exact.** The normalised input equals a name or alias. Case, accents, punctuation and spacing are ignored.
 * 2. **Loose.** The same words once filler and stopwords are dropped, numbers are written as digits and short
 *    forms are unified, in any order ("Bishan MRT station", "World War Two", "Bt Timah"). Failing that, the
 *    same with plurals read as singulars on both sides ("cherries", "boxes", "wolves", "mice").
 * 3. **Partial** (prompts with `partial` only). The input is the first or last words of exactly one answer's
 *    name ("Einstein", "Kuan Yew"). If it fits several ("Korea", "Lee"), the verdict is `ambiguous`. Aliases
 *    and words from the middle of a name don't count, so "Sir" or "bin" never stands in for a person.
 * 4. **Qualifiers** (prompts with `qualifiers` only). A whole name or alias at the end of the input, after
 *    words that say which kind ("D24 durian", "red dragon fruit"). The longest one decides.
 * 5. **Typo.** Within 1 typo for keys of 5 to 9 characters, 2 for longer ones, and only if one answer is
 *    strictly the closest. Digits never change. In a `partial` prompt, a typo in the first or last words of
 *    a name counts too ("Einstien").
 *
 * Decoys compete with answers at every stage. A guess that is exactly a decoy, or closer to a decoy than to
 * any answer, is a `decoy`, so a known wrong answer is never "corrected" into a right one. Part of a decoy's
 * name is never enough to refuse a guess, but it does stop the same words from standing for an answer.
 */
export function checkAnswer(input: string, prompt: Prompt): Verdict {
  const key = normalize(input)
  if (!key) return { kind: 'none' }

  // 0. Rule
  const problem = prompt.rule ? ruleProblem(input, prompt.rule) : null
  if (problem) return { kind: 'rule', problem }
  const labels = labelsOf(prompt)

  // 1. Exact
  const exact = verdictFor(labels.filter((l) => l.key === key), false)
  if (exact) return exact

  // 2. Loose. An input made only of filler and stopwords ("the station") has no loose form
  const readings = looseReadings(input, prompt.filler)
  const words = readings[0]
  const joined = joinedOf(words)
  const sorted = sortedOf(words)
  if (words.length) {
    const loose = verdictFor(labels.filter((l) => l.joined === joined || l.sorted === sorted), false)
    if (loose) return loose
    // Every plural read as a singular too, in the input and in the names alike
    const joins = new Set(readings.map(joinedOf))
    const sorts = new Set(readings.map(sortedOf))
    const plural = verdictFor(labels.filter((l) => l.joins.some((j) => joins.has(j)) || l.sorts.some((s) => sorts.has(s))), false)
    if (plural) return plural
  }

  // 3. Partial: the first or last words of an answer's name. If the same words also start or end a decoy's
  // name ("Korea", with North Korea an answer and South Korea a decoy), they don't single out the answer
  const names = prompt.partial && words.some(distinctive) ? labels.filter((l) => l.isName) : []
  const ends = names.filter((l) => atAnEnd(l.words, words, (a, b) => a === b).length > 0)
  if (ends.some((l) => l.isAnswer)) return ends.every((l) => l.isAnswer) ? verdictFor(ends, false)! : { kind: 'ambiguous' }

  // 4. Qualifiers: a whole name at the end, after words that say which kind
  const qualified = prompt.qualifiers ? qualifiedVerdict(readings, labels) : null
  if (qualified) return qualified

  // 5. Typo. Keep the labels at the smallest distance; they only decide if they agree on one answer or decoy
  let best = Infinity
  let closest: Label[] = []
  const consider = (l: Label, distance: number) => {
    if (distance === Infinity || distance > best) return
    if (distance < best) closest = []
    best = distance
    closest.push(l)
  }
  // The whole input against each whole label, in its exact form or its loose form, whichever is closer
  for (const l of labels) {
    consider(l, Math.min(typos(key, l.key), joined && l.joined ? typos(joined, l.joined) : Infinity))
  }
  // Failing that, in a partial prompt, each typed word against the first or last words of a name
  const whole = closest.length > 0
  if (!whole) {
    const budget = tolerance(joined.length)
    const near = (stored: string, typed: string) => stored === typed || typos(typed, stored) !== Infinity
    for (const l of names) {
      for (const start of atAnEnd(l.words, words, near)) {
        const distance = words.reduce((sum, w, j) => sum + (w === l.words[start + j] ? 0 : typos(w, l.words[start + j])), 0)
        if (distance <= budget) consider(l, distance)
      }
    }
  }
  if (new Set(closest.map((l) => l.owner)).size !== 1) return { kind: 'none' }
  // Part of a decoy's name, misspelt, is too thin a reason to tell a player they're wrong
  if (!whole && !closest[0].isAnswer) return { kind: 'none' }
  return verdictFor(closest, true) ?? { kind: 'none' }
}

/** The answer a player meant, or null. For the full verdict (ambiguous, decoy), use checkAnswer */
export function matchAnswer(input: string, prompt: Prompt): Match | null {
  const verdict = checkAnswer(input, prompt)
  return verdict.kind === 'match' ? { answer: verdict.answer, corrected: verdict.corrected } : null
}

/**
 * Problems in a prompt that would make matching misbehave. `errors` must be fixed; `warnings` are worth a look.
 * Used by content validation and by the drafting script's report.
 */
export function matchProblems(prompt: Prompt): { errors: string[]; warnings: string[] } {
  const errors = new Set<string>()
  const warnings = new Set<string>()
  const labels = labelsOf(prompt)
  // One line per pair of answers, however many of their aliases are involved
  const pair = (a: Label, b: Label) => [a.owner.name, b.owner.name].sort().map((n) => `"${n}"`).join(' and ')

  for (const [n, a] of labels.entries()) {
    for (const b of labels.slice(n + 1)) {
      if (a.owner === b.owner || !(a.isAnswer || b.isAnswer)) continue
      const sameExact = a.key === b.key
      const sameLoose = a.words.length > 0 && (a.joined === b.joined || a.sorted === b.sorted)
      // One can be read as the plural of the other ("Glass" and "Glasses"): each still matches itself, but a
      // plural spelt like neither of them is ambiguous
      const samePlural = a.words.length > 0 && (a.joins.some((j) => b.joins.includes(j)) || a.sorts.some((s) => b.sorts.includes(s)))
      if (a.isAnswer !== b.isAnswer) {
        if (sameExact || sameLoose) errors.add(`${pair(a, b)}: a decoy matches an answer ("${a.text}" / "${b.text}")`)
        else if (samePlural) warnings.add(`${pair(a, b)}: a decoy and an answer read as singular and plural of each other`)
      } else if (sameExact) {
        // Two answers with the same exact key: reported by the main validation
      } else if (sameLoose) {
        errors.add(
          `${pair(a, b)} look the same once filler, word order and number spellings are ignored ("${a.text}" / "${b.text}")`,
        )
      } else if (samePlural) {
        warnings.add(`${pair(a, b)} read as singular and plural of each other, so a plural spelt like neither matches neither`)
      } else if (typos(a.key, b.key) !== Infinity) {
        warnings.add(`${pair(a, b)} are a typo apart, so a typo that lands between them matches neither`)
      }
    }
  }
  return { errors: [...errors], warnings: [...warnings] }
}
