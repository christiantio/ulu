import type { ReactElement } from 'react'
import { mulberry32 } from '../../game/daily'
import type { StageId } from '../../game/elevator'
import { blob, label, line, paint, ring, taper, type Brush } from './paint'

/*
 * What's outside each lift. Every backdrop is two layers of pixel art, drawn once from fixed seeds: a far one that
 * barely moves and a mid one that sinks past as the lift climbs.
 *
 * Scene units, measured from the car: x runs from -200 to 200 with the lift at 0, and y is 0 at the car's floor,
 * negative going up. Each backdrop is composed for the moment its lift is unlocked, and scrolls down from there.
 *
 * Only the first lift's backdrop is here, in the entry chunk: it's the one the home screen needs. The other five
 * are in backdrops-more.tsx, a chunk of its own that loads when a game starts (or when a screen first shows a
 * later lift), so the first visit doesn't pay for scenery it hasn't earned yet.
 */

export interface LayerArt {
  /** The layer's top and bottom edges. The top is negative: it's above the car's floor */
  top: number
  bottom: number
  /** Scene units it sinks for each floor climbed */
  rate: number
  art: ReactElement[]
}

export interface Backdrop {
  far: LayerArt
  mid: LayerArt
}

export const LEAVES = ['#3f8f5a', '#58a86b', '#84c98a']

export function tree(b: Brush, x: number, base: number, h: number, rx: number, ry: number, c = LEAVES) {
  b('#7a5a3a', x - 1, base - h, 3, h)
  b('#5f4329', x + 1, base - h, 1, h)
  blob(b, c[0], x, base - h - ry + 3, rx, ry)
  blob(b, c[1], x - Math.round(rx * 0.2), base - h - ry + 1, Math.round(rx * 0.75), Math.round(ry * 0.7))
  blob(b, c[2], x - Math.round(rx * 0.35), base - h - ry, Math.round(rx * 0.4), Math.round(ry * 0.35))
}

/* Stage 1: the heartland on a warm, hazy afternoon */

/** Where the blocks stand. The lawn and playground run from here down to the pavement in front */
const G = -16
const VOID = '#5d6f6e'
const DOORS = ['#7a4f3a', '#8a3b3b', '#4f6b7a', '#6b5a43']
const CLOTHES = ['#ff7699', '#f8c76b', '#69b5ae', '#f7f3e8', '#e2574c', '#5b7fd1', '#f7f3e8']

interface Slab {
  x: number
  w: number
  storeys: number
  wall: string
  parapet: string
  lip: string
  accent: string
  accentDark: string
  roof: string
  /** Painted down the end wall, as on the real ones, starting this far below the roof */
  number: string
  numberAt: number
  /** Blank end walls, left and right */
  ends: [number, number]
  /** Where the stair core is, from the left of the corridors */
  core: number
  seed: number
}

/** A slab block: common corridors, a void deck, laundry out on poles and plants on the parapet */
function slab(b: Brush, s: Slab) {
  const rand = mulberry32(s.seed)
  const top = G - 14 * (s.storeys + 1)
  const cx = s.x + s.ends[0]
  const cw = s.w - s.ends[0] - s.ends[1]
  b(s.wall, s.x, top, s.w, G - top)
  b(s.roof, s.x - 1, top - 2, s.w + 2, 2)
  // Lift motor room and water tank on the roof
  b(s.wall, cx + s.core - 2, top - 9, 14, 7)
  b(s.roof, cx + s.core - 3, top - 10, 16, 1)
  const tank = s.x + Math.round(s.w * 0.62)
  b('#b6c1bd', tank, top - 11, 18, 7)
  b('#d2dad6', tank, top - 11, 18, 1)
  b('#7d8a86', tank + 2, top - 4, 2, 2)
  b('#7d8a86', tank + 14, top - 4, 2, 2)

  // Void deck
  b(VOID, s.x + 2, G - 12, s.w - 4, 12)
  for (let px = s.x; px <= s.x + s.w - 4; px += 16) b(s.wall, px, G - 12, 4, 12)
  for (let px = s.x + 22; px < s.x + s.w - 30; px += 64) {
    // Stone table and stools, then a bank of letterboxes
    b('#c9c4b8', px, G - 5, 8, 2)
    b('#a9a498', px + 3, G - 3, 2, 3)
    b('#c9c4b8', px - 4, G - 3, 3, 3)
    b('#c9c4b8', px + 9, G - 3, 3, 3)
    b('#aab5b9', px + 26, G - 10, 12, 6)
    for (let k = 0; k < 6; k++) b('#7f8c91', px + 27 + k * 2, G - 9, 1, 4)
  }

  for (let i = 0; i < s.storeys; i++) {
    const y = G - 14 * (i + 2)
    b('#6f7f7c', cx, y + 2, cw, 8)
    for (let ux = cx + 1; ux + 9 <= cx + cw; ux += 10) {
      b(DOORS[Math.floor(rand() * DOORS.length)], ux, y + 4, 3, 6)
      b('#3f4f52', ux + 4, y + 4, 5, 4)
      b(rand() < 0.12 ? '#ffe2a0' : '#a9cfd4', ux + 5, y + 5, 3, 2)
    }
    b(s.parapet, cx, y + 10, cw, 4)
    b(s.lip, cx, y + 10, cw, 1)
    b(s.accent, cx, y + 12, cw, 1)
    // Corridor plants
    for (let k = 0; k < cw / 26; k++) {
      const px = cx + 2 + Math.floor(rand() * (cw - 8))
      b('#b5694a', px, y + 9, 3, 1)
      b('#4f9f63', px, y + 7, 3, 2)
      b(rand() < 0.4 ? '#ff7699' : '#84c98a', px + 1, y + 6, 1, 1)
    }
    // Laundry out on bamboo poles
    for (let ux = cx + 3; ux + 14 < cx + cw; ux += 10) {
      if (rand() > 0.26) continue
      b('#c9a66b', ux, y + 11, 12, 1)
      for (let k = 0; k < 3; k++) {
        b(CLOTHES[Math.floor(rand() * CLOTHES.length)], ux + 1 + k * 4, y + 12, 2 + Math.floor(rand() * 2), 3 + Math.floor(rand() * 2))
      }
      ux += 10
    }
    // Small windows up the end walls
    if (s.ends[0]) b('#3f4f52', s.x + Math.floor(s.ends[0] / 2) - 1, y + 5, 2, 3)
    if (s.ends[1]) b('#3f4f52', s.x + s.w - Math.floor(s.ends[1] / 2) - 1, y + 5, 2, 3)
  }

  // Stair core, with the lift lobby at its foot
  b(s.accent, cx + s.core, top, 10, G - top)
  for (let y = top + 4; y < G - 14; y += 7) b(s.accentDark, cx + s.core + 2, y, 6, 1)
  b(VOID, cx + s.core + 2, G - 10, 6, 10)

  // The block number, on the end wall that faces the lift
  const facing = s.ends[1] ? s.x + s.w - s.ends[1] : s.x
  const endWall = s.ends[1] || s.ends[0]
  b(s.wall, facing, top + s.numberAt - 4, endWall, 42)
  ;[...s.number].forEach((digit, i) => label(b, s.accentDark, digit, facing + Math.floor((endWall - 6) / 2), top + s.numberAt + i * 12, 2))
}

function bicycle(b: Brush, x: number, y: number, frame: string) {
  ring(b, '#2f3a3f', x + 2, y - 3, 2)
  ring(b, '#2f3a3f', x + 9, y - 3, 2)
  line(b, frame, x + 2, y - 3, x + 5, y - 6)
  line(b, frame, x + 5, y - 6, x + 9, y - 3)
  b(frame, x + 5, y - 6, 3, 1)
  b('#2f3a3f', x + 4, y - 7, 3, 1)
  b('#2f3a3f', x + 8, y - 8, 2, 1)
  b('#2f3a3f', x + 9, y - 8, 1, 3)
}

function hdbMid(b: Brush) {
  const rand = mulberry32(3)
  // Lawn, with a footpath across it
  b('#a8cf8e', -200, G - 1, 400, 120)
  b('#92bf7d', -200, G - 1, 400, 1)
  for (let i = 0; i < 70; i++) b('#93c07c', -200 + Math.floor(rand() * 398), G + 2 + Math.floor(rand() * 18), 2, 1)
  b('#eadfc4', -200, -8, 400, 5)
  b('#d3c5a3', -200, -3, 400, 1)

  slab(b, {
    x: 108, w: 96, storeys: 12, wall: '#e2e9d9', parapet: '#edf2e6', lip: '#f8fbf3', accent: '#9ccfb4',
    accentDark: '#5f9f85', roof: '#aebcae', number: '127', numberAt: 8, ends: [12, 0], core: 44, seed: 41,
  })
  slab(b, {
    x: -204, w: 156, storeys: 11, wall: '#f1e5d0', parapet: '#f8f0df', lip: '#fffaf0', accent: '#69b5ae',
    accentDark: '#3f8f88', roof: '#b9a98a', number: '123', numberAt: 76, ends: [0, 14], core: 62, seed: 17,
  })
  slab(b, {
    x: 48, w: 156, storeys: 8, wall: '#f6d9bd', parapet: '#fbe9d6', lip: '#fff4e6', accent: '#e08e68',
    accentDark: '#b9663f', roof: '#c98a6a', number: '125', numberAt: 46, ends: [18, 0], core: 72, seed: 29,
  })

  tree(b, -152, -3, 15, 17, 10)
  tree(b, -112, -9, 10, 10, 7)
  // The sheltered walkway to the lift
  b('#3d8c7c', -204, -28, 162, 2)
  b('#66b9a7', -204, -29, 162, 1)
  for (let px = -196; px < -44; px += 19) b('#ece8da', px, -26, 1, 19)
  b('#ece8da', -43, -26, 1, 19)

  // Bicycles at the rack by the lift
  b('#8f9a9c', -88, -6, 26, 1)
  bicycle(b, -87, -5, '#e2574c')
  bicycle(b, -74, -5, '#3f7fd6')

  // Playground
  b('#cf8562', 60, -2, 66, 5)
  b('#4f9fbf', 78, -2, 22, 5)
  b('#f2c230', 84, -16, 2, 15)
  b('#f2c230', 93, -16, 2, 15)
  taper(b, '#e2574c', 90, -23, 4, 16, 6)
  b('#e2574c', 83, -10, 13, 2)
  line(b, '#3f8fd6', 96, -9, 108, -1, 2)
  b('#f2c230', 80, -10, 1, 9)
  for (const y of [-8, -5, -2]) b('#f2c230', 80, y, 4, 1)
  b('#69b5ae', 110, -16, 1, 15)
  b('#69b5ae', 122, -16, 1, 15)
  b('#69b5ae', 110, -17, 13, 1)
  for (const x of [113, 118]) {
    b('#5d6a6e', x, -16, 1, 9)
    b('#5d6a6e', x + 2, -16, 1, 9)
    b('#e2574c', x, -7, 3, 1)
  }
  b('#e2574c', 66, -6, 5, 3)
  b('#f2c230', 70, -8, 2, 2)
  b('#5d6a6e', 68, -3, 1, 2)

  tree(b, 146, -2, 17, 19, 11)
  tree(b, 186, -6, 12, 13, 9)
  // A lamp post, a bin, and shrubs along the path
  b('#5d6a6e', 57, -34, 1, 30)
  b('#5d6a6e', 54, -35, 4, 1)
  b('#fff6cf', 54, -34, 2, 1)
  b('#2f7d5b', 128, -7, 4, 6)
  b('#1f5f44', 127, -8, 6, 1)
  for (let x = -198; x < 200; x += 13) {
    if (x > -100 && x < 130) continue
    blob(b, LEAVES[1], x, -10, 4, 2)
    b(LEAVES[2], x - 2, -12, 3, 1)
  }
}

function hdbFar(b: Brush) {
  const rand = mulberry32(8)
  const base = G - 6
  // A hazy afternoon sun
  blob(b, '#fff4d633', 118, -232, 30)
  blob(b, '#fff4d655', 118, -232, 22)
  blob(b, '#fffbea', 118, -232, 14)
  let x = -212
  while (x < 200) {
    const w = 26 + Math.floor(rand() * 34)
    const h = 44 + Math.floor(rand() * 70)
    b(rand() < 0.5 ? '#d3dccb' : '#c5d2c8', x, base - h, w, h)
    for (let y = base - h + 4; y < base - 4; y += 6) b('#b3c4ba', x + 2, y, w - 4, 2)
    b('#b3c4ba', x + Math.floor(w / 2) - 3, base - h - 4, 7, 4)
    x += w + 6 + Math.floor(rand() * 18)
  }
  for (let tx = -204; tx < 204; tx += 9) blob(b, '#a9c6a0', tx, base - 3 - Math.floor(rand() * 4), 7, 5)
  b('#a9c6a0', -200, base - 2, 400, 80)
}

const BUILD: Partial<Record<StageId, () => Backdrop>> = {
  hdb: () => ({
    far: { top: -270, bottom: 60, rate: 3, art: paint(hdbFar) },
    mid: { top: -200, bottom: 100, rate: 14, art: paint(hdbMid) },
  }),
}

const built = new Map<StageId, Backdrop>()
const listeners = new Set<() => void>()
let loading: Promise<void> | null = null

/** A lift's backdrop, drawn the first time it's needed. Null for a later lift whose art hasn't loaded yet */
export function backdropFor(stage: StageId): Backdrop | null {
  let backdrop = built.get(stage)
  if (!backdrop) {
    const build = BUILD[stage]
    if (!build) return null
    backdrop = build()
    built.set(stage, backdrop)
  }
  return backdrop
}

/**
 * Fetch the later lifts' backdrops. Safe to call again and again: there's one request, and after a failure (offline,
 * say) the next call tries again. Never rejects: a lift without its scenery is still a lift
 */
export function loadBackdrops(): Promise<void> {
  loading ??= import('./backdrops-more').then(
    (more) => {
      Object.assign(BUILD, more.MORE_BACKDROPS)
      listeners.forEach((listener) => listener())
    },
    () => {
      loading = null
    },
  )
  return loading
}

/** Hear about it when the later backdrops arrive. Returns the way to stop listening */
export function onBackdrops(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
