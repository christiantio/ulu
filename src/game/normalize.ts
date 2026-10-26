/**
 * Reduce an answer to a comparison key. Case, accents, punctuation, spacing
 * and a leading "the" are ignored, so "Char Kway Teow", "char-kway-teow" and
 * "charkwayteow" all compare equal.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .replace(/ /g, '')
}
