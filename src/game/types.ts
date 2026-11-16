export const TIERS = ['common', 'trap', 'solid', 'rare', 'ulu', 'gem'] as const
export type Tier = (typeof TIERS)[number]

/** Singapore categories: the deep cuts are local */
export const SG_CATEGORIES = [
  'transport',
  'places',
  'food',
  'history',
  'politics',
  'culture',
  'language',
  'nature',
] as const

/**
 * World categories: prompts anyone could have a go at, wherever they live. `everyday` is things and situations
 * from daily life (things that come in pairs), and `wordplay` is words, letters and phrases (words that go
 * before "ball")
 */
export const WORLD_CATEGORIES = ['world', 'science', 'entertainment', 'wildcard', 'everyday', 'wordplay'] as const

export const CATEGORIES = [...SG_CATEGORIES, ...WORLD_CATEGORIES] as const
export type Category = (typeof CATEGORIES)[number]

export type Scope = 'sg' | 'world'

export function scopeOf(category: Category): Scope {
  return (WORLD_CATEGORIES as readonly string[]).includes(category) ? 'world' : 'sg'
}

export interface Answer {
  /** Canonical display name, e.g. "Char Kway Teow" */
  name: string
  /** Alternate spellings, abbreviations, other-language names */
  aliases?: string[]
  tier: Tier
}

/**
 * A wrong answer we expect players to type, kept so that matching never "corrects" it into a right one
 * ("Ireland" is one typo from Iceland) and so the game can say why it doesn't count
 */
export interface Decoy {
  /** What the player would type, e.g. "Equatorial Guinea" */
  name: string
  aliases?: string[]
  /** One short line shown to the player, e.g. "Despite the name, the equator misses it." */
  why: string
}

export interface Prompt {
  /** Stable, unique, kebab-case id, e.g. "circle-line-stations" */
  id: string
  category: Category
  /** What the player sees, e.g. "Name a station on the Circle Line" */
  text: string
  /** Optional rule clarification shown under the prompt */
  note?: string
  /** Every accepted answer; exactly one has tier "gem" */
  answers: Answer[]
  /** Known wrong answers, each with the reason it doesn't count */
  decoys?: Decoy[]
  /**
   * Words players add or leave out that don't change the answer, e.g. ["MRT", "station"]. Matching ignores
   * them, so "Bishan MRT Station" needs no alias
   */
  filler?: string[]
  /**
   * Accept part of an answer when it points to exactly one ("Einstein" for Albert Einstein, "Kuan Yew" for
   * Lee Kuan Yew). Turn it on for sets of people and places, and leave it off for words and phrases, where
   * part of an expression is a different expression
   */
  partial?: boolean
  /**
   * Accept extra words in front of an answer: "D24 durian" is Durian, "red dragon fruit" is Dragon Fruit,
   * "Hainanese chicken rice" is Chicken Rice. Turn it on for things that come in kinds (food, animals, objects),
   * and leave it off for names, titles and places, where "Upper Bukit Timah" isn't Bukit Timah
   */
  qualifiers?: boolean
  /** A spelling rule every answer keeps, checked on what the player types before anything else */
  rule?: SpellingRule
}

/**
 * A rule about how an answer is spelt, for prompts about animals starting with B, say. Letters only:
 * case, accents, spaces and punctuation don't count, and neither does a leading "the". A guess that breaks the
 * rule is refused with the reason, so the player knows it wasn't a gap in the list
 */
export interface SpellingRule {
  /** Every answer starts with these letters, e.g. "b" */
  startsWith?: string
  /** Every answer ends with these letters, e.g. "ia" */
  endsWith?: string
  /** Every answer has these letters in it, in this order, e.g. "ulu" */
  contains?: string
  /** No answer has any of these letters in it, e.g. "a" */
  lacks?: string
  /** Every answer reads the same backwards ("level", "Ulu") */
  palindrome?: boolean
}

export interface Pack {
  /** Human-readable pack name */
  name: string
  /** ISO date the facts in this pack were last checked */
  asOf: string
  prompts: Prompt[]
}

/** Outcome of one prompt in a dive */
export interface RoundResult {
  promptId: string
  /** What the player typed (empty if they ran out of time) */
  input: string
  /**
   * Every submitted guess that wasn't recognised, in order, deduplicated by normalised text. Not the text left
   * in the box at the timeout, which is `input`. Progress saved before this field existed loads with `[]`
   */
  attempts: string[]
  /** Matched canonical answer name, or null for a miss */
  answer: string | null
  tier: Tier | null
  points: number
}

/** One day's dive as the build emits it, at dives/<date>.json: that day's prompts in schedule order */
export interface DiveFile {
  /** The Singapore date, YYYY-MM-DD */
  date: string
  prompts: Prompt[]
}
