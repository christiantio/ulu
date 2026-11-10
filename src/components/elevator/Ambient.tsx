import { memo, type CSSProperties } from 'react'
import type { StageId } from '../../game/elevator'
import { paint, sprite } from './paint'

/*
 * Small things that move in the sky, whatever the lift is doing: clouds drifting, birds, a plane on its way to
 * Changi, stars. They're positioned and animated in elevator.css, and stop with prefers-reduced-motion
 */

const CLOUDS = [
  ['.......#####..........', '....##########.###....', '..##################..', '.####################.', '######################', '.oooooooooooooooooooo.'],
  ['....####.....', '..########...', '.###########.', '#############', '.ooooooooooo.'],
  ['...........####.......', '..####...########.....', '.#######################', '########################', '..oooooooooooooooooooo..'].map((r) => r.padEnd(24, '.')),
]

/** Cloud colours for each sky: lit top, shaded belly */
const SKY: Record<StageId, { cloud: [string, string]; clouds: number; birds: number; plane: boolean; stars: number }> = {
  hdb: { cloud: ['#fffaf0', '#f0dfc0'], clouds: 3, birds: 2, plane: false, stars: 0 },
  upgraded: { cloud: ['#ffffff', '#d3ebf3'], clouds: 3, birds: 3, plane: false, stars: 0 },
  condo: { cloud: ['#fff0d9', '#f3bf96'], clouds: 3, birds: 1, plane: false, stars: 0 },
  cbd: { cloud: ['#ffffff', '#cfe3f2'], clouds: 5, birds: 0, plane: true, stars: 0 },
  marina: { cloud: ['#5a63a3', '#414a86'], clouds: 2, birds: 0, plane: true, stars: 7 },
  penthouse: { cloud: ['#ffe2cf', '#d59bbd'], clouds: 4, birds: 0, plane: false, stars: 9 },
}

const BIRD = [paint((b) => sprite(b, ['#...#', '.#.#.', '..#..'], { '#': '#3a4a55' })), paint((b) => sprite(b, ['.....', '##.##', '..#..'], { '#': '#3a4a55' }))]

const PLANE = paint((b) => {
  b('#f4f6f8', 0, 2, 12, 2)
  b('#f4f6f8', 12, 3, 1, 1)
  b('#c9d2da', 4, 4, 5, 1)
  b('#c9d2da', 5, 1, 3, 1)
  b('#f4f6f8', 0, 0, 2, 2)
  b('#ff5a6a', 0, 0, 1, 1)
})

export const Ambient = memo(function Ambient({ stage }: { stage: StageId }) {
  const sky = SKY[stage]
  const [light, shade] = sky.cloud
  return (
    <div className={`ambient ambient--${stage}`}>
      {Array.from({ length: sky.stars }, (_, i) => (
        <i
          key={i}
          className="ambient__star"
          style={{ '--i': i, left: `${(i * 37 + 11) % 100}%`, top: `${(i * 23 + 5) % 40}%` } as CSSProperties}
        />
      ))}
      {Array.from({ length: sky.clouds }, (_, i) => {
        const rows = CLOUDS[i % CLOUDS.length]
        return (
          <svg
            key={i}
            className="ambient__cloud"
            style={{ '--i': i, '--w': rows[0].length, '--h': rows.length } as CSSProperties}
            viewBox={`0 0 ${rows[0].length} ${rows.length}`}
            shapeRendering="crispEdges"
            focusable="false"
          >
            {paint((b) => sprite(b, rows, { '#': light, o: shade }))}
          </svg>
        )
      })}
      {Array.from({ length: sky.birds }, (_, i) => (
        <svg key={i} className="ambient__bird" style={{ '--i': i } as CSSProperties} viewBox="0 0 5 3" shapeRendering="crispEdges" focusable="false">
          <g className="ambient__wing ambient__wing--up">{BIRD[0]}</g>
          <g className="ambient__wing ambient__wing--down">{BIRD[1]}</g>
        </svg>
      ))}
      {sky.plane && (
        <svg className="ambient__plane" viewBox="0 0 13 5" shapeRendering="crispEdges" focusable="false">
          {PLANE}
        </svg>
      )}
    </div>
  )
})
