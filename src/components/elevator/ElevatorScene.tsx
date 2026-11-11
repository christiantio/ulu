import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react'
import {
  ARRIVAL_LINES,
  DOORS_MS,
  GROUND_FLOOR,
  MISS_MS,
  SETTLE_MS,
  SKIP_GRACE_MS,
  TRAVEL_MS,
  UPGRADE_MS,
  floorsFor,
  floorsLabel,
  formatFloor,
  indicatorFloor,
  rideMs,
  rise,
  scrollOffset,
  stageFor,
  upgradeFor,
  type Stage,
  type StageId,
} from '../../game/elevator'
import { MAX_SCORE, TIER_INFO } from '../../game/scoring'
import type { RoundResult, Tier } from '../../game/types'
import { KeyHint } from '../KeyHint'
import { Ambient } from './Ambient'
import { BoyMascot, type BoyMood } from './BoyMascot'
import { backdropFor, loadBackdrops, onBackdrops, type LayerArt } from './backdrops'
import { CAR, DOOR, LANDINGS_ABOVE, PITCH, carBack, carFront, door, landings, pavement } from './car'
import { paint } from './paint'

/*
 * The lift, the boy in it and the view outside: the picture every screen is built around.
 *
 * At rest it shows where the game stands. Given a `ride`, it plays that answer out: the doors close, the lift
 * climbs the answer's floors with the scenery sinking past, and the doors open on the result. If the answer
 * unlocks a new lift, that lift sweeps in before the doors open.
 *
 * Everything is in scene units of --u CSS pixels, anchored on the car's floor at the bottom centre, so a bigger
 * box shows more sky and more neighbourhood, not a bigger boy.
 */

/** Above this speed (floors per ms), the speed lines are fully drawn */
const STREAK_SPEED = 0.0045

type Step = 'idle' | 'closing' | 'rising' | 'landed' | 'upgrading' | 'arrived' | 'stuck'

const ARRIVAL_MOOD: Record<Tier, BoyMood> = { common: 'low', trap: 'low', solid: 'mid', rare: 'mid', ulu: 'high', gem: 'gem' }

interface Props {
  /** Where the game stands, with the lift at rest: see liftAfter() */
  score: number
  floor: number
  climbed: number
  /** An answer to play out from there. Its points and floors aren't in the props above until the ride is done */
  ride?: RoundResult | null
  /** Called once, when the ride is over or the player skips it */
  onRideDone?: () => void
  /** How the picture is framed: the home screen's hero, the strip above a question, or the results */
  size?: 'hero' | 'play' | 'finale'
  /** Confetti for a score worth celebrating */
  celebrate?: boolean
  /** Laid over the picture, and read by screen readers: the picture itself is hidden from them */
  children?: ReactNode
}

export function ElevatorScene({
  score,
  floor,
  climbed,
  ride = null,
  onRideDone,
  size = 'play',
  celebrate = false,
  children,
}: Props) {
  const tier = ride?.tier ?? null
  const floors = floorsFor(tier)
  const stage = stageFor(score)
  const upgrade = ride ? upgradeFor(score, ride.points) : null

  // The ride's progress. It belongs to one ride: for any other, the lift is at the start
  const [progress, setProgress] = useState<{ ride: RoundResult | null; step: Step; lit: number }>({
    ride: null,
    step: 'idle',
    lit: floor,
  })
  const live = ride !== null && progress.ride === ride ? progress : null
  const step: Step = ride ? (live?.step ?? (tier ? 'closing' : 'stuck')) : 'idle'
  const lit = live?.lit ?? floor

  const back = useRef<StageHandle>(null)
  const streaks = useRef<HTMLDivElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const startedAt = useRef(0)
  const finished = useRef(false)
  const done = useRef(onRideDone)
  useEffect(() => {
    done.current = onRideDone
  })

  const finish = () => {
    if (finished.current) return
    finished.current = true
    done.current?.()
  }
  const skip = () => {
    if (performance.now() - startedAt.current >= SKIP_GRACE_MS) finish()
  }

  // A layout effect, so a finished ride's last frame can't land after the scenery has been redrawn for the new floor
  useLayoutEffect(() => {
    if (!ride) return
    const start = performance.now()
    startedAt.current = start
    finished.current = false
    skipRef.current?.focus()
    const to = (next: Step) => setProgress((p) => (p.ride === ride ? { ...p, step: next } : p))
    // The next lift's scenery should be here long before it's needed; this is for the game that began offline
    if (upgrade) void loadBackdrops()
    setProgress({ ride, step: tier ? 'closing' : 'stuck', lit: floor })

    if (!tier) {
      const timer = window.setTimeout(finish, MISS_MS)
      return () => window.clearTimeout(timer)
    }

    const travel = TRAVEL_MS[tier]
    const landed = DOORS_MS + travel
    let request = 0
    let shown = floor
    let last = { up: 0, at: start }

    // Continuous motion goes straight to the DOM; React only hears about it when the indicator changes
    const paintFrame = (now: number) => {
      const elapsed = Math.min(now - start - DOORS_MS, travel)
      const up = rise(tier, elapsed)
      back.current?.scroll(up)
      const speed = now > last.at ? (up - last.up) / (now - last.at) : 0
      if (streaks.current) streaks.current.style.opacity = String(Math.min(Math.max(speed / STREAK_SPEED, 0), 1))
      last = { up, at: now }
      const reading = indicatorFloor(floor, up)
      if (reading !== shown) {
        shown = reading
        setProgress((p) => (p.ride === ride ? { ...p, lit: reading } : p))
      }
      return elapsed < travel
    }
    const loop = (now: number) => {
      if (paintFrame(now)) request = requestAnimationFrame(loop)
    }
    request = requestAnimationFrame(loop)

    const timers = [
      window.setTimeout(() => to('rising'), DOORS_MS),
      window.setTimeout(() => {
        // Lands the lift even if frames were throttled, as in a background tab
        paintFrame(start + landed)
        if (streaks.current) streaks.current.style.opacity = '0'
        to('landed')
      }, landed),
      window.setTimeout(() => to(upgrade ? 'upgrading' : 'arrived'), landed + SETTLE_MS),
      window.setTimeout(finish, rideMs(tier, upgrade !== null)),
    ]
    if (upgrade) timers.push(window.setTimeout(() => to('arrived'), landed + SETTLE_MS + UPGRADE_MS))
    return () => {
      cancelAnimationFrame(request)
      timers.forEach((id) => window.clearTimeout(id))
    }
    // One run per ride. The floor and score it starts from don't change while it plays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride])

  // Escape skips too, wherever the focus has got to
  useEffect(() => {
    if (!ride) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // skip() only reads refs, so the one from the ride's first render does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride])

  const arrived = step === 'arrived'
  // The new lift is there from the moment it starts to sweep in
  const incoming = upgrade && (step === 'upgrading' || arrived) ? upgrade : null
  const open = step === 'idle' || arrived
  const moving = step === 'closing' || step === 'rising'
  const perfectAfter = (ride ? score + ride.points : score) >= MAX_SCORE
  // The top of a perfect game isn't a number
  const reading = (after: boolean) => {
    if (after || arrived) return perfectAfter ? 'PH' : formatFloor(floor + floors)
    return score >= MAX_SCORE ? 'PH' : formatFloor(lit)
  }

  const mood: BoyMood =
    step === 'stuck'
      ? 'miss'
      : step === 'upgrading'
        ? 'look'
        : arrived && tier
          ? perfectAfter
            ? 'calm'
            : ARRIVAL_MOOD[tier]
          : step === 'rising' || step === 'landed'
            ? 'ride'
            : 'idle'

  const caption =
    step === 'closing'
      ? 'Doors closing…'
      : step === 'rising'
        ? 'Going up…'
        : step === 'landed'
          ? 'Ding.'
          : step === 'upgrading'
            ? 'Wait. This is not the same lift…'
            : ARRIVAL_LINES[tier ?? 'miss']

  return (
    <div className={`lift lift--${size} ${ride ? 'lift--riding' : ''}`}>
      <div
        className={`scene scene--${step} ${open ? 'scene--open' : ''}`}
        style={{ '--doors-ms': `${DOORS_MS}ms`, '--miss-ms': `${MISS_MS}ms`, '--upgrade-ms': `${UPGRADE_MS}ms` } as CSSProperties}
        onClick={ride ? skip : undefined}
        aria-hidden="true"
        // What the picture is showing, for tests and for poking at it in dev tools
        data-lift={(incoming ?? stage).id}
        data-floor={reading(false)}
      >
        <StageBack key={`back-${stage.id}`} ref={back} stage={stage.id} floor={floor} climbed={climbed} />
        {incoming && <StageBack key={`back-${incoming.id}`} stage={incoming.id} floor={floor + floors} climbed={0} incoming />}
        <div className="scene__boy scene__car">
          <BoyMascot mood={mood} />
        </div>
        <StageFront key={`front-${stage.id}`} stage={stage.id} text={reading(false)} moving={moving} />
        {incoming && <StageFront key={`front-${incoming.id}`} stage={incoming.id} text={reading(true)} moving={false} incoming />}

        <div className="scene__streaks" ref={streaks}>
          {[9, 24, 41, 59, 76, 91].map((x, i) => (
            <i key={x} style={{ '--x': `${x}%`, '--d': `${-i * 0.11}s` } as CSSProperties} />
          ))}
        </div>
        {step === 'upgrading' && <div className="scene__sweep" />}
        {incoming && <NewLift stage={incoming} />}
        {(arrived || step === 'stuck') && ride && <Arrival result={ride} />}
        {celebrate && !ride && <Confetti count={44} loop />}
      </div>

      {children}

      {ride && (
        <div className="lift__bar">
          <p key={caption} className="lift__caption" aria-hidden="true">
            {caption}
          </p>
          <button ref={skipRef} type="button" className="btn btn--ghost btn--small" onClick={skip} aria-label="Skip to the result">
            Skip ›
            <KeyHint>Esc</KeyHint>
          </button>
        </div>
      )}
    </div>
  )
}

/** One layer of the picture: a box of pixel art in scene units, placed from the car's floor */
function Layer({
  x = -200,
  w = 400,
  top,
  bottom,
  className = '',
  ref,
  children,
}: {
  x?: number
  w?: number
  top: number
  bottom: number
  className?: string
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}) {
  return (
    <div
      ref={ref}
      className={`scene__layer ${className}`}
      style={{ '--x': x, '--w': w, '--h': bottom - top, '--b': bottom } as CSSProperties}
    >
      <svg viewBox={`${x} ${top} ${w} ${bottom - top}`} shapeRendering="crispEdges" focusable="false">
        {children}
      </svg>
    </div>
  )
}

/** Moves a layer down by `units` scene units, on the compositor */
function shift(layer: HTMLElement | null, units: number) {
  if (layer) layer.style.transform = units ? `translate3d(0, calc(var(--u) * ${Math.round(units * 100) / 100}), 0)` : ''
}

interface StageHandle {
  /** Draw the scenery as it looks `up` floors above the floor the stage was given */
  scroll: (up: number) => void
}

interface BackProps {
  stage: StageId
  /** The floor the car is level with */
  floor: number
  /** Floors climbed since this lift was unlocked: how far its view has sunk */
  climbed: number
  /** Sweeping in over the last lift */
  incoming?: boolean
  ref?: Ref<StageHandle>
}

const PAVEMENT = paint(pavement)
/** The landings go by a whole floor for every floor climbed */
const LANDINGS = { rate: PITCH }

/** Everything behind the boy: the sky, the view, the rails with their landings, and the inside of the car */
const StageBack = memo(function StageBack({ stage, floor, climbed, incoming = false, ref }: BackProps) {
  // The later lifts' scenery is a chunk of its own. Until it arrives, the lift stands in front of its sky
  const backdrop = useSyncExternalStore(onBackdrops, () => backdropFor(stage))
  useEffect(() => {
    if (!backdrop) void loadBackdrops()
  }, [backdrop])
  const far = useRef<HTMLDivElement>(null)
  const mid = useRef<HTMLDivElement>(null)
  const near = useRef<HTMLDivElement>(null)
  const ground = useRef<HTMLDivElement>(null)

  const scroll = useCallback(
    (up: number) => {
      if (backdrop) {
        shift(far.current, scrollOffset(backdrop.far, climbed + up))
        shift(mid.current, scrollOffset(backdrop.mid, climbed + up))
      }
      shift(near.current, scrollOffset(LANDINGS, up))
      shift(ground.current, scrollOffset(LANDINGS, up))
    },
    [backdrop, climbed],
  )
  useImperativeHandle(ref, () => ({ scroll }), [scroll])
  // Back to rest whenever the stage is drawn for a new floor
  useLayoutEffect(() => scroll(0), [scroll, floor])

  const plates = useMemo(() => paint((b) => landings(b, stage, floor)), [stage, floor])
  const inside = useMemo(() => paint((b) => carBack(b, stage)), [stage])
  const box = ({ top, bottom }: LayerArt) => ({ top, bottom })

  return (
    <div className={`stage stage--${stage} ${incoming ? 'stage--incoming' : ''}`}>
      {backdrop && (
        <Layer ref={far} {...box(backdrop.far)}>
          {backdrop.far.art}
        </Layer>
      )}
      <Ambient stage={stage} />
      {backdrop && (
        <Layer ref={mid} {...box(backdrop.mid)}>
          {backdrop.mid.art}
        </Layer>
      )}
      <div className="scene__rail scene__rail--l" />
      <div className="scene__rail scene__rail--r" />
      <Layer ref={near} x={-70} w={140} top={-(LANDINGS_ABOVE * PITCH) - 30} bottom={12}>
        {plates}
      </Layer>
      {stage === 'hdb' && floor === GROUND_FLOOR && (
        <Layer ref={ground} top={4} bottom={50}>
          {PAVEMENT}
        </Layer>
      )}
      <div className="scene__cables scene__car" />
      <Layer className="scene__car" x={CAR.x} w={CAR.w} top={CAR.top} bottom={CAR.bottom}>
        {inside}
      </Layer>
    </div>
  )
})

interface FrontProps {
  stage: StageId
  /** What the indicator reads */
  text: string
  /** The up arrow is lit */
  moving: boolean
  incoming?: boolean
}

/** Everything in front of the boy: the doors, and the frame around them with the floor indicator */
const StageFront = memo(function StageFront({ stage, text, moving, incoming = false }: FrontProps) {
  const frame = useMemo(() => paint((b) => carFront(b, stage, text, moving)), [stage, text, moving])
  const leaf = useMemo(() => paint((b) => door(b, stage)), [stage])
  return (
    <div className={`stage-front stage-front--${stage} ${incoming ? 'stage-front--incoming' : ''}`}>
      <div className="scene__doors scene__car">
        {(['l', 'r'] as const).map((side) => (
          <div key={side} className={`door door--${side}`}>
            <svg viewBox={`0 0 ${DOOR.w} ${DOOR.h}`} shapeRendering="crispEdges" focusable="false">
              {leaf}
            </svg>
          </div>
        ))}
      </div>
      <Layer className="scene__car" x={CAR.x} w={CAR.w} top={CAR.top} bottom={CAR.bottom}>
        {frame}
      </Layer>
    </div>
  )
})

/** The plaque for a newly unlocked lift */
function NewLift({ stage }: { stage: Stage }) {
  return (
    <div className="newlift">
      <span className="newlift__label">New lift unlocked</span>
      <span className="newlift__name">{stage.name}</span>
    </div>
  )
}

const CONFETTI: Partial<Record<Tier, number>> = { solid: 12, rare: 20, ulu: 32, gem: 46 }

/** When the doors open: how rare the answer was and what it earned, with a flourish to match */
function Arrival({ result }: { result: RoundResult }) {
  const { tier, points } = result
  return (
    <>
      {(tier === 'ulu' || tier === 'gem') && <div className="scene__flash" />}
      {tier && CONFETTI[tier] && <Confetti count={CONFETTI[tier]} />}
      <div className={`stamp ${tier ? `tier--${tier}` : 'stamp--miss'}`}>
        <span className="stamp__label">{tier ? TIER_INFO[tier].label : 'Time up!'}</span>
        <span className="stamp__floors">{tier ? `▲ ${floorsLabel(floorsFor(tier))}` : 'Staying put'}</span>
        <span className="stamp__points">+{points}</span>
      </div>
    </>
  )
}

const CONFETTI_COLOURS = ['#ff7699', '#f8c76b', '#69b5ae', '#f1e5d0', '#6fa8ff', '#b98cff']

/** Square confetti: a burst from the top of the picture, or a steady fall for the results */
function Confetti({ count, loop = false }: { count: number; loop?: boolean }) {
  // Random per burst, and kept for as long as it's on screen
  const [pieces] = useState(() =>
    Array.from({ length: count }, () => {
      const angle = (-165 + Math.random() * 150) * (Math.PI / 180)
      const distance = 14 + Math.random() * 34
      return {
        '--x': `${Math.round(Math.random() * 100)}%`,
        '--dx': (Math.cos(angle) * distance).toFixed(1),
        '--dy': (Math.sin(angle) * distance * 0.7).toFixed(1),
        '--fall': (40 + Math.random() * 50).toFixed(1),
        '--delay': `${Math.round(Math.random() * (loop ? 4000 : 140))}ms`,
        '--dur': `${Math.round(loop ? 2600 + Math.random() * 2200 : 1000 + Math.random() * 500)}ms`,
        '--c': CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
      } as CSSProperties
    }),
  )
  return (
    <div className={`confetti ${loop ? 'confetti--fall' : ''}`}>
      {pieces.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  )
}
