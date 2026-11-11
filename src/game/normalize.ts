/** Lower-case words with accents and punctuation removed; apostrophes join ("S'pore" → "spore") */
function words(input: string): string[] {
  const text = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return text ? text.split(' ') : []
}

/**
 * Reduce an answer to a comparison key. Case, accents, punctuation, spacing
 * and a leading "the" are ignored, so "Char Kway Teow", "char-kway-teow" and
 * "charkwayteow" all compare equal.
 */
export function normalize(input: string): string {
  const w = words(input)
  return (w.length > 1 && w[0] === 'the' ? w.slice(1) : w).join('')
}

/** Words that carry no meaning in an answer, dropped wherever they appear */
const STOPWORDS = new Set(['the', 'of', 'and'])

/**
 * Words with a common short form, each mapped to that short form. Several words can share one ("St" is both
 * Saint and Street), which is fine: all that matters is that every spelling of one name ends up the same
 */
const SHORT_FORMS: Record<string, string> = {
  saint: 'st',
  street: 'st',
  mount: 'mt',
  doctor: 'dr',
  drive: 'dr',
  road: 'rd',
  avenue: 'ave',
  bukit: 'bt',
  jalan: 'jln',
  kampong: 'kg',
  kampung: 'kg',
  lorong: 'lor',
  tanjong: 'tg',
  tanjung: 'tg',
  upper: 'upp',
}

const CARDINALS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]
const ORDINALS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth',
]
// Not "i", "v" or "x": on their own they are more often a letter than a number ("Holland V", "Malcolm X")
const ROMAN = [
  '', '', 'ii', 'iii', 'iv', '', 'vi', 'vii', 'viii', 'ix', '',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
]

const NUMBERS = new Map<string, string>()
CARDINALS.forEach((word, n) => NUMBERS.set(word, String(n)))
ORDINALS.forEach((word, n) => word && NUMBERS.set(word, String(n)))
ROMAN.forEach((word, n) => word && NUMBERS.set(word, String(n)))
for (let n = 1; n <= 31; n++) {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  NUMBERS.set(`${n}${suffix}`, String(n))
}

/** One word in its loose form: numbers as digits, the short form of a word that has one, a plural "s" dropped */
function looseWord(word: string): string {
  const number = NUMBERS.get(word)
  if (number) return number
  const short = SHORT_FORMS[word]
  if (short) return short
  if (word.length >= 4 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1)
  return word
}

/**
 * The meaningful words of an answer, in the order typed, for the loose and
 * partial stages of matching. On top of what normalize() ignores, this drops
 * stopwords and the prompt's filler words ("MRT", "station"), writes numbers
 * as digits ("II", "two" and "second" all become "2"), shortens words that
 * have a common short form ("Bukit" → "bt", "Street" → "st") and drops a
 * plural "s".
 *
 * Every rule is applied to the input and to the stored answers alike, so no
 * rule favours one answer over another. The worst a rule can do is make two
 * different answers look the same, and matching refuses to pick when that
 * happens (validation also flags it).
 */
export function looseWords(input: string, filler: readonly string[] = []): string[] {
  const drop = new Set(filler.flatMap((f) => words(f)).map(looseWord))
  return words(input)
    .filter((w) => !STOPWORDS.has(w))
    .map(looseWord)
    .filter((w) => !drop.has(w))
}
