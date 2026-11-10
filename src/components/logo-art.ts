import { sprite, type Brush } from './elevator/paint'

/* The wordmark's pixels. Logo.tsx shows it; scripts/art.tsx draws it into the link-preview image */

const U = ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '######', '.####.']
const L = ['##...', '##...', '##...', '##...', '##...', '##...', '#####', '#####']
/** The full stop of the old wordmark, grown into a bubble */
const GUM = ['.oooo.', 'oohooo', 'ohoooo', 'oooooo', 'ooooop', '.oppp.']

/** The letters side by side, a column apart: lit along the top row, shaded along the bottom */
const WORD = U.map((_, r) =>
  [U, L, U]
    .map((glyph) => glyph[r].replaceAll('#', r === 0 ? 'h' : r === U.length - 1 ? 's' : '#'))
    .join('.'),
)

/** The wordmark's box: the letters, their outline, and the bubble */
export const LOGO_W = 32
export const LOGO_H = 12

export function drawLogo(b: Brush) {
  // A line of bubblegum under the letters, then the letters
  sprite(b, WORD, { '#': '#ff7699', h: '#ff7699', s: '#ff7699' }, 1, 2, '#ff7699')
  sprite(b, WORD, { '#': '#f1e5d0', h: '#fffaf0', s: '#d6c2a0' }, 1, 1, '#0b1018')
  sprite(b, GUM, { o: '#ff7699', h: '#ffd3de', p: '#e55682' }, 24, 3, '#0b1018')
}
