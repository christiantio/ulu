import { memo, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { mulberry32 } from '../game/daily'
import {
  ARRIVAL_LINES,
  COAST,
  DEPART_MS,
  LEAVE_MS,
  SKIP_GRACE_MS,
  STOPS,
  journeyMs,
  leaving,
  position,
  stopsFor,
  travelMs,
} from '../game/journey'
import { DESTINATIONS, MISS_EMOJI, TIER_INFO } from '../game/scoring'
import type { Prompt, RoundResult, Tier } from '../game/types'

/*
 * Scene units. The viewport is 480 × VIEW_H and every layer is drawn in the same units, so the scene scales
 * with the card. The vehicle stays put at VX and the world scrolls under it, which only moves composited layers.
 */
const VIEW_H = 240
/** The vehicle's centre, across the viewport */
const VX = 190
/** Between two stations */
const GAP = 340
const NEAR_W = 2560
/** The far layer moves at this share of the near one */
const FAR = 0.35
const FAR_W = 1240
const LAND_END = VX + COAST * GAP
/** Ground level for buildings, the viaduct deck, and the sea */
const GROUND = 200
const DECK = 172
const SEA = 192
/** Above this speed (stations per ms), the speed lines are fully drawn */
const STREAK_SPEED = 0.0025

const stationX = (i: number) => VX + i * GAP

type Stage = 'depart' | 'travel' | 'arrive'

interface Props {
  prompt: Prompt
  result: RoundResult
  /** Called once, when the ride is over or the player skips it */
  onDone: () => void
}

/** The ride out of town after an answer: how far it goes is how ulu the answer was */
export function Journey({ prompt, result, onDone }: Props) {
  const tier = result.tier
  const stops = tier ? stopsFor(tier) : 0
  const [stage, setStage] = useState<Stage>('depart')
  // Stations reached so far, and whether the train has become a boat. Both change a handful of times a ride
  const [passed, setPassed] = useState(0)
  const [atSea, setAtSea] = useState(false)
  const [pieces] = useState(() => confetti(tier))
  const uid = useId().replace(/[^\w-]/g, '')

  const near = useRef<HTMLDivElement>(null)
  const far = useRef<HTMLDivElement>(null)
  const late = useRef<HTMLDivElement>(null)
  const sun = useRef<HTMLDivElement>(null)
  const vehicle = useRef<HTMLDivElement>(null)
  const streaks = useRef<HTMLDivElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const mountedAt = useRef(0)
  const finished = useRef(false)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  const finish = () => {
    if (finished.current) return
    finished.current = true
    done.current()
  }
  const skip = () => {
    if (performance.now() - mountedAt.current >= SKIP_GRACE_MS) finish()
  }

  useEffect(() => {
    const start = performance.now()
    mountedAt.current = start
    skipRef.current?.focus()
    const travel = tier ? travelMs(stops) : LEAVE_MS
    let frame = 0
    let reached = 0
    let sea = false
    let last = { pos: 0, at: start }

    // Continuous motion goes straight to the DOM; only station passes and the coast go through React
    const paint = (now: number) => {
      const t = Math.min(now - start - DEPART_MS, travel)
      if (!tier) {
        if (vehicle.current) vehicle.current.style.transform = `translate3d(${leaving(t) * 260}%, 0, 0)`
        return t < travel
      }
      const pos = position(t, stops)
      const x = pos * GAP
      if (near.current) near.current.style.transform = `translate3d(${(-x / NEAR_W) * 100}%, 0, 0)`
      if (far.current) far.current.style.transform = `translate3d(${((-x * FAR) / FAR_W) * 100}%, 0, 0)`
      const lateness = Math.min(pos / STOPS.length, 1)
      if (late.current) late.current.style.opacity = String(lateness)
      if (sun.current) sun.current.style.transform = `translate3d(0, ${lateness * 140}%, 0)`
      const speed = now > last.at ? (pos - last.pos) / (now - last.at) : 0
      if (streaks.current) streaks.current.style.opacity = String(Math.min(Math.max(speed / STREAK_SPEED, 0), 1))
      last = { pos, at: now }
      const nowReached = Math.min(Math.floor(pos + 0.02), stops)
      if (nowReached !== reached) {
        reached = nowReached
        setPassed(reached)
      }
      if (pos >= COAST !== sea) {
        sea = pos >= COAST
        setAtSea(sea)
      }
      return t < travel
    }
    const loop = (now: number) => {
      if (paint(now)) frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    const timers = [
      window.setTimeout(() => setStage('travel'), DEPART_MS),
      window.setTimeout(() => {
        // Lands the ride even if frames were throttled, as in a background tab
        paint(start + DEPART_MS + travel)
        if (streaks.current) streaks.current.style.opacity = '0'
        setStage('arrive')
      }, DEPART_MS + travel),
      window.setTimeout(finish, journeyMs(tier)),
    ]
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach((id) => window.clearTimeout(id))
    }
    // Runs once per ride: the component is keyed by prompt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const arrived = stage === 'arrive'
  const reachedTier = passed > 0 ? STOPS[passed - 1] : null
  // The station it stops at is reached a moment before it comes to rest, so it never counts as passed
  const lastPassed = Math.min(passed, stops - 1)
  const passedTier = lastPassed > 0 ? STOPS[lastPassed - 1] : null
  const caption = arrived
    ? ARRIVAL_LINES[tier ?? 'miss']
    : stage === 'depart'
      ? 'Doors closing…'
      : !tier
        ? 'Wait, wait!'
        : passedTier
          ? `Not stopping at ${TIER_INFO[passedTier].label}…`
          : `Leaving ${DESTINATIONS[0].name}…`

  return (
    <section className={`journey journey--${stage} ${tier ? `tier--${tier}` : 'journey--miss'}`}>
      <p className="reveal__prompt">{prompt.text}</p>

      <div className="journey__viewport" onClick={skip} aria-hidden="true">
        <div className="journey__late" ref={late}>
          <Stars />
        </div>
        <div className="journey__sun" ref={sun} />
        <div className="journey__layer journey__layer--far" ref={far}>
          <FarScene />
        </div>
        <div className="journey__layer journey__layer--near" ref={near}>
          <NearScene uid={uid} here={stops} />
        </div>
        <div className="journey__streaks" ref={streaks}>
          {[18, 34, 52, 66, 80].map((y, i) => (
            <i key={y} style={{ '--y': `${y}%`, '--d': `${-i * 0.13}s` } as CSSProperties} />
          ))}
        </div>

        <div className={`journey__vehicle ${atSea ? 'journey__vehicle--sea' : ''}`} ref={vehicle}>
          <svg viewBox="0 0 140 70" className="journey__vehicle-body">
            <Train />
            <Boat />
          </svg>
        </div>
        {atSea && <Splash />}

        <div className="journey__hud">
          {result.answer && <span className="journey__ticket">{result.answer}</span>}
          <span key={passed} className={`journey__meter ${reachedTier ? `tier--${reachedTier}` : ''}`}>
            +{reachedTier ? TIER_INFO[reachedTier].points : 0}
          </span>
        </div>

        {arrived && <Arrival tier={tier} pieces={pieces} points={result.points} />}
      </div>

      <div className="journey__bar">
        <p key={caption} className="journey__caption" aria-hidden="true">
          {caption}
        </p>
        <button
          ref={skipRef}
          type="button"
          className="btn btn--ghost btn--small"
          onClick={skip}
          aria-label="Skip to the result"
        >
          Skip ›
        </button>
      </div>
    </section>
  )
}

/** The stamp, and the tier's own flourish */
function Arrival({ tier, pieces, points }: { tier: Tier | null; pieces: CSSProperties[]; points: number }) {
  const label = tier ? TIER_INFO[tier].label : 'Time up!'
  return (
    <>
      {(tier === 'ulu' || tier === 'gem') && <div className="journey__flash" />}
      {pieces.length > 0 && (
        <div className="journey__confetti">
          {pieces.map((style, i) => (
            <i key={i} style={style} />
          ))}
        </div>
      )}
      {tier === 'gem' && <Sparkles />}
      {(tier === 'common' || tier === 'trap') && <Crowd lines={CROWD_LINES[tier]} />}
      {!tier && <Crowd lines={['…']} lonely />}
      <div className="journey__stamp">
        <span className="journey__stamp-label">
          <span className="journey__stamp-emoji">{tier ? TIER_INFO[tier].emoji : MISS_EMOJI}</span> {label}
        </span>
        <span className="journey__stamp-points">+{points}</span>
      </div>
    </>
  )
}

/** What each commuter on the platform says; an empty line is a quiet one */
const CROWD_LINES = {
  common: ['', 'Me too!', '', 'Obviously lah', '', 'Same!'],
  trap: ['', 'Same leh', '', 'Wah, act smart'],
}

/** Commuters on the platform who all thought of it too. Or, for a miss, you, left behind */
function Crowd({ lines, lonely = false }: { lines: string[]; lonely?: boolean }) {
  return (
    <div className={`journey__crowd ${lonely ? 'journey__crowd--lonely' : ''}`}>
      {lines.map((line, i) => (
        <span key={i} className="journey__person" style={{ '--i': i } as CSSProperties}>
          {/* At alternating heights, so neighbouring bubbles don't overlap */}
          {line && <span className={`journey__bubble ${i % 4 === 3 ? 'journey__bubble--high' : ''}`}>{line}</span>}
          <svg viewBox="0 0 12 28">
            <circle cx="6" cy="5" r="4" className={`j-skin-${i % 3}`} />
            <rect x="1" y="10" width="10" height="13" rx="4" className={`j-shirt-${i % 4}`} />
            <rect x="2.5" y="21" width="3" height="7" rx="1" className="j-legs" />
            <rect x="6.5" y="21" width="3" height="7" rx="1" className="j-legs" />
          </svg>
        </span>
      ))}
    </div>
  )
}

const CONFETTI: Partial<Record<Tier, number>> = { solid: 14, rare: 24, ulu: 36, gem: 48 }
const CONFETTI_COLOURS = ['var(--tier)', 'var(--brand)', '#f5c542', '#4cc27b', '#6b9cff', '#b48aff', '#ffffff']

/** A burst from the stamp: out and up, then falling. Random per ride */
function confetti(tier: Tier | null): CSSProperties[] {
  const count = (tier && CONFETTI[tier]) ?? 0
  return Array.from({ length: count }, () => {
    const angle = (-160 + Math.random() * 140) * (Math.PI / 180)
    const distance = 10 + Math.random() * 26
    // Distances are in cqw: hundredths of the scene's width
    return {
      '--dx': (Math.cos(angle) * distance).toFixed(1),
      '--dy': (Math.sin(angle) * distance * 0.8).toFixed(1),
      '--fall': (26 + Math.random() * 30).toFixed(1),
      '--rot': `${Math.round(-540 + Math.random() * 1080)}deg`,
      '--delay': `${Math.round(Math.random() * 120)}ms`,
      '--dur': `${Math.round(1000 + Math.random() * 500)}ms`,
      '--c': CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
    } as CSSProperties
  })
}

function Sparkles() {
  // Around the lighthouse, clear of the stamp
  const spots = [
    [72, 50],
    [86, 10],
    [94, 30],
    [70, 64],
    [90, 56],
    [80, 4],
    [96, 74],
    [64, 78],
  ]
  return (
    <div className="journey__sparkles">
      {spots.map(([x, y], i) => (
        <i key={i} style={{ left: `${x}%`, top: `${y}%`, '--i': i } as CSSProperties}>
          ✦
        </i>
      ))}
    </div>
  )
}

function Splash() {
  return (
    <div className="journey__splash">
      {[-14, -9, -4, 1, 6, 11, 16].map((dx, i) => (
        <i key={dx} style={{ '--dx': dx, '--dy': -(10 + ((i * 7) % 9)) } as CSSProperties} />
      ))}
    </div>
  )
}

const Stars = memo(function Stars() {
  const rand = mulberry32(7)
  return (
    <div className="journey__stars">
      {Array.from({ length: 22 }, (_, i) => (
        <i key={i} style={{ left: `${rand() * 100}%`, top: `${rand() * 55}%`, '--i': i % 5 } as CSSProperties} />
      ))}
    </div>
  )
})

/** Side view of a two-car train, nose to the right. Local units: the vehicle box is 140 × 70 */
function Train() {
  return (
    <g className="journey__train">
      {[4, 71].map((x, car) => (
        <g key={x}>
          <path
            className="j-train"
            d={
              car === 0
                ? `M${x + 5},8 h55 a5,5 0 0 1 5,5 v25 h-65 v-25 a5,5 0 0 1 5,-5 z`
                : `M${x + 5},8 h44 q14,0 16,16 v14 h-65 v-25 a5,5 0 0 1 5,-5 z`
            }
          />
          <rect className="j-glass" x={x + 5} y="13" width={car === 0 ? 55 : 46} height="10" rx="2" />
          {car === 1 && <path className="j-glass" d={`M${x + 54},13 h4 q5,1 6,10 h-10 z`} />}
          <rect className="j-stripe" x={x} y="28" width={car === 0 ? 65 : 64} height="3" />
          {[14, 40].map((dx) => (
            <g key={dx}>
              <line className="j-door" x1={x + dx} y1="12" x2={x + dx} y2="38" />
              <line className="j-door" x1={x + dx + 8} y1="12" x2={x + dx + 8} y2="38" />
              <circle className="journey__door-light" cx={x + dx + 4} cy="10" r="1.2" />
            </g>
          ))}
          <rect className="j-bogie" x={x + 6} y="37" width="14" height="3" rx="1" />
          <rect className="j-bogie" x={x + 45} y="37" width="14" height="3" rx="1" />
        </g>
      ))}
      <rect className="j-bogie" x="68" y="24" width="4" height="6" />
      <circle className="j-headlight" cx="134" cy="33" r="1.8" />
    </g>
  )
}

/** A bumboat: wooden hull with an eye on the bow, and a canopy */
function Boat() {
  return (
    <g className="journey__boat">
      <path className="j-wake" d="M2,60 q6,-4 12,0 q6,4 12,0" />
      <rect className="j-boat-post" x="30" y="32" width="2" height="20" />
      <rect className="j-boat-post" x="66" y="32" width="2" height="20" />
      <rect className="j-boat-post" x="100" y="32" width="2" height="20" />
      <path className="j-boat-canopy" d="M24,34 q42,-10 84,0 v-3 q-42,-10 -84,0 z" />
      <rect className="j-boat-canopy" x="24" y="31" width="84" height="4" rx="2" />
      <path className="j-hull" d="M10,50 H128 Q124,62 112,67 H30 Q16,64 10,50 Z" />
      <path className="j-hull-stripe" d="M12,54 H126" />
      <circle className="j-eye" cx="116" cy="56" r="3" />
      <circle className="j-eye-pupil" cx="117" cy="56" r="1.4" />
      <line className="j-boat-post" x1="16" y1="50" x2="16" y2="30" />
      <path className="j-flag" d="M16,30 l9,3 l-9,3 z" />
    </g>
  )
}

/** One station on the line: a canopy and sign on land, a post (and on Ubin, a jetty) at sea */
function Station({ i, here }: { i: number; here: boolean }) {
  const x = stationX(i)
  const tier = i > 0 ? STOPS[i - 1] : null
  const label = tier ? TIER_INFO[tier].label : DESTINATIONS[0].name
  const atSea = x > LAND_END
  return (
    <g>
      {atSea ? (
        <>
          <rect className="j-post" x={x - 2} y="130" width="4" height={SEA - 130 + 6} />
          {i === 5 && (
            <g>
              <rect className="j-jetty" x={x - 60} y={SEA - 6} width="150" height="4" />
              {[-56, -20, 16, 52, 86].map((dx) => (
                <rect key={dx} className="j-jetty" x={x + dx} y={SEA - 6} width="3" height="16" />
              ))}
            </g>
          )}
        </>
      ) : (
        <>
          <rect className="j-canopy" x={x - 92} y="100" width="184" height="6" rx="2" />
          <rect className="j-post" x={x - 86} y="106" width="3" height={DECK - 106} />
          <rect className="j-post" x={x + 83} y="106" width="3" height={DECK - 106} />
        </>
      )}
      <g
        className={`journey__sign ${tier ? `tier--${tier}` : 'journey__sign--start'} ${here ? 'journey__sign--here' : ''}`}
      >
        <rect className="j-sign" x={x - 84} y="112" width="168" height="25" rx="4" />
        {tier ? (
          <>
            <rect className="j-sign-badge" x={x - 80} y="116" width="32" height="17" rx="8.5" />
            <text className="j-sign-badge-text" x={x - 64} y="128.6" textAnchor="middle">
              {TIER_INFO[tier].points}
            </text>
            <text className="j-sign-text" x={x + 18} y="129.2" textAnchor="middle">
              {label.toUpperCase()}
            </text>
          </>
        ) : (
          <text className="j-sign-text" x={x} y="129.2" textAnchor="middle">
            {label.toUpperCase()}
          </text>
        )}
      </g>
    </g>
  )
}

/** The scenery the train rides past, from the CBD to the lighthouse. The same every time: it's seeded */
const NearScene = memo(function NearScene({ uid, here }: { uid: string; here: number }) {
  const s = scene()
  const lighthouseX = stationX(6) + 190
  return (
    <svg viewBox={`0 0 ${NEAR_W} ${VIEW_H}`} preserveAspectRatio="xMinYMin meet">
      <defs>
        <pattern id={`${uid}-win`} width="7" height="9" patternUnits="userSpaceOnUse">
          <rect className="j-window" x="1.5" y="2" width="4" height="5" />
        </pattern>
        <pattern id={`${uid}-hdb`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect className="j-hdb-window" x="1" y="3" width="8" height="4" />
        </pattern>
        <linearGradient id={`${uid}-beam-l`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#fff3a6" stopOpacity="1" />
          <stop offset="1" stopColor="#fff3a6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-beam-r`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff3a6" stopOpacity="1" />
          <stop offset="1" stopColor="#fff3a6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.35" stopColor="#ffe68a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd34d" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* CBD towers */}
      {s.towers.map((b, i) => (
        <g key={`t${i}`}>
          {b.antenna && <rect className={`j-tower-${b.tone}`} x={b.x + b.w / 2 - 1} y={GROUND - b.h - 12} width="2" height="12" />}
          <rect className={`j-tower-${b.tone}`} x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
          <rect fill={`url(#${uid}-win)`} x={b.x + 3} y={GROUND - b.h + 6} width={b.w - 6} height={b.h - 12} />
        </g>
      ))}

      {/* Shophouses */}
      {s.shops.map((b, i) => (
        <g key={`s${i}`}>
          <rect className={`j-shop-${b.tone}`} x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
          <polygon className="j-roof" points={`${b.x - 1},${GROUND - b.h} ${b.x + b.w / 2},${GROUND - b.h - 7} ${b.x + b.w + 1},${GROUND - b.h}`} />
          <rect className="j-shutter" x={b.x + 4} y={GROUND - b.h + 5} width={b.w / 2 - 6} height="9" rx="1" />
          <rect className="j-shutter" x={b.x + b.w / 2 + 2} y={GROUND - b.h + 5} width={b.w / 2 - 6} height="9" rx="1" />
          <rect className="j-shade" x={b.x + 3} y={GROUND - 12} width={b.w - 6} height="12" rx="4" />
        </g>
      ))}

      {/* HDB blocks, with laundry out */}
      {s.blocks.map((b, i) => (
        <g key={`h${i}`}>
          <rect className={`j-hdb-${b.tone}`} x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
          <rect className={`j-hdb-top-${b.tone}`} x={b.x} y={GROUND - b.h} width={b.w} height="7" />
          <rect fill={`url(#${uid}-hdb)`} x={b.x + 4} y={GROUND - b.h + 10} width={b.w - 8} height={b.h - 22} />
          <rect className="j-void" x={b.x} y={GROUND - 9} width={b.w} height="9" />
          {b.laundry.map((l, j) => (
            <rect key={j} className={`j-laundry-${l.tone}`} x={l.x} y={l.y} width="4" height="5" />
          ))}
        </g>
      ))}

      {/* Trees and a kampung house up north */}
      <g>
        <rect className="j-kampung" x={1622} y={GROUND - 22} width="34" height="14" />
        <polygon className="j-attap" points={`1617,${GROUND - 22} 1639,${GROUND - 36} 1661,${GROUND - 22}`} />
        <rect className="j-trunk" x={1625} y={GROUND - 8} width="2" height="8" />
        <rect className="j-trunk" x={1651} y={GROUND - 8} width="2" height="8" />
      </g>
      {s.trees.map((t, i) => (
        <g key={`r${i}`}>
          <rect className="j-trunk" x={t.x - 1.5} y={GROUND - t.h} width="3" height={t.h} />
          <circle className={`j-leaf-${t.tone}`} cx={t.x - t.r * 0.6} cy={GROUND - t.h + 2} r={t.r * 0.75} />
          <circle className={`j-leaf-${1 - t.tone}`} cx={t.x + t.r * 0.5} cy={GROUND - t.h + 1} r={t.r * 0.8} />
          <circle className={`j-leaf-${t.tone}`} cx={t.x} cy={GROUND - t.h - t.r * 0.5} r={t.r} />
        </g>
      ))}

      {/* Ground, the shore and the sea */}
      <rect className="j-ground" x="-10" y={GROUND} width={1414 + 10} height={VIEW_H - GROUND} />
      <rect className="j-grass" x="1414" y={GROUND} width={LAND_END - 1414} height={VIEW_H - GROUND} />
      <rect className="j-road" x="-10" y={GROUND + 14} width={1414 + 10} height="10" />
      <rect className="j-water" x={LAND_END - 6} y={SEA} width={NEAR_W - LAND_END + 6} height={VIEW_H - SEA} />
      <rect className="j-water-deep" x={LAND_END + 30} y={SEA + 22} width={NEAR_W - LAND_END} height={VIEW_H - SEA - 22} />
      <path
        className="j-sand"
        d={`M${LAND_END - 30},${GROUND} L${LAND_END - 12},${SEA - 1} H${LAND_END + 4} L${LAND_END + 44},${VIEW_H} H${LAND_END - 30} Z`}
      />
      <g className="journey__waves">
        {[SEA + 6, SEA + 18, SEA + 32].map((y, row) => (
          <path
            key={y}
            className="j-wave"
            d={`M${LAND_END + row * 9},${y} ${Array.from({ length: 44 }, () => 'q5,-3 10,0 t10,0').join(' ')}`}
          />
        ))}
      </g>

      {/* Pulau Ubin */}
      <path className="j-island" d={`M1800,${SEA + 1} C1830,170 1880,158 1960,164 C2010,168 2040,180 2064,${SEA + 1} Z`} />
      {[
        [1846, 166, 11],
        [1872, 158, 14],
        [1900, 160, 12],
        [1924, 164, 9],
        [2010, 170, 10],
        [2030, 176, 8],
      ].map(([cx, cy, r], i) => (
        <circle key={cx} className={`j-leaf-${i % 2}`} cx={cx} cy={cy} r={r} />
      ))}
      <g>
        {[1946, 1956, 1966, 1976].map((x) => (
          <rect key={x} className="j-trunk" x={x} y={170} width="2" height={SEA - 166} />
        ))}
        <rect className="j-kampung" x={1942} y={156} width="38" height="14" />
        <polygon className="j-attap" points={`1937,156 1961,142 1985,156`} />
      </g>

      {/* Pedra Branca and its lighthouse */}
      <path className="j-rock" d={`M${lighthouseX - 90},${SEA + 1} C${lighthouseX - 70},178 ${lighthouseX - 40},173 ${lighthouseX},174 C${lighthouseX + 40},175 ${lighthouseX + 70},184 ${lighthouseX + 90},${SEA + 1} Z`} />
      <rect className="j-kampung" x={lighthouseX + 14} y={164} width="26" height="12" />
      <g className="journey__beam" style={{ transformOrigin: `${lighthouseX}px 86px` }}>
        <polygon fill={`url(#${uid}-beam-l)`} points={`${lighthouseX},86 ${lighthouseX - 230},58 ${lighthouseX - 230},114`} />
        <polygon fill={`url(#${uid}-beam-r)`} points={`${lighthouseX},86 ${lighthouseX + 170},62 ${lighthouseX + 170},110`} />
      </g>
      <polygon className="j-lighthouse" points={`${lighthouseX - 10},176 ${lighthouseX + 10},176 ${lighthouseX + 7},96 ${lighthouseX - 7},96`} />
      <rect className="j-lighthouse-band" x={lighthouseX - 8.6} y="122" width="17.2" height="7" />
      <rect className="j-lighthouse-band" x={lighthouseX - 9.4} y="150" width="18.8" height="7" />
      <rect className="j-lighthouse-top" x={lighthouseX - 12} y="92" width="24" height="4" />
      <rect className="journey__lamp" x={lighthouseX - 8} y="80" width="16" height="12" rx="2" />
      <path className="j-lighthouse-top" d={`M${lighthouseX - 9},81 a9,8 0 0 1 18,0 z`} />
      <circle
        className="journey__halo"
        style={{ transformOrigin: `${lighthouseX}px 86px` }}
        fill={`url(#${uid}-halo)`}
        cx={lighthouseX}
        cy="86"
        r="30"
      />

      {/* The viaduct, which stops at the shore */}
      {s.pillars.map((x) => (
        <rect key={x} className="j-pillar" x={x} y={DECK + 8} width="9" height={GROUND - DECK - 8} />
      ))}
      <rect className="j-deck" x="-10" y={DECK} width={LAND_END + 30} height="8" />
      <rect className="j-rail" x="-10" y={DECK - 1.5} width={LAND_END + 30} height="1.5" />
      <rect className="j-buffer" x={LAND_END + 16} y={DECK - 8} width="5" height="8" />

      {Array.from({ length: STOPS.length + 1 }, (_, i) => (
        <Station key={i} i={i} here={i === here} />
      ))}
    </svg>
  )
})

/** Distant skyline, hills and islands, which drift by slower */
const FarScene = memo(function FarScene() {
  const s = scene()
  const coast = VX + COAST * GAP * FAR
  return (
    <svg viewBox={`0 0 ${FAR_W} ${VIEW_H}`} preserveAspectRatio="xMinYMin meet">
      {s.clouds.map((c, i) => (
        <g key={i} className="j-cloud">
          <ellipse cx={c.x} cy={c.y} rx={c.w} ry={c.w * 0.32} />
          <ellipse cx={c.x - c.w * 0.35} cy={c.y - c.w * 0.18} rx={c.w * 0.42} ry={c.w * 0.3} />
          <ellipse cx={c.x + c.w * 0.25} cy={c.y - c.w * 0.24} rx={c.w * 0.5} ry={c.w * 0.36} />
        </g>
      ))}
      <path className="j-far" d={`M-10,${GROUND} C120,150 260,170 380,140 C470,120 560,160 ${coast},${SEA} H-10 Z`} />
      {s.skyline.map((b, i) => (
        <rect key={i} className="j-far" x={b.x} y={GROUND - b.h} width={b.w} height={b.h} />
      ))}
      <rect className="j-far-sea" x={coast - 20} y={SEA - 2} width={FAR_W - coast + 20} height={VIEW_H - SEA + 2} />
      <path className="j-far-island" d={`M${coast + 60},${SEA - 1} C${coast + 110},170 ${coast + 230},168 ${coast + 300},${SEA - 1} Z`} />
      <path className="j-far-island" d={`M${coast + 380},${SEA - 1} C${coast + 400},182 ${coast + 440},182 ${coast + 460},${SEA - 1} Z`} />
    </svg>
  )
})

interface Box {
  x: number
  w: number
  h: number
  tone: number
}

interface SceneData {
  towers: (Box & { antenna: boolean })[]
  shops: Box[]
  blocks: (Box & { laundry: { x: number; y: number; tone: number }[] })[]
  trees: { x: number; h: number; r: number; tone: number }[]
  pillars: number[]
  skyline: Box[]
  clouds: { x: number; y: number; w: number }[]
}

let cached: SceneData | null = null

/** Lays out the scenery once, from a fixed seed */
function scene(): SceneData {
  if (cached) return cached
  const rand = mulberry32(2026)
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo)
  const pick = (n: number) => Math.floor(rand() * n)

  const towers: SceneData['towers'] = []
  for (let x = -6; x < 760; ) {
    const w = between(26, 50)
    towers.push({ x, w, h: between(70, 160), tone: pick(3), antenna: rand() < 0.25 })
    x += w + between(2, 8)
  }
  const shops: Box[] = []
  for (let x = 762; x < 1040; ) {
    const w = between(20, 28)
    shops.push({ x, w, h: between(30, 42), tone: pick(5) })
    x += w
  }
  const blocks: SceneData['blocks'] = []
  for (let x = 1052; x < 1400; ) {
    const w = between(72, 108)
    const h = between(64, 96)
    const tone = pick(2)
    const laundry = Array.from({ length: 5 }, () => ({
      x: x + 6 + Math.floor(rand() * ((w - 16) / 10)) * 10,
      y: GROUND - h + 10 + Math.floor(rand() * ((h - 30) / 10)) * 10 + 7,
      tone: pick(4),
    }))
    blocks.push({ x, w, h, tone, laundry })
    x += w + between(16, 30)
  }
  const trees: SceneData['trees'] = []
  for (let x = 1426; x < LAND_END - 24; ) {
    if (x < 1606 || x > 1672) trees.push({ x, h: between(14, 30), r: between(9, 15), tone: pick(2) })
    x += between(16, 30)
  }
  const pillars: number[] = []
  for (let x = 20; x < LAND_END; x += 72) pillars.push(x)
  const skyline: Box[] = []
  for (let x = 0; x < 520; ) {
    const w = between(18, 40)
    skyline.push({ x, w, h: between(40, 110), tone: 0 })
    x += w + between(4, 18)
  }
  const clouds = Array.from({ length: 7 }, (_, i) => ({ x: 60 + i * 175 + between(-30, 30), y: between(26, 70), w: between(22, 40) }))
  cached = { towers, shops, blocks, trees, pillars, skyline, clouds }
  return cached
}
