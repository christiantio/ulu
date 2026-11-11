import { mulberry32 } from '../../game/daily'
import { TOP_FLOOR, formatFloor, type StageId } from '../../game/elevator'
import { blob, label, line, ring, sevenSegment, taper, type Brush } from './paint'

/*
 * The lift itself, drawn for each stage: the inside of the car, the frame and floor indicator around its doorway,
 * a door, and the rails it runs on. Scene units, with x = 0 down the middle of the car and y = 0 at its floor.
 *
 * The car is 80 wide. Its doorway runs from x = -32 to 32 and is 76 high; the header above holds the indicator.
 */

/** The distance between floors, in scene units: a little more than the car is tall */
export const PITCH = 120
/** The car's box, with room for the hitch above and the sill below */
export const CAR = { x: -44, w: 88, top: -100, bottom: 8 }
/** The doorway, which the doors slide across */
export const DOORWAY = { x: -32, w: 64, top: -76, h: 76 }
/** One door: half the doorway */
export const DOOR = { w: 32, h: 76 }

interface Look {
  frame: string
  frameHi: string
  frameLo: string
  trim: string
  wall: string
  wallHi: string
  wallLo: string
  floor: string
  floorLo: string
  bar: string
  barHi: string
  /** The indicator: its window, lit segments and unlit ones */
  screen: string
  lit: string
  ghost: string
  door: string
  doorHi: string
  doorLo: string
  glass: string
  /** The hole in a door for its window: x, y, width, height, with the doors' meeting edge at x = 32 */
  pane: [number, number, number, number]
  rail: string
  railHi: string
  sign: string
  signInk: string
  /** The plate by the indicator */
  plate: string
  plateInk: string
  plateText: string
}

const GOLD = '#d9b25f'

export const LOOKS: Record<StageId, Look> = {
  hdb: {
    frame: '#cdbb99', frameHi: '#e4d6b8', frameLo: '#a8966f', trim: '#6f6654',
    wall: '#dccaa8', wallHi: '#eadcbd', wallLo: '#bda982', floor: '#8a938a', floorLo: '#737c74',
    bar: '#9aa6a3', barHi: '#cdd6d2', screen: '#1c1512', lit: '#ff4a3d', ghost: '#2e0f0b',
    door: '#b9b29d', doorHi: '#d0cab7', doorLo: '#968f7a', glass: '#a9d6da44', pane: [15, 12, 13, 34],
    rail: '#7f8f8a', railHi: '#aebcb6', sign: '#f7f3e8', signInk: '#1f5f5a',
    plate: '#2f5f9a', plateInk: '#f7f3e8', plateText: 'A',
  },
  upgraded: {
    frame: '#c3ccd1', frameHi: '#e6ecee', frameLo: '#95a1a8', trim: '#56626a',
    wall: '#d5dde1', wallHi: '#edf2f3', wallLo: '#b4c0c6', floor: '#70808b', floorLo: '#5f6e78',
    bar: '#aab6bd', barHi: '#e6ecee', screen: '#17130c', lit: '#ffb22e', ghost: '#2a1d08',
    door: '#ccd5d9', doorHi: '#e6ecee', doorLo: '#a3afb6', glass: '#b9e3ef44', pane: [11, 9, 17, 44],
    rail: '#aab6bd', railHi: '#dfe6e9', sign: '#2f8f88', signInk: '#f7f3e8',
    plate: '#2f8f88', plateInk: '#f7f3e8', plateText: 'B',
  },
  condo: {
    frame: '#5d4632', frameHi: '#84674a', frameLo: '#3f2e20', trim: '#2a1f16',
    wall: '#eadfc8', wallHi: '#f6eedc', wallLo: '#cfc2a6', floor: '#5a4a3c', floorLo: '#77665a',
    bar: GOLD, barHi: '#f0d695', screen: '#1a1410', lit: '#fff1cf', ghost: '#2b241a',
    door: '#7d5a3d', doorHi: '#9a7350', doorLo: '#5f4229', glass: '#ffe9c433', pane: [17, 8, 10, 52],
    rail: '#6b5138', railHi: '#b08d5f', sign: '#3a2c20', signInk: '#e7c77a',
    plate: '#3a2c20', plateInk: '#e7c77a', plateText: 'T1',
  },
  cbd: {
    frame: '#39424e', frameHi: '#5a6777', frameLo: '#252c36', trim: '#161b22',
    wall: '#465160', wallHi: '#5f6c7d', wallLo: '#343d49', floor: '#2c3440', floorLo: '#3f4a59',
    bar: '#cfd8e0', barHi: '#ffffff', screen: '#0c1118', lit: '#7fe3ff', ghost: '#10232b',
    door: '#39424e', doorHi: '#5a6777', doorLo: '#252c36', glass: '#9fd0ff2b', pane: [4, 4, 25, 66],
    rail: '#dfe7ee', railHi: '#ffffff', sign: '#1d2733', signInk: '#7fe3ff',
    plate: '#0c1118', plateInk: '#7fe3ff', plateText: 'L8',
  },
  marina: {
    frame: '#c9a24f', frameHi: '#efd48f', frameLo: '#96742f', trim: '#5a4320',
    wall: '#efe9df', wallHi: '#fbf8f1', wallLo: '#cfc6b8', floor: '#3a3340', floorLo: '#564d5e',
    bar: GOLD, barHi: '#f6e1a6', screen: '#1d140a', lit: '#ffd36b', ghost: '#2e220b',
    door: '#c9a24f', doorHi: '#efd48f', doorLo: '#96742f', glass: '#b9c8ff26', pane: [5, 6, 23, 60],
    rail: '#c9a24f', railHi: '#efd48f', sign: '#1b1d3a', signInk: '#ffd36b',
    plate: '#1d140a', plateInk: '#ffd36b', plateText: 'MB',
  },
  penthouse: {
    frame: '#f3ead2', frameHi: '#fffaf0', frameLo: '#cdbf9c', trim: '#a8842f',
    wall: '#fbf5e6', wallHi: '#ffffff', wallLo: '#e2d6b8', floor: '#9c2740', floorLo: '#7d1c32',
    bar: GOLD, barHi: '#f6e1a6', screen: '#16132e', lit: '#fff7dd', ghost: '#262245',
    door: '#f3ead2', doorHi: '#fffaf0', doorLo: '#cdbf9c', glass: '#ffe9c41f', pane: [4, 4, 25, 68],
    rail: '#e7c77a', railHi: '#fff3cf', sign: '#fbf5e6', signInk: '#a8842f',
    plate: '#16132e', plateInk: '#f6e1a6', plateText: 'PH',
  },
}

/** The house rule he's breaking: a no-bubblegum sign, in every lift */
function noGum(b: Brush, x: number, y: number, paper: string, edge: string) {
  b(edge, x - 1, y - 1, 11, 14)
  b(paper, x, y, 9, 12)
  ring(b, '#d93a3a', x + 4, y + 4, 3)
  b('#ff7699', x + 3, y + 3, 3, 3)
  line(b, '#d93a3a', x + 2, y + 2, x + 6, y + 6)
  b('#8a8474', x + 1, y + 9, 7, 1)
  b('#8a8474', x + 2, y + 10, 5, 1)
}

function buttons(b: Brush, x: number, y: number, rows: number, plate: string, edge: string, button: string, lit: string, litRow: number) {
  const h = rows * 4 + 12
  b(edge, x - 1, y - 1, 11, h + 2)
  b(plate, x, y, 9, h)
  b('#16130f', x + 1, y + 1, 7, 4)
  b(lit, x + 2, y + 2, 2, 2)
  b(lit, x + 5, y + 2, 1, 2)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) b(r === litRow && c === 1 ? lit : button, x + 1 + c * 4, y + 7 + r * 4, 3, 3)
  }
  b('#d93a3a', x + 1, y + 8 + rows * 4, 3, 3)
  b(edge, x + 6, y + 9 + rows * 4, 1, 2)
}

/** A purple orchid in a vase, for the lifts that have somewhere to put one */
function orchid(b: Brush, x: number, y: number) {
  b('#fbf5e6', x, y - 5, 4, 5)
  b('#cdbf9c', x + 3, y - 5, 1, 5)
  line(b, '#4f8f5a', x + 2, y - 5, x + 3, y - 13)
  line(b, '#4f8f5a', x + 1, y - 6, x - 1, y - 9)
  for (const [dx, dy] of [[3, -14], [1, -12], [4, -10]]) {
    b('#b56bd9', x + dx - 1, y + dy, 3, 2)
    b('#f3c9ff', x + dx, y + dy, 1, 1)
  }
}

/** The inside of the car: its back wall, floor and fittings. The boy stands in front of this, behind the doors */
export function carBack(b: Brush, stage: StageId) {
  const k = LOOKS[stage]
  const rand = mulberry32(90)
  const { x, w, top, h } = DOORWAY
  const glassBack = stage === 'cbd' || stage === 'marina' || stage === 'penthouse'

  if (!glassBack) b(k.wall, x, top, w, h)

  if (stage === 'hdb') {
    // Three beige panels that have seen a lot of bicycles
    for (const seam of [-11, 10]) {
      b(k.wallLo, seam, top, 1, h)
      b(k.wallHi, seam + 1, top, 1, h)
    }
    for (let i = 0; i < 30; i++) {
      b(i % 2 ? k.wallHi : '#cdbb97', x + 1 + Math.floor(rand() * 56), top + 8 + Math.floor(rand() * 56), 3 + Math.floor(rand() * 5), 1)
    }
    line(b, '#f3e8cf', -27, -23, -22, -18)
    line(b, '#b39f77', 15, -17, 18, -13)
    line(b, '#b39f77', -4, -50, -1, -52)
    b('#c3b089', -7, -9, 11, 2)
    b('#eef3e6', -22, top, 44, 1)
    b('#fbfff4', -20, top + 1, 40, 2)
    b('#f4f7e455', x, top + 3, w, 9)
    noGum(b, -28, -63, '#f7f3e8', '#b9ae95')
    // A notice from the town council, slightly crooked
    b('#f7f3e8', -29, -46, 11, 8)
    b('#2f8f88', -29, -46, 11, 2)
    b('#8a8474', -27, -42, 7, 1)
    b('#8a8474', -27, -40, 5, 1)
    buttons(b, 19, -62, 5, '#8f9b9a', '#6f7a79', '#efe6cf', '#f8c76b', 1)
  } else if (stage === 'upgraded') {
    // New stainless steel, with a strip of the town's colour
    for (const seam of [-11, 10]) b(k.wallLo, seam, top, 1, h)
    b('#bcc8ce', x, -27, w, 27)
    b('#69b5ae', x, -29, w, 2)
    for (let i = 0; i < 14; i++) b(k.wallHi, x + 2 + Math.floor(rand() * 54), top + 8 + Math.floor(rand() * 38), 6, 1)
    b('#ffffff', -26, top, 52, 2)
    b('#ffffff66', x, top + 2, w, 10)
    // The town council's notice screen, and the same old rule under it
    b('#56626a', -30, -67, 14, 11)
    b('#1d3a5f', -29, -66, 12, 9)
    b('#7fd0ff', -28, -64, 8, 1)
    b('#4f8fc9', -28, -62, 10, 1)
    b('#4f8fc9', -28, -60, 6, 1)
    noGum(b, -28, -52, '#ffffff', '#95a1a8')
    b('#39424e', 25, top, 5, 2)
    b('#7fe3ff', 27, top + 2, 1, 1)
    buttons(b, 19, -64, 6, '#aab6bd', '#7f8c94', '#f1f5f6', '#7fd0ff', 2)
  } else if (stage === 'condo') {
    // Polished stone above a walnut dado
    for (let i = 0; i < 8; i++) line(b, k.wallHi, x + 4 + i * 8, top + 4, x + 10 + i * 8, top + 32)
    b('#a87447', x, -40, w, 40)
    for (let gx = x; gx < x + w; gx += 3) b(rand() < 0.5 ? '#96643a' : '#b98352', gx, -40, 1, 40)
    for (const seam of [-11, 10]) b('#7d5230', seam, -40, 1, 40)
    b(GOLD, x, -42, w, 2)
    b('#f0d695', x, -42, w, 1)
    // Two downlights
    for (const lx of [-15, 15]) {
      b('#fff1cf', lx - 2, top, 5, 1)
      taper(b, '#fff1cf26', lx + 0.5, top + 1, 5, 25, 36)
    }
    b('#3a2c20', -29, -64, 11, 14)
    noGum(b, -28, -63, '#e7c77a', '#3a2c20')
    buttons(b, 19, -66, 6, GOLD, '#96742f', '#3a2c20', '#fff1cf', 1)
  } else if (stage === 'cbd') {
    // Graphite, a strip of blue light, and a window on the city
    for (const px of [x, 22]) {
      b(k.wall, px, top, 10, h)
      b(k.wallHi, px, top, 1, h)
      b(k.wallLo, px + 9, top, 1, h)
    }
    b(k.glass, -22, top + 5, 44, 60)
    line(b, '#ffffff3a', -18, -24, 2, -66, 2)
    line(b, '#ffffff26', -6, -16, 16, -62)
    b(k.wallLo, -22, top, 44, 5)
    b('#eaf6ff', -16, top + 1, 32, 1)
    b(k.wall, -22, -11, 44, 11)
    b('#59c7ff', -22, -12, 44, 1)
    b('#59c7ff55', -22, -11, 44, 2)
    noGum(b, -31, -60, '#dfe7ee', '#161b22')
    // A touch panel
    b('#161b22', 23, -62, 8, 30)
    for (let r = 0; r < 6; r++) {
      b(r === 1 ? '#7fe3ff' : '#2f5f73', 25, -58 + r * 4, 1, 1)
      b('#2f5f73', 28, -58 + r * 4, 1, 1)
    }
    b('#7fe3ff', 24, -61, 6, 1)
  } else if (stage === 'marina') {
    // Marble and brushed gold, with the bay behind glass
    for (const px of [x, 22]) {
      b(k.wall, px, top, 10, h)
      line(b, k.wallLo, px + 2, top + 10, px + 7, top + 30)
      line(b, k.wallLo, px + 7, top + 34, px + 3, top + 58)
      b(GOLD, px === x ? px + 9 : px, top, 1, h)
    }
    b(k.glass, -22, top + 2, 44, 52)
    line(b, '#ffffff30', -18, -28, 0, -70, 2)
    line(b, '#ffffff1f', -4, -26, 18, -66)
    b(k.wall, -22, -22, 44, 22)
    line(b, k.wallLo, -18, -18, -6, -6)
    line(b, k.wallLo, 4, -20, 16, -8)
    b(GOLD, -22, -23, 44, 1)
    for (const dx of [-11, 11]) {
      for (let i = 0; i < 4; i++) b(GOLD, dx - i, -14 + i, i * 2 + 1, 1)
      for (let i = 0; i < 3; i++) b(GOLD, dx - 2 + i, -10 + i, 5 - i * 2, 1)
    }
    b('#ffdf9e', x, top, w, 2)
    b('#ffdf9e33', x, top + 2, w, 9)
    noGum(b, -31, -58, '#fbf8f1', GOLD)
    buttons(b, 23, -64, 6, GOLD, '#96742f', '#fbf8f1', '#ffd36b', 3)
    orchid(b, -31, -4)
  } else {
    // Glass on every side, gold wherever there's room, and a chandelier
    for (const px of [x, 27]) {
      b(k.wall, px, top, 5, h)
      b(GOLD, px === x ? px + 4 : px, top, 1, h)
    }
    b(k.glass, -27, top, 54, 64)
    line(b, '#ffffff2e', -22, -22, -2, -70, 2)
    line(b, '#ffffff1c', -2, -18, 22, -66)
    // A stepped sunburst in each top corner
    for (let i = 0; i < 6; i++) {
      b(GOLD, -27, top + i * 2, (6 - i) * 2, 2)
      b(GOLD, 27 - (6 - i) * 2, top + i * 2, (6 - i) * 2, 2)
      b('#f6e1a6', -27, top + i * 2, (6 - i) * 2, 1)
      b('#f6e1a6', 27 - (6 - i) * 2, top + i * 2, (6 - i) * 2, 1)
    }
    b(GOLD, -1, top, 2, 6)
    b(GOLD, -7, top + 6, 14, 1)
    for (let c = 0; c < 5; c++) {
      b('#fff7dd', -7 + c * 3, top + 7, 2, 2 + (c % 2))
      b('#ffe9a8', -7 + c * 3, top + 9 + (c % 2), 1, 1)
    }
    blob(b, '#fff3cf22', 0, top + 9, 13, 8)
    // A balustrade, so nobody leans on the view
    b(k.wall, -27, -13, 54, 13)
    b(GOLD, -27, -14, 54, 1)
    for (let px = -24; px < 26; px += 6) b(k.wallLo, px, -11, 3, 8)
    noGum(b, -32, -50, '#fffaf0', GOLD)
    // The only button this lift needs
    b('#96742f', 27, -44, 6, 14)
    b(GOLD, 28, -43, 4, 12)
    b('#fff7dd', 29, -40, 2, 2)
    b('#16132e', 29, -35, 2, 2)
    orchid(b, 28, -4)
  }

  // Handrail
  if (stage !== 'penthouse') {
    const inset = glassBack ? 10 : 0
    b(k.bar, x + inset, -29, w - inset * 2, 2)
    b(k.barHi, x + inset, -29, w - inset * 2, 1)
    if (!glassBack) for (const px of [-22, 20]) b(k.wallLo, px, -27, 2, 2)
  }
  // Floor
  if (stage === 'hdb' || stage === 'upgraded') b(k.wallLo, x, -9, w, 5)
  b(k.floor, x, -4, w, 4)
  if (stage === 'penthouse') {
    b(GOLD, x, -4, w, 1)
  } else if (stage === 'marina' || stage === 'condo') {
    for (let i = 0; i < 9; i++) b(k.floorLo, x + 2 + Math.floor(rand() * 58), -3 + (i % 3), 4, 1)
    if (stage === 'marina') b(GOLD, x, -4, w, 1)
  } else {
    for (let i = 0; i < 24; i++) b(k.floorLo, x + 1 + Math.floor(rand() * 62), -4 + Math.floor(rand() * 4), 1, 1)
  }
}

/** The frame around the doorway, the indicator above it, and the sill below */
export function carFront(b: Brush, stage: StageId, text: string, moving: boolean) {
  const k = LOOKS[stage]
  // Hitch and roof
  b(k.trim, -8, -100, 16, 4)
  b(k.frameLo, -6, -100, 12, 1)
  b(k.trim, -42, -97, 84, 3)
  // Header
  b(k.frame, -40, -94, 80, 18)
  b(k.frameHi, -40, -94, 80, 1)
  b(k.frameLo, -40, -77, 80, 1)
  // Jambs
  b(k.frame, -40, -76, 8, 76)
  b(k.frame, 32, -76, 8, 76)
  b(k.frameHi, -40, -94, 1, 94)
  b(k.frameLo, 39, -94, 1, 94)
  b(k.frameLo, -33, -76, 1, 76)
  b(k.frameLo, 32, -76, 1, 76)
  // Sill
  b(k.trim, -42, 0, 84, 1)
  b(k.frameHi, -42, 1, 84, 2)
  for (let gx = -40; gx < 42; gx += 4) b(k.frameLo, gx, 1, 1, 2)
  b(k.trim, -40, 3, 80, 2)

  if (stage === 'hdb') {
    // Hazard tape along the sill, and the scuffs of a long life
    for (let hx = -40; hx < 40; hx += 4) b((hx / 4) % 2 ? '#2f2f2f' : '#f2c230', hx, 3, 4, 1)
    line(b, k.frameLo, -38, -30, -36, -22)
    line(b, k.frameHi, 35, -48, 37, -41)
    b(k.frameLo, -37, -6, 3, 1)
  } else if (stage === 'upgraded') {
    b('#69b5ae', -40, -78, 80, 1)
  } else if (stage === 'condo') {
    b(GOLD, -40, -78, 80, 1)
    b(GOLD, -34, -76, 1, 76)
    b(GOLD, 33, -76, 1, 76)
  } else if (stage === 'cbd') {
    b('#59c7ff', -40, -78, 80, 1)
    b('#59c7ff', -34, -76, 1, 76)
    b('#59c7ff', 33, -76, 1, 76)
  } else if (stage === 'marina') {
    b('#5a4320', -40, -79, 80, 1)
    for (let dx = -36; dx < 38; dx += 6) b('#efd48f', dx, -96, 3, 1)
    b('#fbf8f1', -38, -74, 4, 72)
    b('#fbf8f1', 34, -74, 4, 72)
    line(b, '#cfc6b8', -37, -60, -35, -30)
    line(b, '#cfc6b8', 37, -50, 35, -14)
  } else {
    // A gold fan over the door
    b(GOLD, -40, -79, 80, 2)
    for (let i = 0; i < 5; i++) b(GOLD, -40 + i * 2, -97 - i, 80 - i * 4, 1)
    b(GOLD, -36, -76, 2, 76)
    b(GOLD, 34, -76, 2, 76)
    b('#f6e1a6', -36, -76, 1, 76)
    b('#f6e1a6', 34, -76, 1, 76)
  }

  // Floor indicator
  b(k.trim, -15, -93, 30, 16)
  b(k.screen, -14, -92, 28, 14)
  sevenSegment(b, text, -9, -91, k.lit, k.ghost)
  // Going up
  b(k.trim, -32, -91, 11, 12)
  b(k.screen, -31, -90, 9, 10)
  taper(b, moving ? k.lit : k.ghost, -26.5, -88, 1, 7, 4)
  b(moving ? k.lit : k.ghost, -28, -84, 3, 3)
  // The lift's plate
  const plateW = k.plateText.length * 4 + 3
  b(k.trim, 21, -90, plateW + 2, 10)
  b(k.plate, 22, -89, plateW, 8)
  label(b, k.plateInk, k.plateText, 24, -88)
}

/** The left-hand door. The right one is its mirror image */
export function door(b: Brush, stage: StageId) {
  const k = LOOKS[stage]
  const rand = mulberry32(64)
  const [px, py, pw, ph] = k.pane
  // The door, around its window
  b(k.door, 0, 0, DOOR.w, py)
  b(k.door, 0, py + ph, DOOR.w, DOOR.h - py - ph)
  b(k.door, 0, py, px, ph)
  b(k.door, px + pw, py, DOOR.w - px - pw, ph)
  b(k.doorHi, 0, 0, 1, DOOR.h)
  b(k.doorLo, DOOR.w - 2, 0, 1, DOOR.h)
  b('#26282b', DOOR.w - 1, 0, 1, DOOR.h)
  // Window: a frame, tinted glass and a glint
  b(k.doorLo, px - 1, py - 1, pw + 2, 1)
  b(k.doorLo, px - 1, py + ph, pw + 2, 1)
  b(k.doorLo, px - 1, py, 1, ph)
  b(k.doorLo, px + pw, py, 1, ph)
  b(k.glass, px, py, pw, ph)
  line(b, '#ffffff4d', px + 1, py + Math.round(ph * 0.55), px + Math.round(pw * 0.7), py + 2)
  line(b, '#ffffff2e', px + 2, py + Math.round(ph * 0.85), px + pw - 2, py + Math.round(ph * 0.35))

  if (stage === 'hdb' || stage === 'upgraded') {
    // Brushed metal, a kick plate and (in the old lift) a few souvenirs
    for (let i = 0; i < 16; i++) {
      const sx = 1 + Math.floor(rand() * (px - 2))
      b(i % 2 ? k.doorHi : k.doorLo, sx, 2 + Math.floor(rand() * 58), 1, 4 + Math.floor(rand() * 8))
    }
    b(k.doorLo, 1, 66, DOOR.w - 3, 1)
    if (stage === 'hdb') {
      line(b, k.doorHi, 4, 56, 9, 52)
      line(b, k.doorLo, 6, 24, 8, 30)
      b(k.doorLo, 20, 70, 6, 1)
    }
  } else if (stage === 'condo') {
    for (let gx = 1; gx < DOOR.w - 2; gx += 3) if (gx < px - 1 || gx > px + pw) b(rand() < 0.5 ? k.doorHi : k.doorLo, gx, 1, 1, DOOR.h - 2)
    b(GOLD, px - 2, py - 2, pw + 4, 1)
    b(GOLD, px - 2, py + ph + 1, pw + 4, 1)
    b(GOLD, px - 2, py - 2, 1, ph + 4)
    b(GOLD, px + pw + 1, py - 2, 1, ph + 4)
    b(GOLD, DOOR.w - 3, 0, 1, DOOR.h)
  } else if (stage === 'cbd') {
    b('#59c7ff', DOOR.w - 3, 0, 1, DOOR.h)
    b(k.doorHi, px, py + Math.round(ph / 2), pw, 1)
  } else if (stage === 'marina') {
    // Diamonds etched into the glass
    for (let dy = py + 10; dy < py + ph - 6; dy += 16) {
      for (let i = 0; i < 5; i++) {
        b('#efd48f88', px + 11 - i, dy + i, 1, 1)
        b('#efd48f88', px + 11 + i, dy + i, 1, 1)
        b('#efd48f88', px + 11 - i, dy + 9 - i, 1, 1)
        b('#efd48f88', px + 11 + i, dy + 9 - i, 1, 1)
      }
    }
    b(k.doorHi, 1, 1, DOOR.w - 3, 1)
    b('#5a4320', DOOR.w - 3, 0, 1, DOOR.h)
  } else {
    // A gold fan in the corner of each door, meeting in the middle
    for (let i = 0; i < 9; i++) {
      line(b, GOLD, DOOR.w - 3, py + 22, px + Math.round((pw * i) / 8), py + (i < 5 ? 0 : (i - 4) * 5))
    }
    b(GOLD, px - 1, py - 1, pw + 2, 1)
    b(GOLD, px - 1, py + ph, pw + 2, 1)
    b(GOLD, px - 1, py, 1, ph)
    b(GOLD, DOOR.w - 3, 0, 1, DOOR.h)
  }
}

/** How many floors of landings are drawn above the one the lift is on: enough to fill the view after six floors */
export const LANDINGS_ABOVE = 9

/**
 * The landings the car passes on its rails: a stub of floor either side, a sign with the floor's number, and a call
 * button. `base` is the floor drawn level with the car
 */
export function landings(b: Brush, stage: StageId, base: number) {
  const k = LOOKS[stage]
  // The rails stop at the top floor: there's nowhere above the penthouse
  for (let floor = base; floor <= Math.min(base + LANDINGS_ABOVE, TOP_FLOOR); floor++) {
    const y = -(floor - base) * PITCH
    for (const side of [-1, 1]) {
      const x = side < 0 ? -64 : 42
      b(k.rail, x, y, 22, 3)
      b(k.railHi, x, y, 22, 1)
      b(k.frameLo, x, y + 3, 22, 1)
      // A bracket under the stub, and a joint in the rail halfway up
      for (let i = 0; i < 5; i++) b(k.rail, side < 0 ? -48 - i : 46 + i, y + 4 + i, 2, 1)
      b(k.railHi, side < 0 ? -49 : 44, y - 60, 5, 2)
    }
    b(k.rail, -57, y - 9, 2, 9)
    b(k.trim, -67, y - 25, 22, 16)
    b(k.sign, -66, y - 24, 20, 14)
    label(b, k.signInk, formatFloor(floor), -63, y - 22, 2)
    b(k.rail, 52, y - 15, 5, 15)
    b(k.railHi, 52, y - 15, 1, 15)
    b(k.screen, 53, y - 13, 3, 5)
    b(k.lit, 54, y - 12, 1, 1)
    b(k.ghost, 54, y - 10, 1, 1)
  }
}

/** The pavement under the first lift, with the void deck's cat asleep on it. Drawn from y = 4, below the sill */
export function pavement(b: Brush) {
  const rand = mulberry32(12)
  b('#cdc1a2', -200, 4, 400, 2)
  b('#bcb092', -200, 6, 400, 44)
  for (let x = -200; x < 200; x += 16) b('#a99d7f', x, 6, 1, 44)
  for (const y of [18, 32]) b('#a99d7f', -200, y, 400, 1)
  for (let i = 0; i < 40; i++) b('#c9be9f', -200 + Math.floor(rand() * 396), 7 + Math.floor(rand() * 36), 2, 1)
  // The lift pit, and a strip of tactile paving up to the door
  b('#6f736d', -46, 4, 92, 4)
  b('#f2c230', -30, 8, 60, 3)
  for (let x = -29; x < 30; x += 3) b('#d9a81f', x, 9, 1, 1)
  // A drain
  b('#5d615b', 84, 12, 14, 5)
  for (let x = 85; x < 98; x += 2) b('#2f322e', x, 13, 1, 3)
  // The cat
  b('#e0934a', -86, 8, 11, 4)
  b('#e0934a', -88, 6, 5, 5)
  b('#e0934a', -88, 5, 1, 1)
  b('#e0934a', -85, 5, 1, 1)
  b('#c2742f', -80, 8, 2, 4)
  b('#c2742f', -76, 9, 3, 1)
  b('#f6e3c8', -87, 9, 3, 2)
  b('#17212f', -87, 8, 1, 1)
  // Somebody's slippers, left at the door
  b('#f7f3e8', 62, 9, 5, 2)
  b('#3f6fd6', 63, 9, 2, 1)
  b('#f7f3e8', 69, 10, 5, 2)
  b('#3f6fd6', 70, 10, 2, 1)
}
