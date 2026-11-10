export const TIERS = ['common', 'trap', 'solid', 'rare', 'ulu', 'gem'] as const
export type Tier = (typeof TIERS)[number]

export const CATEGORIES = [
  'transport',
  'places',
  'food',
  'history',
  'politics',
  'culture',
  'language',
  'nature',
] as const
export type Category = (typeof CATEGORIES)[number]

export interface Answer {
  /** Canonical display name, e.g. "Char Kway Teow" */
  name: string
  /** Alternate spellings, abbreviations, other-language names */
  aliases?: string[]
  tier: Tier
}

export interface Prompt {
  /** Stable, unique, kebab-case id, e.g. "circle-line-stations" */
  id: string
  category: Category
  /** What the player sees, e.g. "Name a station on the Circle Line" */
  text: string
  /** Optional rule clarification shown under the prompt */
  note?: string
  /**
   * The pages the answer list was checked against, as absolute http(s) URLs, with the page that lists the whole
   * set first. For sets that can change; never shown to players
   */
  sources?: string[]
  /** The Singapore date (YYYY-MM-DD) the answer list next needs checking against its sources */
  reviewBy?: string
  /** Every accepted answer; exactly one has tier "gem" */
  answers: Answer[]
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
