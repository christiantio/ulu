/**
 * Draw the icons and the link-preview image from the game's own pixel art: `npm run art`
 *
 * Writes public/favicon.svg, design/apple-touch-icon.svg and design/og-image.svg. They're plain boxes with no
 * text or fonts, so they render the same anywhere. The PNGs in public/ are rendered from them with resvg: the
 * README has the commands. Run this again after changing the boy, the first lift or the wordmark.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { backdropFor } from '../src/components/elevator/backdrops'
import { BOY_H, BOY_W, drawBoy } from '../src/components/elevator/boy'
import { LOOKS, carBack, carFront, landings, pavement } from '../src/components/elevator/car'
import { label, labelWidth, paint } from '../src/components/elevator/paint'
import { LOGO_H, LOGO_W, drawLogo } from '../src/components/logo-art'
import { formatFloor, GROUND_FLOOR } from '../src/game/elevator'

const root = join(import.meta.dirname, '..')
const INK = '#17212f'

function write(path: string, svg: ReactNode) {
  const markup = renderToStaticMarkup(svg)
  writeFileSync(join(root, path), `${markup}\n`)
  console.log(`${path}  ${(markup.length / 1000).toFixed(1)} kB`)
}

/**
 * His head and shoulders, with a bubble, on a navy tile `size` pixels square: 32 for the favicon, and 30 for the
 * iOS icon so that it scales to 180 px in whole pixels
 */
function icon(size: number, rounded: boolean) {
  const rows = 25
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      <rect width={size} height={size} rx={rounded ? 6 : 0} fill={INK} />
      <g transform={`translate(${(size - BOY_W) / 2} ${size - rows - 1})`}>{paint((b) => drawBoy(b, 12, rows))}</g>
    </svg>
  )
}

/** The link preview: the boy waiting in the first lift, beside the wordmark. 1200 × 630 */
function preview() {
  const hdb = backdropFor('hdb')!
  const look = LOOKS.hdb
  // The scene, 4 px to the unit, with the car's floor at (300, 474)
  const scale = 4
  const [ox, oy] = [300, 474]
  const tagline = 'HOW ULU CAN YOU GO?'
  const about = 'A DAILY SINGAPORE TRIVIA GAME'
  const lamps = ['#d8d1c2', '#f8c76b', '#63d08f', '#6fa8ff', '#b98cff', '#ff7699']
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" shapeRendering="crispEdges">
      <defs>
        <clipPath id="scene">
          <rect width="600" height="630" />
        </clipPath>
      </defs>
      <rect width="1200" height="630" fill={INK} />
      <g clipPath="url(#scene)">
        <rect width="600" height="630" fill="#e2e6c5" />
        <rect y={oy - 80 * scale} width="600" height="630" fill="#f0e4bd" />
        <rect y={oy - 40 * scale} width="600" height="630" fill="#f6e2b6" />
        <g transform={`translate(${ox} ${oy}) scale(${scale})`}>
          {hdb.far.art}
          {hdb.mid.art}
          {paint(pavement)}
          {paint((b) => {
            // Rails and cables, which the app draws with CSS
            b(look.rail, -47, -130, 2, 134)
            b(look.railHi, -47, -130, 1, 134)
            b(look.rail, 45, -130, 2, 134)
            b(look.railHi, 45, -130, 1, 134)
            b('#4f5b5c', -5, -130, 1, 31)
            b('#4f5b5c', 4, -130, 1, 31)
          })}
          {paint((b) => landings(b, 'hdb', GROUND_FLOOR))}
          {paint((b) => carBack(b, 'hdb'))}
          <g transform={`translate(${-BOY_W / 2} ${-BOY_H - 1})`}>{paint((b) => drawBoy(b, 12))}</g>
          {paint((b) => carFront(b, 'hdb', formatFloor(GROUND_FLOOR), false))}
        </g>
      </g>
      <rect x="600" width="6" height="630" fill="#0b1018" />
      <g transform="translate(676 150) scale(14)">{paint(drawLogo)}</g>
      {paint((b) => {
        label(b, '#f8c76b', tagline, 678, 366, 5)
        label(b, '#a9b6c4', about, 678, 420, 3)
        lamps.forEach((fill, i) => {
          b('#0b1018', 678 + i * 44, 478, 32, 32)
          b(fill, 682 + i * 44, 482, 24, 24)
          b('#ffffff66', 682 + i * 44, 482, 24, 4)
        })
        b('#ff7699', 606, 612, 594, 18)
      })}
      <title>{`Ulu: ${tagline} (${labelWidth(tagline, 5)} px wide, ${LOGO_W * 14} × ${LOGO_H * 14} wordmark)`}</title>
    </svg>
  )
}

write('public/favicon.svg', icon(32, true))
write('design/apple-touch-icon.svg', icon(30, false))
write('design/og-image.svg', preview())
