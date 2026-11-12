import { createElement, type ReactElement } from 'react'

/*
 * Pixel-art drawing for the lift scenes. Everything is boxes on a whole-number grid of scene units, so the art
 * stays crisp at any size. A scene is drawn in order, like paint: later boxes cover earlier ones.
 */

/** Draws one box. Colours are any SVG fill: #rgb, #rrggbb or #rrggbbaa */
export type Brush = (fill: string, x: number, y: number, w: number, h: number) => void

/** Runs a drawing and returns it as paths, one per run of boxes in the same colour */
export function paint(draw: (b: Brush) => void): ReactElement[] {
  const runs: { fill: string; d: string }[] = []
  draw((fill, x, y, w, h) => {
    if (w <= 0 || h <= 0) return
    const d = `M${x} ${y}h${w}v${h}h${-w}z`
    const last = runs[runs.length - 1]
    if (last && last.fill === fill) last.d += d
    else runs.push({ fill, d })
  })
  // createElement, not JSX, so that scripts/art.tsx can draw with this outside the app's build
  return runs.map((run, i) => createElement('path', { key: i, fill: run.fill, d: run.d }))
}

/** A filled ellipse, one box per row. `ry` defaults to a circle */
export function blob(b: Brush, fill: string, cx: number, cy: number, rx: number, ry = rx) {
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))))
    b(fill, cx - half, cy + dy, half * 2 + 1, 1)
  }
}

/** The outline of a circle, a pixel thick */
export function ring(b: Brush, fill: string, cx: number, cy: number, r: number) {
  const steps = Math.ceil(r * 7)
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    b(fill, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1)
  }
}

/** A straight pixel line between two points */
export function line(b: Brush, fill: string, x0: number, y0: number, x1: number, y1: number, thick = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= steps; i++) {
    b(fill, Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), thick, thick)
  }
}

/** A stepped triangle or trapezium: `top` wide at the top, `bottom` wide at the base, centred on `cx` */
export function taper(b: Brush, fill: string, cx: number, y: number, top: number, bottom: number, h: number) {
  for (let i = 0; i < h; i++) {
    const w = Math.round(top + ((bottom - top) * i) / Math.max(h - 1, 1))
    b(fill, Math.round(cx - w / 2), y + i, w, 1)
  }
}

/** A 3 × 5 pixel font: each glyph is its five rows, top to bottom, as 3-bit numbers */
const GLYPHS: Record<string, string> = {
  0: '75557', 1: '26227', 2: '71747', 3: '71717', 4: '55711', 5: '74717', 6: '74757', 7: '71111', 8: '75757',
  9: '75717', A: '25755', B: '65656', C: '74447', D: '65556', E: '74647', F: '74644', G: '74557', H: '55755',
  I: '72227', K: '55655', L: '44447', M: '57755', N: '75555', O: '75557', P: '75744', R: '65655', S: '74717',
  T: '72222', U: '55557', V: '55552', W: '55775', Y: '55222', '-': '00700', '?': '71202', '.': '00002',
}

/** Pixel text with its top-left corner at (x, y). Each letter is 3 × 5 pixels of `size`, a pixel apart */
export function label(b: Brush, fill: string, text: string, x: number, y: number, size = 1) {
  ;[...text].forEach((ch, i) => {
    const rows = GLYPHS[ch]
    if (!rows) return
    for (let r = 0; r < 5; r++) {
      const bits = Number(rows[r])
      for (let c = 0; c < 3; c++) {
        if (bits & (4 >> c)) b(fill, x + (i * 4 + c) * size, y + r * size, size, size)
      }
    }
  })
}

export const labelWidth = (text: string, size = 1) => (text.length * 4 - 1) * size

/**
 * A sprite from rows of palette keys ('.' is empty), with its top-left corner at (x, y). With `outline`, every
 * empty pixel touching the sprite is filled too, for a silhouette that reads on any background: leave a pixel
 * of room around it
 */
export function sprite(
  b: Brush,
  rows: readonly string[],
  palette: Record<string, string>,
  x = 0,
  y = 0,
  outline?: string,
) {
  const at = (r: number, c: number) => rows[r]?.[c] ?? '.'
  const solid = (r: number, c: number) => at(r, c) !== '.'
  if (outline) {
    for (let r = -1; r <= rows.length; r++) {
      for (let c = -1; c <= rows[0].length; c++) {
        if (!solid(r, c) && (solid(r - 1, c) || solid(r + 1, c) || solid(r, c - 1) || solid(r, c + 1))) {
          b(outline, x + c, y + r, 1, 1)
        }
      }
    }
  }
  rows.forEach((row, r) => {
    let c = 0
    while (c < row.length) {
      const key = row[c]
      let end = c + 1
      while (end < row.length && row[end] === key) end++
      if (key !== '.') b(palette[key], x + c, y + r, end - c, 1)
      c = end
    }
  })
}

/** Seven-segment digits, 8 × 12, for the floor indicator. Segments a to g, as on a real display */
const SEGMENTS: [number, number, number, number][] = [
  [1, 0, 6, 2],
  [6, 1, 2, 5],
  [6, 6, 2, 5],
  [1, 10, 6, 2],
  [0, 6, 2, 5],
  [0, 1, 2, 5],
  [1, 5, 6, 2],
]
const DIGITS: Record<string, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg',
  9: 'abcdfg', P: 'abefg', H: 'bcefg', '-': 'g', ' ': '',
}

/** Seven-segment characters with the first one's top-left corner at (x, y): lit segments over unlit ghosts */
export function sevenSegment(b: Brush, text: string, x: number, y: number, lit: string, ghost: string) {
  ;[...text.padStart(2, ' ')].forEach((ch, i) => {
    const on = DIGITS[ch] ?? ''
    SEGMENTS.forEach(([sx, sy, w, h], s) => {
      b(on.includes('abcdefg'[s]) ? lit : ghost, x + i * 10 + sx, y + sy, w, h)
    })
  })
}
