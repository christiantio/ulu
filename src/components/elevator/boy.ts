import { paint, sprite, type Brush } from './paint'

/*
 * The boy's sprite: white tee, FBT shorts, bathroom slippers and a mouthful of bubblegum. The same pixels in every
 * lift. BoyMascot.tsx animates the parts; drawBoy() draws him as a still, for icons and link previews
 */

const INK = '#17212f'
const PINK = '#ff7699'

const PALETTE: Record<string, string> = {
  K: '#1d2233', // hair
  H: '#3a4263', // hair shine
  S: '#eab98d', // skin
  s: '#cf9469', // skin in shadow
  p: '#ee9f8c', // cheeks
  W: '#fbf7ec', // eyes
  T: '#fbf6ea', // tee
  t: '#d6cdb9', // tee in shadow
  B: '#2a3550', // shorts
  b: '#f1e5d0', // their piping
  L: '#f6f1e4', // slipper soles
  l: '#3f6fd6', // slipper straps
}

/** 26 × 43, drawn a pixel in from the corner to leave room for the outline */
const BODY = [
  '..........K....K..K.......',
  '........KKKK.KKKKKKK......',
  '......KKKKKKKKKKKKKKKK....',
  '.....KKKKHHKKKKKKHKKKKK...',
  '....KKKKHKKKKKKKKKKKKKKK..',
  '....KKKKKKKKKKKKKKKKKKKK..',
  '...KKKKKKSKKKKSSKKKSKKKKK.',
  '...KKKKSSSSKSSSSSSSSSKKKK.',
  '...KKKSSSSSSSSSSSSSSSSKKK.',
  '...KKSSSSSSSSSSSSSSSSSSKK.',
  '..sKKSSKKKKSSSSSSKKKKSSKKs',
  '..SKSSSWWWWSSSSSSWWWWSSSKS',
  '..sSSSSSSSSSSSSSSSSSSSSSSs',
  '...SSSppSSSSSssSSSSSppSSS.',
  '...SSSSSSSSSSSSSSSSSSSSSS.',
  '....SSSSSSSSSSSSSSSSSSSS..',
  '.....SSSSSSSSSSSSSSSSSS...',
  '......ssSSSSSSSSSSSSss....',
  '...........sSSSSs.........',
  '........TTTTsSSsTTTT......',
  '.....TTTTTTTTttTTTTTTTT...',
  '....TTTTTTTTTTTTTTTTTTTT..',
  '...TTTTTTTTTTTTTTTTTTTTTT.',
  '...TTTtTTTTTTTTTTTTTTtTTT.',
  '...TTTtTTTTTTTTTTTTTTtTTT.',
  '...tttTTTTTTTTTTTTTTTTttt.',
  '...SSS.TTTTTTTTTTTTTT.SSS.',
  '...SSS.TTTTTTTTTTTTTT.SSS.',
  '...SSS.TTTTTTTTTTTTTT.SSS.',
  '...sSS.TTTTTTTTTTTTTT.SSs.',
  '....SS.TTTTTTTTTTTTTT.SS..',
  '.......tTTTTTTTTTTTTt.....',
  '.......BBBBBBBBBBBBBB.....',
  '.......bBBBBBBBBBBBBb.....',
  '.......bBBBBBBBBBBBBb.....',
  '.......BBBBBB..BBBBBB.....',
  '........SSSS....SSSS......',
  '........SSSS....SSSS......',
  '........SSSs....sSSS......',
  '........SSSS....SSSS......',
  '........SSSS....SSSS......',
  '.......SlSlS....SlSlS.....',
  '......LLLLLLL..LLLLLLL....',
]

/** The sprite's box, outline included */
export const BOY_W = BODY[0].length + 2
export const BOY_H = BODY.length + 2

/** A filled circle `d` pixels across with its top-left corner at (x, y) */
function orb(b: Brush, fill: string, x: number, y: number, d: number) {
  const r = d / 2
  for (let i = 0; i < d; i++) {
    const dy = i + 0.5 - r
    const half = Math.sqrt(Math.max(r * r + 0.3 - dy * dy, 0))
    const from = Math.round(r - half)
    b(fill, x + from, y + i, d - from * 2, 1)
  }
}

/** A bubble `d` pixels across, centred on his mouth: outlined, shaded underneath, with a shine */
function bubble(b: Brush, d: number) {
  const x = 15 - d / 2
  const y = 18 - d / 2
  orb(b, '#b63a63', x, y, d)
  if (d > 5) {
    orb(b, '#e55682', x + 1, y + 1, d - 2)
    orb(b, PINK, x + 1, y + 1, d - 3)
    b('#ffd3de', x + Math.round(d * 0.28), y + Math.round(d * 0.22), Math.max(1, Math.round(d / 5)), Math.max(1, Math.round(d / 7)))
  } else {
    orb(b, PINK, x + 1, y + 1, d - 2)
  }
}

/** Bubble sizes, from the first puff to the big one that covers his nose */
const BUBBLES = [4, 8, 12, 14]

/**
 * The boy as a still, for icons and link previews: his top `rows` rows (all of him by default), with a bubble
 * `gum` pixels across if he's blowing one. Drawn in a box BOY_W wide, like the sprite
 */
export function drawBoy(b: Brush, gum = 0, rows = BODY.length) {
  sprite(b, BODY.slice(0, rows), PALETTE, 1, 1, INK)
  b(INK, 9, 12, 2, 1)
  b(INK, 19, 12, 2, 1)
  if (gum) bubble(b, gum)
  else b('#8c4a3a', 13, 16, 3, 1)
}

/** His parts, each painted once. The mascot stacks them and animates them with CSS */
export const BOY_ART = {
  body: paint((b) => sprite(b, BODY, PALETTE, 1, 1, INK)),
  pupils: paint((b) => {
    b(INK, 9, 12, 2, 1)
    b(INK, 19, 12, 2, 1)
  }),
  // Eyes shut: the lid comes down over the white
  lids: paint((b) => {
    for (const x of [8, 18]) {
      b(PALETTE.S, x, 11, 4, 1)
      b(PALETTE.K, x, 12, 4, 1)
    }
  }),
  chewA: paint((b) => b('#8c4a3a', 13, 16, 3, 1)),
  chewB: paint((b) => b('#8c4a3a', 14, 16, 3, 1)),
  sweat: paint((b) => {
    b('#bfe6f5', 25, 8, 1, 1)
    b('#8fd0ea', 24, 9, 3, 2)
    b('#bfe6f5', 24, 9, 1, 1)
  }),
  bubbles: BUBBLES.map((d) => paint((b) => bubble(b, d))),
  // The pop: bits of gum flying off, and a little left on his lip
  pop: paint((b) => {
    const bits = [
      [6, 9], [15, 6], [23, 10], [4, 17], [25, 18], [7, 25], [15, 27], [22, 24], [10, 12], [20, 13], [11, 22], [19, 21],
    ]
    bits.forEach(([x, y], i) => b(i % 3 ? PINK : '#ffd3de', x, y, i < 8 ? 2 : 1, i < 8 ? 2 : 1))
    b(PINK, 13, 16, 4, 2)
    b('#e55682', 14, 18, 2, 1)
  }),
}
