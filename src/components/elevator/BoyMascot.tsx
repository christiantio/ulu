import { memo } from 'react'
import { BOY_ART, BOY_H, BOY_W } from './boy'

/**
 * The boy: white tee, FBT shorts, bathroom slippers and a mouthful of bubblegum. He looks the same in every lift,
 * however grand it gets. His pixels are in boy.ts; his moods are CSS animations on those parts (see elevator.css)
 */
export type BoyMood =
  /** Waiting: blinks now and then, blows a bubble, lets it down or pops it */
  | 'idle'
  /** The lift is moving: a small bob, and the bubble wobbles */
  | 'ride'
  /** A new lift: looks left and right, then back to chewing */
  | 'look'
  /** The lift didn't move: the bubble sags and he sighs */
  | 'miss'
  /** Arrivals, from "everybody says that" to the gem */
  | 'low'
  | 'mid'
  | 'high'
  | 'gem'
  /** The top of a perfect game: no hop, no pop. He blows another bubble */
  | 'calm'

export const BoyMascot = memo(function BoyMascot({ mood = 'idle' }: { mood?: BoyMood }) {
  return (
    <svg
      className={`boy boy--${mood}`}
      viewBox={`0 0 ${BOY_W} ${BOY_H}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <g className="boy__figure">
        {BOY_ART.body}
        <g className="boy__pupils">{BOY_ART.pupils}</g>
        <g className="boy__lids">{BOY_ART.lids}</g>
        <g className="boy__chew boy__chew--a">{BOY_ART.chewA}</g>
        <g className="boy__chew boy__chew--b">{BOY_ART.chewB}</g>
        <g className="boy__sweat">{BOY_ART.sweat}</g>
        <g className="boy__gum">
          {BOY_ART.bubbles.map((art, i) => (
            <g key={i} className={`boy__bubble boy__bubble--${i + 1}`}>
              {art}
            </g>
          ))}
          <g className="boy__pop">{BOY_ART.pop}</g>
        </g>
      </g>
    </svg>
  )
})
