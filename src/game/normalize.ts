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

/** Plurals that aren't made with an "s", each mapped to its singular */
const IRREGULAR_PLURALS: Record<string, string> = {
  men: 'man',
  mice: 'mouse',
  lice: 'louse',
  dice: 'die',
  geese: 'goose',
  teeth: 'tooth',
  feet: 'foot',
  children: 'child',
  people: 'person',
  oxen: 'ox',
  cacti: 'cactus',
  fungi: 'fungus',
  octopi: 'octopus',
}

/**
 * The singulars a word could be the plural of, beyond what dropping its "s" gives: "cherries" → "cherry",
 * "boxes" → "box", "wolves" → "wolf", "knives" → "knife", "firemen" → "fireman", "mice" → "mouse". Some of
 * these are wrong guesses ("leaves" → "leafe"), which is harmless: they only ever meet real names and aliases
 */
function singulars(word: string): string[] {
  const irregular = IRREGULAR_PLURALS[word]
  if (irregular) return [irregular]
  const out: string[] = []
  if (word.length >= 5 && word.endsWith('men')) out.push(`${word.slice(0, -3)}man`)
  if (word.length >= 5 && word.endsWith('ies')) out.push(`${word.slice(0, -3)}y`)
  if (word.length >= 5 && word.endsWith('ves')) out.push(`${word.slice(0, -3)}f`, `${word.slice(0, -3)}fe`)
  const stem = word.slice(0, -2)
  if (word.endsWith('es') && stem.length >= 3 && /(s|x|z|ch|sh|o)$/.test(stem)) out.push(stem)
  // looseWord() keeps the "s" of words like "tennis" and "cactus", so "kiwis", "taxis" and "emus" need it here
  if (word.length >= 4 && /(is|us)$/.test(word)) out.push(word.slice(0, -1))
  return out
}

/** Every loose form of one word: looseWord()'s first, then the loose form of each singular it could be the plural of */
function looseForms(word: string): string[] {
  return [...new Set([looseWord(word), ...singulars(word).map(looseWord)])]
}

/** Readings of one answer that matching compares at most. Plenty: it takes several plurals to reach it */
const MAX_READINGS = 16

/**
 * Every reading of an answer's meaningful words: looseWords() first, then the same words with each plural read
 * as the singular it could be ("Cherries" is also "Cherry", "Boxes" also "Box"). A word is dropped as filler if
 * any reading of it is filler, so every reading has the same number of words. Capped at MAX_READINGS
 */
export function looseReadings(input: string, filler: readonly string[] = []): string[][] {
  const drop = new Set(filler.flatMap((f) => words(f)).flatMap(looseForms))
  const options = words(input)
    .filter((w) => !STOPWORDS.has(w))
    .map(looseForms)
    .filter((forms) => !forms.some((f) => drop.has(f)))
  let readings: string[][] = [[]]
  for (const forms of options) readings = readings.flatMap((r) => forms.map((f) => [...r, f])).slice(0, MAX_READINGS)
  return readings
}

/**
 * The meaningful words of an answer, in the order typed, for the loose and
 * partial stages of matching. On top of what normalize() ignores, this drops
 * stopwords and the prompt's filler words ("MRT", "station"), writes numbers
 * as digits ("II", "two" and "second" all become "2"), shortens words that
 * have a common short form ("Bukit" → "bt", "Street" → "st") and drops a
 * plural "s". (looseReadings() also reads other plurals: "cherries", "boxes".)
 *
 * Every rule is applied to the input and to the stored answers alike, so no
 * rule favours one answer over another. The worst a rule can do is make two
 * different answers look the same, and matching refuses to pick when that
 * happens (validation also flags it).
 */
export function looseWords(input: string, filler: readonly string[] = []): string[] {
  return looseReadings(input, filler)[0]
}
