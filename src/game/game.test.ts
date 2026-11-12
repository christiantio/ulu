import { describe, expect, it } from 'vitest'
import { addDays, dailyPrompts, diveNumber, mulberry32, msUntilNextDive, randomPrompts, singaporeDateKey } from './daily'
import {
  WORLD_ROUNDS_PER_DIVE,
  extendSchedule,
  promptsForDate,
  unlimitedPrompts,
  validateSchedule,
  worldRoundsFor,
} from './schedule'
import { checkAnswer, editDistance, matchAnswer, matchProblems } from './match'
import { looseWords, normalize } from './normalize'
import { shareText } from './share'
import { displayStreak, type Stats } from './storage'
import { CATEGORIES, SG_CATEGORIES, scopeOf, type Prompt, type Tier } from './types'
import { validatePacks } from './validate'

function makePrompt(id: string, answers: [string, Tier, string[]?][], category: Prompt['category'] = 'places'): Prompt {
  return { id, category, text: id, answers: answers.map(([name, tier, aliases]) => ({ name, tier, aliases })) }
}

const towns = makePrompt('towns', [
  ['Ang Mo Kio', 'common', ['AMK']],
  ['Bedok', 'common'],
  ['Bishan', 'solid'],
  ['Bukit Batok', 'solid'],
  ['Bukit Panjang', 'rare'],
  ['Bukit Merah', 'solid'],
  ['Choa Chu Kang', 'solid', ['CCK']],
  ['Toa Payoh', 'common', ['TPY']],
  ['Sembawang', 'rare'],
  ['Kallang/Whampoa', 'ulu', ['Kallang Whampoa', 'Whampoa']],
  ['Marine Parade', 'ulu'],
  ['Bukit Timah', 'gem'],
])

describe('normalize', () => {
  it('ignores case, punctuation, spacing, accents and a leading "the"', () => {
    expect(normalize('Char Kway Teow')).toBe(normalize('char-kway-teow'))
    expect(normalize('  CHARKWAYTEOW ')).toBe('charkwayteow')
    expect(normalize('Café')).toBe('cafe')
    expect(normalize('The Esplanade')).toBe('esplanade')
    expect(normalize("Prata'")).toBe('prata')
    expect(normalize('Kallang/Whampoa')).toBe('kallangwhampoa')
    expect(normalize('A&W')).toBe('aandw')
  })
})

describe('matchAnswer', () => {
  it('matches names and aliases exactly', () => {
    expect(matchAnswer('ang mo kio', towns)?.answer.name).toBe('Ang Mo Kio')
    expect(matchAnswer('AMK', towns)).toEqual({ answer: towns.answers[0], corrected: false })
    expect(matchAnswer('whampoa', towns)?.answer.name).toBe('Kallang/Whampoa')
  })

  it('tolerates small typos on longer answers', () => {
    expect(matchAnswer('Sembawan', towns)).toMatchObject({ answer: { name: 'Sembawang' }, corrected: true })
    expect(matchAnswer('Choa Chu Kong', towns)?.answer.name).toBe('Choa Chu Kang')
  })

  it('does not fuzz short inputs', () => {
    expect(matchAnswer('Bedk', towns)).toBeNull()
    expect(matchAnswer('AMX', towns)).toBeNull()
  })

  it('refuses ambiguous corrections', () => {
    // One edit from both Bukit Batok and Bukit Timah? No, but equidistant to two names should fail
    const p = makePrompt('ambiguous', [
      ['Bukit Batok', 'common'],
      ['Bukit Bator', 'common'],
    ])
    expect(matchAnswer('Bukit Bato', p)).toBeNull()
  })

  it('rejects unrelated and empty input', () => {
    expect(matchAnswer('Johor Bahru', towns)).toBeNull()
    expect(matchAnswer('   ', towns)).toBeNull()
  })

  it('computes bounded edit distance, counting a swap of neighbours as one typo', () => {
    expect(editDistance('kitten', 'sitting', 5)).toBe(3)
    expect(editDistance('abc', 'abc', 0)).toBe(0)
    expect(editDistance('abcdef', 'a', 2)).toBe(3)
    expect(editDistance('payho', 'payoh', 2)).toBe(1)
    expect(editDistance('einstien', 'einstein', 2)).toBe(1)
    // Each character is only moved once: this is two swaps' worth of edits, not one
    expect(editDistance('ca', 'abc', 3)).toBe(3)
  })

  it('forgives swapped letters', () => {
    expect(matchAnswer('Toa Payho', towns)).toMatchObject({ answer: { name: 'Toa Payoh' }, corrected: true })
    expect(matchAnswer('Bisahn', towns)?.answer.name).toBe('Bishan')
  })
})

describe('loose matching', () => {
  const stations = {
    ...makePrompt('stations', [
      ['Bishan', 'common'],
      ['Bukit Panjang', 'solid'],
      ['Mount Faber', 'rare'],
      ['Sixth Avenue', 'rare'],
      ['Tanjong Pagar', 'solid'],
      ['Terminal 2', 'ulu'],
      ['Saint James', 'gem'],
    ]),
    filler: ['MRT', 'station', 'stn'],
  }

  it('reduces an answer to its meaningful words', () => {
    expect(looseWords('The Lord of the Rings')).toEqual(['lord', 'ring'])
    expect(looseWords('World War II')).toEqual(looseWords('world war two'))
    expect(looseWords('Henry the Eighth')).toEqual(looseWords('Henry VIII'))
    expect(looseWords('21st Century')).toEqual(['21', 'century'])
    expect(looseWords('Bt Timah Rd')).toEqual(looseWords('Bukit Timah Road'))
    expect(looseWords('Bishan MRT Station', ['MRT', 'station'])).toEqual(['bishan'])
    expect(looseWords('Fish Balls')).toEqual(looseWords('fish ball'))
    // "a" isn't dropped: in "A Ma" it's part of the word
    expect(looseWords('A Ma')).toEqual(['a', 'ma'])
  })

  it("ignores the prompt's filler words", () => {
    for (const input of ['Bishan MRT', 'bishan mrt station', 'Bishan Stn', 'MRT Bishan'])
      expect(checkAnswer(input, stations)).toMatchObject({ kind: 'match', answer: { name: 'Bishan' }, corrected: false })
    // Filler is only ignored where the prompt says so
    expect(matchAnswer('Bishan MRT', towns)).toBeNull()
    // Nothing but filler is not an answer
    expect(checkAnswer('MRT station', stations).kind).toBe('none')
  })

  it('reads short forms, number spellings and word order', () => {
    expect(matchAnswer('Bt Panjang', stations)?.answer.name).toBe('Bukit Panjang')
    expect(matchAnswer('Mt Faber', stations)?.answer.name).toBe('Mount Faber')
    expect(matchAnswer('6th Ave', stations)?.answer.name).toBe('Sixth Avenue')
    expect(matchAnswer('Tg Pagar', stations)?.answer.name).toBe('Tanjong Pagar')
    expect(matchAnswer('Terminal Two', stations)?.answer.name).toBe('Terminal 2')
    expect(matchAnswer('St James', stations)?.answer.name).toBe('Saint James')
    expect(matchAnswer('Pagar Tanjong', stations)?.answer.name).toBe('Tanjong Pagar')
    expect(matchAnswer('Bt Panjnag MRT', stations)).toMatchObject({ answer: { name: 'Bukit Panjang' }, corrected: true })
  })

  it('never corrects a digit', () => {
    expect(matchAnswer('Terminal 3', stations)).toBeNull()
    expect(matchAnswer('Terminal Three', stations)).toBeNull()
    expect(matchAnswer('Terminl 2', stations)?.answer.name).toBe('Terminal 2')
  })
})

describe('partial matching', () => {
  const leaders = {
    ...makePrompt('leaders', [
      ['Lee Kuan Yew', 'common', ['LKY']],
      ['Lee Hsien Loong', 'common'],
      ['Goh Chok Tong', 'solid'],
      ['S. R. Nathan', 'solid'],
      ['Albert Einstein', 'rare'],
      ['North Korea', 'rare'],
      ['South Korea', 'rare'],
      ['Guinea', 'ulu'],
      ['Papua New Guinea', 'ulu'],
      ['Toy Story 2', 'gem'],
    ]),
    partial: true,
  }

  it('accepts part of a name that points to one answer', () => {
    expect(checkAnswer('Einstein', leaders)).toMatchObject({ kind: 'match', answer: { name: 'Albert Einstein' } })
    expect(matchAnswer('Kuan Yew', leaders)?.answer.name).toBe('Lee Kuan Yew')
    expect(matchAnswer('nathan', leaders)?.answer.name).toBe('S. R. Nathan')
    expect(matchAnswer('Goh', leaders)?.answer.name).toBe('Goh Chok Tong')
  })

  it('asks for more when it points to several', () => {
    expect(checkAnswer('Lee', leaders).kind).toBe('ambiguous')
    expect(checkAnswer('Korea', leaders).kind).toBe('ambiguous')
  })

  it('prefers a whole answer over part of another', () => {
    expect(matchAnswer('Guinea', leaders)?.answer.name).toBe('Guinea')
  })

  it('forgives a typo inside the part', () => {
    expect(checkAnswer('Einstien', leaders)).toMatchObject({ kind: 'match', answer: { name: 'Albert Einstein' }, corrected: true })
    expect(matchAnswer('Kuan Yee', leaders)).toBeNull() // 3-letter words must be exact
  })

  it('needs a real word, in order, next to each other', () => {
    expect(matchAnswer('2', leaders)).toBeNull()
    expect(matchAnswer('R', leaders)).toBeNull()
    expect(matchAnswer('Lee Yew', leaders)).toBeNull()
    expect(matchAnswer('Yew Kuan', leaders)).toBeNull()
  })

  it("doesn't let part of a name stand for an answer when it's also part of a decoy", () => {
    const neighbours = {
      ...makePrompt('neighbours', [['North Korea', 'common'], ['Mongolia', 'gem']]), // prettier-ignore
      partial: true,
      decoys: [{ name: 'South Korea', why: 'North Korea is in the way.' }],
    }
    expect(checkAnswer('Korea', neighbours).kind).toBe('ambiguous')
    expect(checkAnswer('Koera', neighbours).kind).toBe('none')
    expect(matchAnswer('North', neighbours)?.answer.name).toBe('North Korea')
    // Part of a decoy alone isn't a verdict; the whole decoy is
    expect(checkAnswer('South', neighbours).kind).toBe('none')
    expect(checkAnswer('Suoth', neighbours).kind).toBe('none')
    expect(checkAnswer('South Korea', neighbours).kind).toBe('decoy')
  })

  it('is off unless the prompt turns it on', () => {
    expect(matchAnswer('Payoh', towns)).toBeNull()
    expect(matchAnswer('Bukit', towns)).toBeNull()
  })
})

describe('decoys', () => {
  const nordic = {
    ...makePrompt('nordic', [
      ['Iceland', 'common'],
      ['Norway', 'common'],
      ['Sweden', 'common'],
      ['Denmark', 'solid'],
      ['Finland', 'gem'],
    ]),
    decoys: [
      { name: 'Ireland', aliases: ['Eire'], why: "Close, but it's not Nordic." },
      { name: 'Greenland', why: 'Part of the Kingdom of Denmark, not a country of its own.' },
    ],
  }

  it('would otherwise be corrected into a right answer', () => {
    const { decoys, ...unguarded } = nordic
    expect(decoys).toHaveLength(2)
    expect(matchAnswer('Ireland', unguarded)?.answer.name).toBe('Iceland')
  })

  it('are refused, with the reason', () => {
    expect(checkAnswer('Ireland', nordic)).toEqual({ kind: 'decoy', decoy: nordic.decoys[0] })
    expect(checkAnswer('eire', nordic)).toMatchObject({ kind: 'decoy', decoy: { name: 'Ireland' } })
    expect(matchAnswer('Ireland', nordic)).toBeNull()
  })

  it('win a typo that is closer to them than to any answer', () => {
    expect(checkAnswer('Irland', nordic)).toMatchObject({ kind: 'decoy', decoy: { name: 'Ireland' } })
    expect(checkAnswer('Greenlnd', nordic)).toMatchObject({ kind: 'decoy', decoy: { name: 'Greenland' } })
    // Equally far from an answer and a decoy: no verdict either way
    expect(checkAnswer('Iteland', nordic).kind).toBe('none')
    expect(checkAnswer('Icelnad', nordic)).toMatchObject({ kind: 'match', answer: { name: 'Iceland' } })
  })
})

describe('matchProblems', () => {
  it('flags a decoy that matches an answer', () => {
    const p = { ...makePrompt('p', [['Saint Lucia', 'gem']]), decoys: [{ name: 'St Lucia', why: 'x' }] }
    expect(matchProblems(p).errors).toHaveLength(1)
    expect(matchProblems(p).errors[0]).toContain('a decoy matches an answer')
  })

  it('flags answers that only differ in ways matching ignores', () => {
    const p = { ...makePrompt('p', [['Rocky II', 'gem'], ['Rocky 2', 'rare'], ['Bishan', 'common'], ['Bishan Station', 'solid']]) } // prettier-ignore
    expect(matchProblems(p).errors).toHaveLength(1)
    expect(matchProblems({ ...p, filler: ['station'] }).errors).toHaveLength(2)
  })

  it('warns about answers a typo apart, once per pair', () => {
    const p = makePrompt('p', [['Bukit Batok', 'gem', ['Bt Batok']], ['Bukit Bator', 'rare', ['Bt Bator']]]) // prettier-ignore
    expect(matchProblems(p)).toEqual({ errors: [], warnings: [expect.stringContaining('a typo apart')] })
  })
})

describe('daily selection', () => {
  const pool = CATEGORIES.flatMap((category) =>
    Array.from({ length: 5 }, (_, i) => makePrompt(`${category}-${i}`, [], category)),
  )

  it('uses the Singapore date regardless of device timezone', () => {
    // 20:00 UTC on 31 Oct is 04:00 on 1 Nov in Singapore
    expect(singaporeDateKey(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11-01')
    expect(singaporeDateKey(new Date('2026-10-31T15:59:59Z'))).toBe('2026-10-31')
  })

  it('counts time to the next Singapore midnight', () => {
    expect(msUntilNextDive(new Date('2026-10-31T15:59:00Z'))).toBe(60_000)
    expect(msUntilNextDive(new Date('2026-10-31T16:00:00Z'))).toBe(86_400_000)
  })

  it('numbers dives from launch', () => {
    expect(diveNumber('2026-10-27')).toBe(1)
    expect(diveNumber('2026-11-05')).toBe(10)
  })

  it('is deterministic for a date and different across dates', () => {
    const a = dailyPrompts(pool, '2026-11-03').map((p) => p.id)
    expect(dailyPrompts([...pool].reverse(), '2026-11-03').map((p) => p.id)).toEqual(a)
    expect(dailyPrompts(pool, '2026-11-04').map((p) => p.id)).not.toEqual(a)
  })

  it('picks 7 prompts from 7 different categories', () => {
    const picked = dailyPrompts(pool, '2026-12-25')
    expect(picked).toHaveLength(7)
    expect(new Set(picked.map((p) => p.category)).size).toBe(7)
  })

  it('does not repeat a prompt until its category has cycled', () => {
    const seen = new Map<string, number>()
    for (let d = 0; d < 5; d++) {
      const date = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10)
      for (const p of dailyPrompts(pool, date)) seen.set(p.id, (seen.get(p.id) ?? 0) + 1)
    }
    expect(Math.max(...seen.values())).toBe(1)
  })

  it('still fills a dive when there are few categories', () => {
    const small = Array.from({ length: 10 }, (_, i) => makePrompt(`food-${i}`, [], 'food'))
    const picked = dailyPrompts(small, '2026-11-02')
    expect(picked).toHaveLength(7)
    expect(new Set(picked).size).toBe(7)
  })
})

describe('frozen schedule', () => {
  const pool = CATEGORIES.flatMap((category) =>
    Array.from({ length: 8 }, (_, i) => makePrompt(`${category}-${i}`, [], category)),
  )
  const today = '2026-10-30'
  const schedule = extendSchedule({}, pool, addDays(today, 30), today)

  it('backfills past days with the seeded prompts players already got', () => {
    for (const date of ['2026-10-27', '2026-10-28', '2026-10-29', today]) {
      expect(schedule[date]).toEqual(dailyPrompts(pool, date).map((p) => p.id))
    }
  })

  it('schedules valid days with no early repeats', () => {
    expect(Object.keys(schedule)).toHaveLength(34)
    expect(validateSchedule(schedule, pool, today)).toEqual([])
  })

  it('gives each new day its world rounds and fills the rest from Singapore', () => {
    expect(worldRoundsFor(pool)).toBe(WORLD_ROUNDS_PER_DIVE)
    const byId = new Map(pool.map((p) => [p.id, p]))
    for (const [date, ids] of Object.entries(schedule)) {
      if (date <= today) continue
      const scopes = ids.map((id) => scopeOf(byId.get(id)!.category))
      expect(scopes.filter((scope) => scope === 'world')).toHaveLength(WORLD_ROUNDS_PER_DIVE)
    }
  })

  it('holds back world rounds until there are enough world prompts to rest them', () => {
    const sg = pool.filter((p) => scopeOf(p.category) === 'sg')
    const world = pool.filter((p) => scopeOf(p.category) === 'world')
    expect(worldRoundsFor(sg)).toBe(0)
    expect(worldRoundsFor([...sg, ...world.slice(0, 6)])).toBe(0)
    expect(worldRoundsFor([...sg, ...world.slice(0, 7)])).toBe(1)
    expect(worldRoundsFor([...sg, ...world.slice(0, 13)])).toBe(1)
    expect(worldRoundsFor([...sg, ...world.slice(0, 14)])).toBe(2)

    const few = [...sg, ...world.slice(0, 8)]
    const mixed = extendSchedule({}, few, addDays(today, 30), today)
    expect(validateSchedule(mixed, few, today)).toEqual([])
    for (const [date, ids] of Object.entries(mixed)) {
      if (date > today) expect(ids.filter((id) => world.some((p) => p.id === id))).toHaveLength(1)
    }
  })

  it('flags a future day with too many world prompts', () => {
    const day = addDays(today, 20)
    const isSg = (id: string) => SG_CATEGORIES.some((c) => id.startsWith(`${c}-`))
    const extra = pool.find((p) => scopeOf(p.category) === 'world' && !schedule[day].includes(p.id))!
    // Swap one Singapore prompt for a third world one
    const crowded = { ...schedule, [day]: [...schedule[day].filter(isSg).slice(1), ...schedule[day].filter((id) => !isSg(id)), extra.id] }
    expect(validateSchedule(crowded, pool, today)).toContain(
      `${day}: has ${WORLD_ROUNDS_PER_DIVE + 1} world prompts, at most ${WORLD_ROUNDS_PER_DIVE} allowed`,
    )
  })

  it('never changes a scheduled day when prompts are added or reordered', () => {
    const grown = [...pool, ...Array.from({ length: 5 }, (_, i) => makePrompt(`food-new-${i}`, [], 'food'))].reverse()
    const extended = extendSchedule(schedule, grown, addDays(today, 60), addDays(today, 10))
    for (const [date, ids] of Object.entries(schedule)) {
      expect(extended[date]).toEqual(ids)
      expect(promptsForDate(grown, date, schedule).map((p) => p.id)).toEqual(ids)
    }
    expect(Object.keys(extended)).toHaveLength(64)
    expect(validateSchedule(extended, grown, today)).toEqual([])
  })

  it('keeps excluded prompts out of a random set', () => {
    const exclude = pool.slice(0, 40).map((p) => p.id)
    for (let seed = 0; seed < 200; seed++) {
      const picked = randomPrompts(pool, exclude, mulberry32(seed))
      expect(picked).toHaveLength(7)
      expect(picked.some((p) => exclude.includes(p.id))).toBe(false)
    }
  })

  it("never puts today's dive in Unlimited, and replays past dives once there are enough", () => {
    const daily = schedule[today]
    const past = new Set(Object.keys(schedule).flatMap((d) => (d < today ? schedule[d] : [])))
    for (let seed = 0; seed < 200; seed++) {
      const recent = schedule['2026-10-27']
      const picked = unlimitedPrompts(pool, schedule, today, { daily, recent }, mulberry32(seed)).map((p) => p.id)
      expect(picked).toHaveLength(7)
      expect(picked.some((id) => daily.includes(id) || recent.includes(id))).toBe(false)
      expect(picked.every((id) => past.has(id))).toBe(true)
    }
    // On launch day there's no archive yet, so it uses the rest of the bank
    const launch = unlimitedPrompts(pool, schedule, '2026-10-27', { daily: schedule['2026-10-27'], recent: [] })
    expect(launch).toHaveLength(7)
    expect(launch.some((p) => schedule['2026-10-27'].includes(p.id))).toBe(false)
  })

  it('falls back to the seeded prompts for an unscheduled date', () => {
    expect(promptsForDate(pool, '2027-06-01', schedule)).toEqual(dailyPrompts(pool, '2027-06-01'))
  })

  it('flags deleted prompts, early repeats, gaps and a short runway', () => {
    const [first, second] = [addDays(today, 21), addDays(today, 22)]
    const broken = { ...schedule, [second]: [schedule[first][0], ...schedule[second].slice(1)] }
    delete broken[addDays(today, 5)]
    const errors = validateSchedule(broken, pool.slice(1), addDays(today, 20))
    expect(errors.some((e) => e.includes('no longer exists'))).toBe(true)
    expect(errors.some((e) => e.includes(`repeats 1 days after ${first}`))).toBe(true)
    expect(errors.some((e) => e.includes('skips from'))).toBe(true)
    expect(errors.some((e) => e.includes('run npm run schedule'))).toBe(true)
  })

  describe('after the schedule lapses', () => {
    // Nobody ran npm run schedule, so the days after the last scheduled one were served by the seeded fallback
    const lastScheduled = Object.keys(schedule).sort().at(-1)!
    const later = addDays(lastScheduled, 10)
    const lapsed = extendSchedule(schedule, pool, addDays(later, 30), later)

    it('backfills the lapsed days with what was served, which can repeat prompts early', () => {
      for (let d = 1; d <= 10; d++) {
        const date = addDays(lastScheduled, d)
        expect(lapsed[date]).toEqual(dailyPrompts(pool, date).map((p) => p.id))
      }
      // Had those days still been in the future, they would break the repeat rule
      expect(validateSchedule(lapsed, pool, lastScheduled).some((e) => e.includes('repeats'))).toBe(true)
    })

    it('passes again once backfilled, since past days can no longer change', () => {
      expect(validateSchedule(lapsed, pool, later)).toEqual([])
    })

    it('still catches a repeat on a future day, counting past days as history', () => {
      const tomorrow = addDays(later, 1)
      const broken = { ...lapsed, [tomorrow]: [lapsed[later][0], ...lapsed[tomorrow].slice(1)] }
      expect(validateSchedule(broken, pool, later)).toContainEqual(
        `${tomorrow}: "${lapsed[later][0]}" repeats 1 days after ${later}`,
      )
    })
  })
})

describe('scoring and sharing', () => {
  it('builds a spoiler-free share string', () => {
    const text = shareText(
      [
        { promptId: 'a', input: 'x', attempts: ['Holland Village'], answer: 'Bukit Timah', tier: 'gem', points: 100 },
        { promptId: 'b', input: '', attempts: ['Sentosa Cove'], answer: null, tier: null, points: 0 },
        { promptId: 'c', input: 'amk', attempts: [], answer: 'Ang Mo Kio', tier: 'common', points: 10 },
      ],
      'Ulu #3',
      'https://ulu.sg',
    )
    // The floor and the lift it reached: 20 floors for the gem and 2 for the common answer, from floor 0
    expect(text).toBe('Ulu #3 🇸🇬 110/700\n💎❌⚪\nFloor 22 · Upgraded HDB Lift\nhttps://ulu.sg')
    expect(text).not.toContain('Timah')
    // Nor the rejected guesses
    expect(text).not.toMatch(/Holland|Sentosa/)
  })
})

describe('displayStreak', () => {
  const stats: Stats = {
    played: 3,
    totalScore: 900,
    bestScore: 400,
    currentStreak: 3,
    maxStreak: 3,
    lastPlayed: '2026-11-04',
    gems: 2,
  }

  it('keeps the streak if the last dive was today or yesterday', () => {
    expect(displayStreak(stats, '2026-11-04')).toBe(3)
    expect(displayStreak(stats, '2026-11-05')).toBe(3)
  })

  it('shows 0 once a day has been missed', () => {
    expect(displayStreak(stats, '2026-11-06')).toBe(0)
    expect(displayStreak(stats, '2026-11-07')).toBe(0)
  })

  it('shows 0 if you have never played', () => {
    expect(displayStreak({ ...stats, currentStreak: 0, lastPlayed: null }, '2026-11-04')).toBe(0)
  })
})

describe('validatePacks', () => {
  const pack = (prompts: Prompt[]) => ({ 'test.json': { name: 'Test', asOf: '2026-10-27', prompts } })

  it('accepts a well-formed prompt', () => {
    expect(validatePacks(pack([towns]))).toEqual([])
  })

  it('flags missing or duplicate gems, alias collisions and duplicate ids', () => {
    const noGem = { ...towns, id: 'no-gem', answers: towns.answers.map((a) => ({ ...a, tier: 'solid' as Tier })) }
    const collide = {
      ...towns,
      id: 'collide',
      answers: [...towns.answers, { name: 'Bishan Park', aliases: ['bishan'], tier: 'rare' as Tier }],
    }
    const errors = validatePacks(pack([towns, towns, noGem, collide]))
    expect(errors.some((e) => e.includes('id already used'))).toBe(true)
    expect(errors.some((e) => e.includes('exactly 1 gem'))).toBe(true)
    expect(errors.some((e) => e.includes('collides with Bishan'))).toBe(true)
  })

  it('accepts decoys, filler and partial, and flags the ways they can go wrong', () => {
    const ok = { ...towns, partial: true, filler: ['town'], decoys: [{ name: 'Johor Bahru', aliases: ['JB'], why: 'Wrong country.' }] }
    expect(validatePacks(pack([ok]))).toEqual([])

    const bad = {
      ...towns,
      filler: ['bukit'],
      decoys: [
        { name: 'Bedok', why: 'It is one, actually.' },
        { name: 'Tengah', why: '' },
        { name: '新加坡', why: 'Not a town.' },
      ],
    }
    const errors = validatePacks(pack([bad]))
    expect(errors.some((e) => e.includes('"Bedok" and "Bedok": a decoy matches an answer'))).toBe(true)
    expect(errors.some((e) => e.includes('Tengah: decoy needs a "why"'))).toBe(true)
    expect(errors.some((e) => e.includes('"新加坡" normalizes to nothing'))).toBe(true)
    // "bukit" tells Bukit Batok, Bukit Merah, Bukit Panjang and Bukit Timah apart, so it can't be filler...
    expect(validatePacks(pack([{ ...towns, filler: ['batok', 'merah'] }])).some((e) => e.includes('look the same'))).toBe(true)
    // ...and settings of the wrong type are refused rather than ignored
    const mistyped = { ...towns, filler: 'town' as unknown as string[], partial: 'yes' as unknown as boolean }
    expect(validatePacks(pack([mistyped]))).toEqual(
      expect.arrayContaining([expect.stringContaining('"filler" must be a list'), expect.stringContaining('"partial" must be true or false')]),
    )
  })

  it('flags thin prompts and bad categories', () => {
    const thin = makePrompt('thin', [['A thing', 'gem']])
    const errors = validatePacks(pack([{ ...thin, category: 'sports' as Prompt['category'] }]))
    expect(errors.some((e) => e.includes('min 12'))).toBe(true)
    expect(errors.some((e) => e.includes('unknown category'))).toBe(true)
  })
})
