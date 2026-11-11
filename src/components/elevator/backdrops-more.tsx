import { mulberry32 } from '../../game/daily'
import type { StageId } from '../../game/elevator'
import { LEAVES, tree, type Backdrop } from './backdrops'
import { blob, line, paint, ring, taper, type Brush } from './paint'

/*
 * The backdrops of the five lifts the score unlocks, in a chunk of their own: see backdrops.tsx for how they're
 * drawn and when this loads
 */

const DUSK_LEAVES = ['#2c5f4c', '#3d7a5b', '#5c9a6c']

function palm(b: Brush, x: number, base: number, h: number, c = LEAVES) {
  line(b, '#9a7a52', x, base, x + 2, base - h, 2)
  const top = base - h
  for (const [dx, dy] of [[-9, 2], [-7, -4], [-2, -7], [5, -6], [10, -2], [8, 3]]) {
    line(b, c[0], x + 2, top, x + 2 + dx, top + dy, 2)
    b(c[1], x + 2 + dx, top + dy + 1, 2, 2)
  }
  b(c[2], x, top - 2, 4, 2)
}

/* Stage 2: a new estate, all white paint, colour accents and sky gardens */

const ACCENT = {
  lime: ['#a8d15c', '#86b23e'],
  orange: ['#f5a352', '#d9822e'],
  sky: ['#63b7e6', '#3f96c9'],
  sun: ['#f8c76b', '#dba63c'],
}

function bto(b: Brush, x: number, w: number, top: number, bottom: number, [accent, accentDark]: string[], seed: number, roof: 'garden' | 'solar') {
  const rand = mulberry32(seed)
  b('#f6f7f1', x, top, w, bottom - top)
  b('#dfe6df', x + w - 3, top, 3, bottom - top)
  b(accent, x, top, 3, bottom - top)
  for (let y = top + 4; y < bottom - 8; y += 12) {
    // A sky garden every few storeys: a double-height gap with trees in it
    if ((y - top - 4) % 108 === 72) {
      b('#3d5a66', x + 3, y - 1, w - 6, 21)
      for (let tx = x + 9; tx < x + w - 7; tx += 11) {
        b('#7a5a3a', tx, y + 12, 1, 5)
        blob(b, LEAVES[0], tx, y + 9, 4, 4)
        b(LEAVES[2], tx - 2, y + 6, 3, 2)
      }
      b('#d6eef0aa', x + 3, y + 14, w - 6, 5)
      b('#f6f7f1', x + 3, y + 19, w - 6, 2)
      y += 12
      continue
    }
    for (let bx = x + 6; bx + 7 <= x + w - 4; bx += 10) {
      b('#4f87a8', bx, y, 7, 6)
      b('#9ad2e8', bx + 1, y + 1, 5, 2)
      b('#6aa8c9', bx + 1, y + 3, 5, 2)
      if (rand() < 0.28) b(rand() < 0.5 ? accent : accentDark, bx, y + 7, 7, 2)
      else b('#c7d0cc', bx + 2, y + 8, 4, 2)
    }
  }
  b('#e3e9e2', x - 1, top - 2, w + 2, 2)
  if (roof === 'solar') {
    for (let px = x + 4; px + 9 < x + w; px += 11) {
      b('#27466b', px, top - 6, 9, 4)
      b('#5f8fc0', px, top - 6, 9, 1)
    }
  } else {
    b('#c9a577', x + 6, top - 10, w - 12, 1)
    for (let px = x + 6; px < x + w - 6; px += 8) b('#c9a577', px, top - 9, 1, 7)
    for (let tx = x + 10; tx < x + w - 6; tx += 13) blob(b, LEAVES[1], tx, top - 5, 4, 3)
  }
}

function upgradedMid(b: Brush) {
  bto(b, -204, 82, -520, -13, ACCENT.lime, 5, 'garden')
  bto(b, 118, 86, -168, -13, ACCENT.sun, 9, 'solar')
  bto(b, -116, 66, -214, -13, ACCENT.orange, 7, 'garden')
  bto(b, 52, 60, -520, -13, ACCENT.sky, 12, 'garden')
  // The sky bridge between the towers
  b('#dfe6df', -50, -113, 102, 1)
  b('#f6f7f1', -50, -117, 102, 4)
  b('#d6eef0aa', -50, -123, 102, 6)
  for (let px = -50; px <= 52; px += 12) b('#f6f7f1', px, -123, 1, 6)
  for (const tx of [-34, -8, 22]) {
    b('#7a5a3a', tx, -123, 1, 6)
    blob(b, LEAVES[0], tx, -127, 5, 4)
    b(LEAVES[2], tx - 3, -130, 3, 2)
  }

  // The roof garden on the car park below
  b('#f6f7f1', -200, -16, 400, 3)
  b('#dfe6df', -200, -13, 400, 1)
  b('#b4dc98', -200, -12, 400, 140)
  const rand = mulberry32(31)
  for (let i = 0; i < 80; i++) b('#a3cf86', -200 + Math.floor(rand() * 398), -10 + Math.floor(rand() * 30), 2, 1)
  b('#efe4c9', -200, -5, 400, 4)
  b('#efe4c9', 96, -12, 5, 8)
  // A trellis pavilion, planters and a fitness corner
  for (let px = 72; px < 124; px += 3) b('#c9a577', px, -27, 2, 1)
  b('#b08d5f', 72, -26, 52, 1)
  for (const px of [74, 98, 121]) b('#b08d5f', px, -25, 1, 20)
  b('#8a6a45', 82, -9, 12, 1)
  b('#8a6a45', 104, -9, 12, 1)
  for (let px = -190; px < -60; px += 26) {
    b('#e8dfcc', px, -11, 16, 3)
    blob(b, LEAVES[1], px + 8, -13, 7, 3)
    b('#ff7699', px + 4, -15, 1, 1)
    b('#f8c76b', px + 11, -14, 1, 1)
  }
  b('#f5a352', -64, -18, 1, 13)
  b('#f5a352', -54, -18, 1, 13)
  b('#f5a352', -64, -19, 11, 1)
  b('#63b7e6', 150, -15, 1, 10)
  b('#63b7e6', 150, -16, 8, 1)
  b('#63b7e6', 157, -15, 1, 10)
  tree(b, -160, -8, 14, 14, 9)
  tree(b, 176, -6, 13, 14, 9)
  tree(b, 142, -9, 9, 8, 6)
}

function upgradedFar(b: Brush) {
  const rand = mulberry32(14)
  blob(b, '#fffbe044', 100, -250, 26)
  blob(b, '#fffdf0', 100, -250, 15)
  // A green ridge, with the next estate along in front of it
  for (let x = -210; x < 210; x += 14) blob(b, '#a6d7b0', x, -62 - Math.round(Math.sin(x / 47) * 12) - Math.floor(rand() * 5), 16, 14)
  b('#a6d7b0', -200, -62, 400, 140)
  let x = -206
  while (x < 200) {
    const w = 18 + Math.floor(rand() * 20)
    const h = 50 + Math.floor(rand() * 90)
    const c = ['#e6f1f3', '#f4ead6', '#dcefe2'][Math.floor(rand() * 3)]
    b(c, x, -30 - h, w, h + 60)
    b(['#bfe08a', '#f9c58f', '#a5d6f0'][Math.floor(rand() * 3)], x, -30 - h, 2, h + 60)
    for (let y = -30 - h + 4; y < 20; y += 5) b('#b8d3dc', x + 4, y, w - 6, 2)
    x += w + 8 + Math.floor(rand() * 22)
  }
  for (let tx = -204; tx < 204; tx += 8) blob(b, '#8fcf9c', tx, 10 - Math.floor(rand() * 4), 7, 6)
}

/* Stage 3: a condominium at golden hour, with a pool nobody is using */

/** A slim glass tower with a stack of balconies down one side, and a sloped crown if it has one */
function condoTower(b: Brush, x: number, w: number, top: number, bottom: number, seed: number, crown: 'left' | 'right' | 'flat' = 'flat') {
  const rand = mulberry32(seed)
  const slope = crown === 'flat' ? 0 : 16
  const body = top + slope
  b('#4f7f8c', x, body, w, bottom - body)
  // The crown rises to one corner
  for (let i = 0; i < slope; i++) {
    const cw = Math.round((w * (i + 1)) / slope)
    b('#4f7f8c', crown === 'left' ? x : x + w - cw, top + i, cw, 1)
    b('#f4eee0', crown === 'left' ? x + cw - 2 : x + w - cw, top + i, 2, 1)
  }
  // The last of the sun in the upper floors
  for (let i = 0; i < 70; i += 2) b('#f6c89040', x, body + i, w, 1)
  b('#f6c89055', x, body, w, 24)
  for (let y = body + 9; y < bottom; y += 10) b('#3f6672', x, y, w, 1)
  for (let mx = x + 5; mx < x + w; mx += 6) b('#3f667266', mx, body, 1, bottom - body)

  // Balconies: a slab, a glass rail, and sometimes a light on or a plant out
  const bw = Math.round(w * 0.42)
  const bx = seed % 2 ? x : x + w - bw
  for (let y = body; y < bottom - 9; y += 10) {
    b('#35565f', bx, y, bw, 10)
    if (rand() < 0.34) b('#ffd98a', bx + 2, y + 1, bw - 4, 5)
    b('#dff0ec88', bx, y + 5, bw, 3)
    b('#f4eee0', bx - 1, y + 8, bw + 2, 2)
    if (rand() < 0.45) {
      const px = bx + 1 + Math.floor(rand() * (bw - 5))
      b(DUSK_LEAVES[2], px, y + 3, 3, 2)
      b(DUSK_LEAVES[1], px + 1, y + 2, 2, 1)
    }
  }
  b('#f4eee0', seed % 2 ? x + w - 2 : x, body, 2, bottom - body)
  b('#8a6a45', seed % 2 ? x + bw : bx - 1, body, 1, bottom - body)
  if (crown === 'flat') {
    // A pergola and a few trees for the people at the top
    b('#f4eee0', x - 1, top - 2, w + 2, 2)
    b('#8a6a45', x + 4, top - 9, w - 8, 1)
    for (let px = x + 4; px <= x + w - 5; px += 9) b('#8a6a45', px, top - 8, 1, 6)
    for (let tx = x + 9; tx < x + w - 6; tx += 14) blob(b, DUSK_LEAVES[1], tx, top - 5, 4, 3)
  }
}

function pool(b: Brush, x: number, y: number, w: number, h: number, seed: number) {
  const rand = mulberry32(seed)
  b('#f1ece0', x - 2, y - 1, w + 4, h + 2)
  b('#49bfd0', x, y, w, h)
  b('#2f9fb6', x, y, w, 1)
  for (let i = 0; i < w / 3; i++) b('#9be7ea', x + 1 + Math.floor(rand() * (w - 6)), y + 2 + Math.floor(rand() * (h - 3)), 4, 1)
}

function condoMid(b: Brush) {
  condoTower(b, -202, 42, -152, -12, 4, 'right')
  condoTower(b, -152, 48, -520, -12, 3)
  condoTower(b, 130, 60, -150, -12, 8)
  condoTower(b, 60, 46, -238, -12, 5, 'left')
  // The rooftop infinity pool next door, and a garden bridge across to it
  b('#49bfd0', 134, -155, 52, 3)
  b('#9be7ea', 138, -154, 16, 1)
  palm(b, 182, -152, 12, DUSK_LEAVES)
  b('#f4eee0', 106, -112, 24, 3)
  b('#cfc6b4', 106, -109, 24, 1)
  b('#dff0ec88', 106, -116, 24, 4)
  blob(b, DUSK_LEAVES[1], 114, -119, 4, 3)
  blob(b, DUSK_LEAVES[0], 123, -118, 3, 2)

  // Pool deck
  b('#d8b98c', -200, -12, 400, 140)
  for (let x = -200; x < 200; x += 7) b('#caa878', x, -12, 1, 140)
  b('#f1ece0', -200, -14, 400, 2)
  for (let x = -196; x < 200; x += 9) blob(b, DUSK_LEAVES[1], x, -15, 5, 2)
  pool(b, 56, -8, 96, 11, 4)
  pool(b, -168, -8, 104, 11, 6)
  // Loungers and umbrellas along the water
  for (const x of [-156, -138, -120, -98, -80, 58, 72, 92, 118, 136]) {
    b('#fbf7ee', x, 6, 7, 2)
    b('#fbf7ee', x, 5, 2, 1)
    b('#b9a37c', x + 1, 8, 1, 1)
    b('#b9a37c', x + 5, 8, 1, 1)
  }
  for (const [x, c] of [[-146, '#ff7699'], [-108, '#f8c76b'], [66, '#69b5ae'], [128, '#ff7699']] as const) {
    b('#8a6a45', x, -2, 1, 9)
    taper(b, c, x + 0.5, -6, 3, 15, 4)
    b('#fbf7ee', x - 1, -6, 3, 4)
  }
  // A cabana
  b('#f4eee0', 150, -24, 20, 2)
  taper(b, '#f4eee0', 160, -28, 6, 20, 4)
  b('#8a6a45', 151, -22, 1, 16)
  b('#8a6a45', 168, -22, 1, 16)
  b('#ffd98a66', 152, -22, 16, 16)
  palm(b, -184, 0, 22, DUSK_LEAVES)
  palm(b, -88, -2, 27, DUSK_LEAVES)
  palm(b, 84, -3, 25, DUSK_LEAVES)
  palm(b, 110, -1, 19, DUSK_LEAVES)
  palm(b, 190, -3, 17, DUSK_LEAVES)
}

function condoFar(b: Brush) {
  const rand = mulberry32(22)
  // A low sun, well on its way down
  blob(b, '#ffe6a833', -72, -128, 38)
  blob(b, '#ffe6a866', -72, -128, 26)
  blob(b, '#fff3cf', -72, -128, 16)
  // The hill, and the towers further off
  blob(b, '#8fb59a', 60, -52, 150, 34)
  blob(b, '#9cc0a2', -140, -44, 110, 26)
  let x = -200
  while (x < 200) {
    const w = 14 + Math.floor(rand() * 16)
    const h = 40 + Math.floor(rand() * 100)
    b('#c9bfae', x, -30 - h, w, h + 40)
    b('#f6d9a8', x, -30 - h, 2, h + 40)
    for (let y = -30 - h + 3; y < 0; y += 5) b('#a99f90', x + 4, y, w - 6, 2)
    x += w + 16 + Math.floor(rand() * 30)
  }
  // Landed houses under the trees
  b('#7fae8a', -200, -20, 400, 100)
  for (let hx = -198; hx < 200; hx += 12 + Math.floor(rand() * 9)) {
    b('#f1e5d0', hx, -18, 8, 5)
    taper(b, '#c9785a', hx + 4, -22, 4, 12, 4)
    blob(b, '#6f9f7c', hx + 11, -16, 4, 4)
  }
}

/* Stage 4: the financial district, cool and bright, with the Strait beyond */

function glassTower(b: Brush, x: number, w: number, top: number, bottom: number, [base, light, dark]: string[], seed: number) {
  const rand = mulberry32(seed)
  b(base, x, top, w, bottom - top)
  for (let y = top + 5; y < bottom; y += 6) b(dark, x, y, w, 1)
  for (let mx = x + 3; mx < x + w; mx += 4) b(`${dark}55`, mx, top, 1, bottom - top)
  // The sky sliding across the glass
  for (let y = top; y < bottom; y++) {
    const sx = x - 12 + ((((y - top) >> 1) + seed * 7) % (w + 24))
    const from = Math.max(sx, x)
    const to = Math.min(sx + 8, x + w)
    if (to > from) b(`${light}88`, from, y, to - from, 1)
  }
  for (let i = 0; i < (w * (bottom - top)) / 500; i++) {
    b(light, x + 1 + Math.floor(rand() * (w - 4)), top + 2 + Math.floor(rand() * (bottom - top - 6)), 3, 2)
  }
  b(light, x, top, 1, bottom - top)
}

const GLASS = {
  blue: ['#5f8fc4', '#bfe0f7', '#3f6ea3'],
  teal: ['#3f7f8c', '#a9e0e0', '#2a5f6b'],
  steel: ['#7f9fbf', '#dbeeff', '#5a7fa3'],
  navy: ['#3f5f9a', '#a9c9f2', '#2a447a'],
}

function cbdMid(b: Brush) {
  // The one with windows like calculator keys
  b('#d9d1c0', -200, -172, 52, 300)
  b('#c2b9a6', -152, -172, 4, 300)
  for (let g = 0; g < 4; g++) {
    const y = -160 + g * 52
    b('#56697a', -192, y, 38, 38)
    for (let wy = y + 5; wy < y + 38; wy += 6) b('#7f93a3', -192, wy, 38, 1)
    for (let wx = -186; wx < -154; wx += 6) b('#3f505f', wx, y, 1, 38)
  }
  b('#c2b9a6', -186, -178, 20, 6)

  // The stepped granite one
  const steps: [number, number, number][] = [[52, -160, 300], [44, -206, 46], [34, -228, 22], [22, -240, 12]]
  for (const [w, top, h] of steps) {
    const x = -112 - w / 2
    b('#b9b2a6', x, top, w, h)
    b('#d2ccc1', x, top, 3, h)
    b('#9c958a', x + w - 3, top, 3, h)
    for (let wy = top + 3; wy < top + h - 2; wy += 6) {
      for (let wx = x + 5; wx < x + w - 5; wx += 4) b('#56626b', wx, wy, 2, 3)
    }
  }
  b('#9c958a', -113, -252, 2, 12)

  glassTower(b, -82, 32, -138, 140, GLASS.teal, 3)
  taper(b, '#3f7f8c', -66, -154, 14, 32, 16)
  b('#a9e0e0', -67, -164, 2, 10)

  // The wedge-topped one
  glassTower(b, 54, 40, -236, 140, GLASS.steel, 5)
  for (let i = 0; i < 22; i++) b('#7f9fbf', 54, -258 + i, 4 + Math.round((36 * i) / 21), 1)
  for (let i = 0; i < 22; i += 3) b('#dbeeff', 54, -258 + i, 2, 1)

  // The one with gardens growing out of it
  b('#34505c', 100, -206, 54, 346)
  for (let fx = 100; fx < 154; fx += 3) b('#eef3ef', fx, -206, 2, 346)
  for (const [gy, gr] of [[-190, 9], [-96, 12], [-10, 10]]) {
    blob(b, '#2f5f4f', 127, gy, 20, gr)
    blob(b, LEAVES[0], 125, gy - 1, 15, gr - 3)
    blob(b, LEAVES[2], 121, gy - 3, 7, 3)
  }
  b('#eef3ef', 100, -209, 54, 3)

  glassTower(b, 160, 44, -150, 140, GLASS.blue, 8)
  b('#5f8fc4', 166, -160, 32, 10)
  b('#bfe0f7', 166, -160, 32, 1)
  b('#5f8fc4', 174, -168, 16, 8)
  // Window cleaners, halfway down
  b('#39424e', 66, -236, 1, 62)
  b('#39424e', 78, -236, 1, 62)
  b('#f8c76b', 64, -174, 17, 5)
  b('#39424e', 64, -175, 17, 1)
  b('#e2574c', 68, -178, 2, 3)
  b('#3f7fd6', 74, -178, 2, 3)
}

function cbdFar(b: Brush) {
  const rand = mulberry32(27)
  blob(b, '#ffffff44', -30, -262, 24)
  blob(b, '#ffffff', -30, -262, 13)
  // The Strait, full of ships waiting their turn
  b('#a5cde6', -200, -64, 400, 40)
  b('#c5e2f2', -200, -64, 400, 2)
  for (let i = 0; i < 9; i++) blob(b, '#8fb6cf', -190 + i * 47 + Math.floor(rand() * 20), -65, 14 + Math.floor(rand() * 10), 2)
  for (let i = 0; i < 26; i++) {
    const sx = -196 + Math.floor(rand() * 388)
    const sy = -58 + Math.floor(rand() * 24)
    b('#58748c', sx, sy, 7, 1)
    b('#e2574c', sx + 1, sy - 1, 3, 1)
    b('#eef3ef', sx + 5, sy - 2, 1, 2)
  }
  // The rest of town, in the haze
  let x = -204
  while (x < 200) {
    const w = 14 + Math.floor(rand() * 18)
    const h = 20 + Math.floor(rand() * 120)
    b(rand() < 0.5 ? '#b3cfe4' : '#a3c2da', x, -30 - h, w, h + 200)
    for (let y = -30 - h + 3; y < 40; y += 5) b('#93b4cf', x + 2, y, w - 4, 2)
    x += w + 3 + Math.floor(rand() * 12)
  }
  // Shophouse roofs, a long way down
  b('#9bb8c9', -200, 8, 400, 140)
  for (let hx = -200; hx < 200; hx += 7) {
    b(rand() < 0.6 ? '#c98a6a' : '#b9775a', hx, 10 + Math.floor(rand() * 3), 6, 3)
    b('#e9e2d3', hx, 14, 6, 3)
  }
}

/* Stage 5: Marina Bay after work, the water full of other people's lights */

const SHORE = -30

function lights(b: Brush, rand: () => number, x: number, y: number, w: number, h: number, density: number, colours = ['#ffd98a', '#ffe9b8', '#ffc76b']) {
  for (let wy = y; wy < y + h; wy += 3) {
    for (let wx = x; wx < x + w; wx += 2) {
      if (rand() < density) b(colours[Math.floor(rand() * colours.length)], wx, wy, 1, 2)
    }
  }
}

function marinaMid(b: Brush) {
  const rand = mulberry32(21)
  b('#1b2c5e', -200, SHORE, 400, 200)
  for (let i = 0; i < 150; i++) {
    b(i % 3 ? '#27407c' : '#16244f', -200 + Math.floor(rand() * 392), SHORE + 2 + Math.floor(rand() * 60), 4 + Math.floor(rand() * 8), 1)
  }

  // Supertrees, lit up for the evening show
  for (const [x, h] of [[-176, 30], [-164, 22], [-190, 24]]) {
    b('#3a2f5f', x, SHORE - h, 2, h)
    taper(b, '#8a4fc0', x + 1, SHORE - h - 6, 13, 3, 6)
    for (let k = 0; k < 5; k++) b('#ff9bf0', x - 4 + k * 3, SHORE - h - 6, 1, 1)
  }

  // The museum that looks like a lotus
  for (let a = -70; a <= 70; a += 20) {
    const r = (a * Math.PI) / 180
    line(b, '#e9e6f2', -142, SHORE - 1, Math.round(-142 + Math.sin(r) * 13), Math.round(SHORE - 1 - Math.cos(r) * 12), 3)
    line(b, '#b9b6d0', -142, SHORE - 1, Math.round(-142 + Math.sin(r) * 10), Math.round(SHORE - 1 - Math.cos(r) * 9), 1)
  }

  // The hotel with a boat on its head: three towers, each standing with its feet apart
  for (const x of [-118, -98, -78]) {
    for (let i = 0; i < 62; i++) {
      const split = Math.max(0, Math.round((i - 30) / 10))
      const y = SHORE - 62 + i
      if (split) {
        b('#5a6fb0', x - split, y, 6, 1)
        b('#465a96', x + 8 + split, y, 6, 1)
      } else {
        b('#5a6fb0', x, y, 8, 1)
        b('#465a96', x + 8, y, 6, 1)
      }
    }
    lights(b, rand, x + 1, SHORE - 59, 12, 26, 0.8)
    lights(b, rand, x - 2, SHORE - 30, 4, 28, 0.7)
    lights(b, rand, x + 11, SHORE - 30, 4, 28, 0.7)
    for (let k = 0; k < 9; k++) b('#f8c76b77', x + Math.floor(rand() * 14), SHORE + 3 + Math.floor(rand() * 26), 1, 3)
  }
  b('#3d4f8c', -124, SHORE - 67, 68, 5)
  b('#8f9fdc', -124, SHORE - 67, 68, 1)
  taper(b, '#3d4f8c', -53, SHORE - 66, 8, 2, 4)
  for (let x = -122; x < -54; x += 3) b('#ffd98a', x, SHORE - 64, 1, 1)
  for (let x = -118; x < -60; x += 8) blob(b, '#2f6f5a', x, SHORE - 69, 3, 1)

  // The bridge of lights across to the other side
  for (let x = -52; x < 50; x += 2) {
    b(x % 4 ? '#c77dff' : '#ff9bf0', x, SHORE - 3 - Math.round(Math.sin(((x + 52) / 102) * Math.PI) * 3), 1, 1)
  }
  b('#3a2f5f', -52, SHORE - 2, 102, 1)

  // The big wheel
  const [wx, wy] = [78, SHORE - 36]
  line(b, '#8f98c9', wx, wy, wx - 11, SHORE, 2)
  line(b, '#8f98c9', wx, wy, wx + 11, SHORE, 2)
  for (let k = 0; k < 8; k++) {
    const r = (k * Math.PI) / 8
    line(b, '#5f69a0', Math.round(wx - Math.cos(r) * 23), Math.round(wy - Math.sin(r) * 23), Math.round(wx + Math.cos(r) * 23), Math.round(wy + Math.sin(r) * 23))
  }
  ring(b, '#d6dcff', wx, wy, 24)
  ring(b, '#d6dcff', wx, wy, 23)
  for (let k = 0; k < 16; k++) {
    const r = (k * Math.PI) / 8
    b('#ffe9a8', Math.round(wx + Math.cos(r) * 26) - 1, Math.round(wy + Math.sin(r) * 26) - 1, 2, 2)
  }
  b('#d6dcff', wx - 1, wy - 1, 3, 3)
  b('#33416f', wx - 17, SHORE - 6, 36, 6)
  lights(b, rand, wx - 15, SHORE - 5, 32, 4, 0.5)
  for (let k = 0; k < 20; k++) b('#d6dcff44', wx - 22 + Math.floor(rand() * 44), SHORE + 3 + Math.floor(rand() * 30), 1, 3)

  // The concert hall they call the durians
  for (const [cx, rx, ry] of [[128, 17, 11], [154, 12, 8]]) {
    for (let dy = -ry; dy <= 0; dy++) {
      const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))))
      b('#56659c', cx - half, SHORE + dy, half * 2 + 1, 1)
      for (let px = cx - half; px <= cx + half; px++) if ((px + dy * 2) % 3 === 0) b('#8f9cd1', px, SHORE + dy, 1, 1)
    }
    b('#f8c76b', cx - rx, SHORE - 1, rx * 2, 1)
  }

  // Lamps along the promenade, and what the water makes of them
  for (let x = -200; x < 200; x += 6) {
    b('#ffd98a', x, SHORE - 1, 1, 1)
    if (rand() < 0.6) b('#f8c76b55', x, SHORE + 1 + Math.floor(rand() * 5), 1, 3 + Math.floor(rand() * 6))
  }
  // A river boat with its lanterns on
  b('#101a3d', 152, SHORE + 26, 16, 3)
  b('#101a3d', 155, SHORE + 23, 10, 3)
  b('#ffd98a', 156, SHORE + 24, 8, 1)
  for (let k = 0; k < 5; k++) b('#ff5a6a', 153 + k * 3, SHORE + 22, 1, 1)
  for (let k = 0; k < 7; k++) b('#ff5a6a66', 153 + Math.floor(rand() * 14), SHORE + 30 + k, 2, 1)
}

function nightSkyline(b: Brush, seed: number, base: number, colours: string[], minH: number, maxH: number, from = -206, to = 200) {
  const rand = mulberry32(seed)
  let x = from
  while (x < to) {
    const w = 12 + Math.floor(rand() * 18)
    const h = minH + Math.floor(rand() * (maxH - minH))
    b(colours[Math.floor(rand() * colours.length)], x, base - h, w, h + 40)
    if (rand() < 0.4) b(colours[0], x + 3, base - h - 6, w - 6, 6)
    lights(b, rand, x + 1, base - h + 2, w - 2, h - 2, 0.22, ['#ffd98a', '#ffe9b8', '#9fe3ff'])
    if (rand() < 0.5) b('#ff5a6a', x + Math.floor(w / 2), base - h - (rand() < 0.5 ? 8 : 2), 1, 1)
    x += w + 2 + Math.floor(rand() * 8)
  }
}

function stars(b: Brush, seed: number, count: number, top: number, bottom: number) {
  const rand = mulberry32(seed)
  for (let i = 0; i < count; i++) {
    b(rand() < 0.3 ? '#ffffff' : '#ffffff99', -200 + Math.floor(rand() * 400), top + Math.floor(rand() * (bottom - top)), 1, 1)
  }
}

function marinaFar(b: Brush) {
  stars(b, 4, 90, -380, -150)
  // The moon
  blob(b, '#fff6d833', 150, -250, 22)
  blob(b, '#fff6d8', 150, -250, 11)
  blob(b, '#e9dcb4', 154, -253, 3)
  // The financial district across the water: tallest in the middle, and kept low behind the wheel and the hotel
  nightSkyline(b, 33, SHORE, ['#26305f', '#2d386b', '#222a55'], 60, 160, -50, 48)
  nightSkyline(b, 35, SHORE, ['#303c74', '#37447f'], 30, 90, -54, 52)
  nightSkyline(b, 37, SHORE, ['#26305f', '#2d386b'], 12, 34, 50, 204)
  nightSkyline(b, 39, SHORE, ['#26305f', '#2d386b'], 8, 20, -206, -128)
}

/* Stage 6: above the clouds at last light, with the island laid out below */

const HORIZON = -92

function cloudBank(b: Brush, y: number, seed: number, [light, mid, dark]: string[]) {
  const rand = mulberry32(seed)
  let x = -214
  while (x < 214) {
    const rx = 11 + Math.floor(rand() * 16)
    const ry = 5 + Math.floor(rand() * 5)
    blob(b, dark, x, y + 3, rx, ry)
    blob(b, mid, x - 1, y + 1, rx - 1, ry - 1)
    blob(b, light, x - 3, y - 1, Math.round(rx * 0.6), Math.round(ry * 0.45))
    x += Math.round(rx * 1.25)
  }
  b(mid, -200, y + 5, 400, 30)
}

function spire(b: Brush, x: number, w: number, top: number, seed: number) {
  const rand = mulberry32(seed)
  b('#2b2a5a', x, top, w, 220)
  b('#3d3c78', x, top, 2, 220)
  lights(b, rand, x + 3, top + 4, w - 5, 120, 0.35, ['#ffd98a', '#ffe9b8'])
  // A stepped gold crown, and a mast with a light on it
  b('#d7ae52', x - 2, top - 2, w + 4, 2)
  b('#2b2a5a', x + 3, top - 9, w - 6, 7)
  b('#d7ae52', x + 2, top - 10, w - 4, 1)
  b('#2b2a5a', x + 6, top - 15, w - 12, 5)
  b('#d7ae52', x + 5, top - 16, w - 10, 1)
  b('#d7ae52', x + Math.floor(w / 2) - 1, top - 34, 2, 18)
  b('#ff5a6a', x + Math.floor(w / 2) - 1, top - 36, 2, 2)
}

function penthouseMid(b: Brush) {
  cloudBank(b, -40, 51, ['#f4b9c4', '#c98bb5', '#8f6aa8'])
  spire(b, -148, 26, -112, 2)
  spire(b, 126, 22, -74, 6)
  cloudBank(b, -22, 52, ['#ffd9c2', '#e8a9bd', '#a87ab0'])
  cloudBank(b, -2, 53, ['#fff1dc', '#f7c9c2', '#c995b8'])
  cloudBank(b, 18, 54, ['#fffaf0', '#fbdccf', '#dba9bd'])
  b('#fbdccf', -200, 40, 400, 200)
}

function penthouseFar(b: Brush) {
  const rand = mulberry32(61)
  const sun = -70
  stars(b, 9, 110, -400, -190)
  // The sun going down behind the sea
  blob(b, '#ffd08a22', sun, HORIZON, 62)
  blob(b, '#ffd08a44', sun, HORIZON, 42)
  blob(b, '#ffe2a877', sun, HORIZON, 28)
  blob(b, '#fff3cf', sun, HORIZON, 18)
  b('#5f5cb0', -200, HORIZON, 400, 5)
  b('#4f4fa3', -200, HORIZON + 5, 400, 14)
  b('#404391', -200, HORIZON + 19, 400, 200)
  for (let i = 0; i < 60; i++) {
    const depth = 1 + Math.floor(rand() * 44)
    b(i % 3 ? '#ffd9a0' : '#fff3cf', sun - Math.round(depth / 2) - 8 + Math.floor(rand() * (depth + 16)), HORIZON + depth, 2 + Math.floor(rand() * 5), 1)
  }
  // The mainland, a long way back
  nightSkyline(b, 71, HORIZON + 1, ['#343b78', '#2f3570'], 5, 18, 96, 206)
  blob(b, '#39407f', 150, HORIZON + 1, 60, 4)
  // The resort island, and the cove where the yachts live
  blob(b, '#2c3468', -160, HORIZON + 16, 44, 6)
  for (let x = -196; x < -124; x += 7) blob(b, '#262d5c', x, HORIZON + 11 - Math.floor(rand() * 3), 5, 3)
  blob(b, '#2c3468', 84, HORIZON + 24, 56, 6)
  for (let x = 44; x < 128; x += 9) {
    b('#e9d9c8', x, HORIZON + 18, 6, 4)
    b('#c97b5a', x - 1, HORIZON + 17, 8, 1)
    b('#ffd98a', x + 1 + Math.floor(rand() * 3), HORIZON + 19, 2, 2)
    if (rand() < 0.5) blob(b, '#262d5c', x + 7, HORIZON + 19, 2, 2)
  }
  for (let x = 50; x < 124; x += 12) {
    b('#cfd6ff', x, HORIZON + 30, 1, 8)
    for (const y of [HORIZON + 31, HORIZON + 35]) {
      if (rand() < 0.8) {
        b('#fbf7ee', x + 2, y, 5, 1)
        b('#fbf7ee', x + 4, y - 2, 1, 2)
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const sx = -196 + Math.floor(rand() * 388)
    const sy = HORIZON + 6 + Math.floor(rand() * 40)
    b('#2a2f66', sx, sy, 6, 1)
    b('#ffd98a', sx + 4, sy - 1, 1, 1)
  }
}

export const MORE_BACKDROPS: Record<Exclude<StageId, 'hdb'>, () => Backdrop> = {
  upgraded: () => ({
    far: { top: -280, bottom: 80, rate: 3, art: paint(upgradedFar) },
    mid: { top: -524, bottom: 120, rate: 12, art: paint(upgradedMid) },
  }),
  condo: () => ({
    far: { top: -200, bottom: 80, rate: 3, art: paint(condoFar) },
    mid: { top: -524, bottom: 120, rate: 10, art: paint(condoMid) },
  }),
  cbd: () => ({
    far: { top: -290, bottom: 140, rate: 2, art: paint(cbdFar) },
    mid: { top: -262, bottom: 140, rate: 8, art: paint(cbdMid) },
  }),
  marina: () => ({
    far: { top: -384, bottom: 10, rate: 2, art: paint(marinaFar) },
    mid: { top: -106, bottom: 170, rate: 5, art: paint(marinaMid) },
  }),
  penthouse: () => ({
    far: { top: -404, bottom: 110, rate: 2, art: paint(penthouseFar) },
    mid: { top: -156, bottom: 200, rate: 6, art: paint(penthouseMid) },
  }),
}
