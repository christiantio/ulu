import { normalize } from './normalize'
import type { Answer, Prompt } from './types'

export interface Match {
  answer: Answer
  /** True when the input only matched after typo correction */
  corrected: boolean
}

/** Typos allowed for a key of this length; short keys must match exactly */
function tolerance(length: number): number {
  if (length < 5) return 0
  if (length < 10) return 1
  return 2
}

/** Levenshtein distance, giving up early once it exceeds `max` */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      rowMin = Math.min(rowMin, curr[j])
    }
    if (rowMin > max) return max + 1
    prev = curr
  }
  return prev[b.length]
}

/**
 * Find the answer a player meant. Exact (normalized) matches win; otherwise a
 * typo-tolerant match is accepted only if exactly one answer is closest, so
 * near-identical names never get mixed up.
 */
export function matchAnswer(input: string, prompt: Prompt): Match | null {
  const key = normalize(input)
  if (!key) return null

  for (const answer of prompt.answers) {
    for (const label of [answer.name, ...(answer.aliases ?? [])]) {
      if (normalize(label) === key) return { answer, corrected: false }
    }
  }

  const max = tolerance(key.length)
  if (max === 0) return null

  let best = max + 1
  let candidates = new Set<Answer>()
  for (const answer of prompt.answers) {
    for (const label of [answer.name, ...(answer.aliases ?? [])]) {
      const target = normalize(label)
      const limit = Math.min(max, tolerance(target.length))
      const d = editDistance(key, target, limit)
      if (d > limit) continue
      if (d < best) {
        best = d
        candidates = new Set([answer])
      } else if (d === best) {
        candidates.add(answer)
      }
    }
  }

  if (best > max || candidates.size !== 1) return null
  return { answer: [...candidates][0], corrected: true }
}
